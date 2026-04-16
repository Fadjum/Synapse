
const axios = require('axios');
const { google } = require('googleapis');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { refreshAccessToken } = require('../services/googleAuthService');

// Use proxy agent if HTTPS_PROXY is set (needed in some hosted environments)
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
const httpsAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
const axiosConfig = httpsAgent ? { httpsAgent, proxy: false } : {};

// --- RATE LIMITING ---
let lastRequestTime = 0;
const MIN_DELAY_MS = 300;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const throttle = async () => {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < MIN_DELAY_MS) {
        const delay = MIN_DELAY_MS - elapsed;
        console.log(`[GBP RATE LIMIT] delaying ${delay}ms`);
        await sleep(delay);
    }
    lastRequestTime = Date.now();
};

// --- AUTH ---

const getFreshAccessToken = async () => {
    const { access_token } = await refreshAccessToken();
    return access_token;
};

const getAuthenticatedClient = async () => {
    const accessToken = await getFreshAccessToken();
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    return auth;
};

// --- STRUCTURED GBP ERROR EXTRACTION ---
// Extracts meaningful error info from Google API responses instead of
// returning the raw axios error message which is often just "Request failed with status 403".

const extractGBPError = (error, operation) => {
    const status = error.response?.status;
    const gbp = error.response?.data?.error;

    let errorCode;
    switch (status) {
        case 400: errorCode = 'INVALID_ARGUMENT'; break;
        case 401: errorCode = 'UNAUTHENTICATED'; break;
        case 403: errorCode = 'PERMISSION_DENIED'; break;
        case 404: errorCode = 'NOT_FOUND'; break;
        case 409: errorCode = 'ALREADY_EXISTS'; break;
        case 429: errorCode = 'RATE_LIMITED'; break;
        default:  errorCode = `${operation}_FAILED`;
    }

    return {
        success: false,
        error: errorCode,
        message: gbp?.message || error.message,
        ...(gbp?.details && { details: gbp.details })
    };
};

// --- API CLIENT FUNCTIONS ---

/**
 * Fetches reviews. Supports pagination via optional pageToken.
 * Response includes nextPageToken when more pages exist.
 */
const fetchReviews = async (pageToken = null) => {
    try {
        await throttle();
        const accessToken = await getFreshAccessToken();
        const accountId = (process.env.GBP_ACCOUNT_ID || '').replace('accounts/', '');
        const locationId = (process.env.GBP_LOCATION_ID || '').replace('locations/', '');

        if (!accountId || !locationId) {
            throw new Error('GBP_ACCOUNT_ID or GBP_LOCATION_ID is not set in environment variables.');
        }

        const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`;
        console.log(`[GBP DEBUG] Fetching reviews from (v4): ${url}`);
        const params = { pageSize: 50 };
        if (pageToken) params.pageToken = pageToken;

        const response = await axios.get(url, {
            ...axiosConfig,
            headers: { Authorization: `Bearer ${accessToken}` },
            params,
            timeout: 10000
        });

        return response.data;
    } catch (error) {
        console.error('Failed to fetch reviews:', error.message);
        return extractGBPError(error, 'FETCH_REVIEWS');
    }
};

/**
 * Replies to a review.
 * reviewName must be the full resource path: accounts/{id}/locations/{id}/reviews/{id}
 * Payload: { comment: "..." } per GBP Reviews API v1 ReviewReply resource spec.
 */
const replyToReview = async (reviewName, replyText) => {
    try {
        await throttle();
        const accessToken = await getFreshAccessToken();
        const url = `https://mybusiness.googleapis.com/v4/${reviewName}/reply`;

        await axios.put(url, { comment: replyText }, {
            ...axiosConfig,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000
        });

        console.log(`Reply sent to review: ${reviewName}`);
        return { success: true };
    } catch (error) {
        console.error(`Reply failed for review ${reviewName}:`, error.message);
        return extractGBPError(error, 'REPLY_TO_REVIEW');
    }
};

/**
 * Deletes the owner's reply to a review.
 * reviewName must be the full resource path: accounts/{id}/locations/{id}/reviews/{id}
 * Note: This deletes the OWNER REPLY only — customer reviews cannot be deleted via API.
 */
const deleteReviewReply = async (reviewName) => {
    try {
        await throttle();
        const accessToken = await getFreshAccessToken();
        const url = `https://mybusiness.googleapis.com/v4/${reviewName}/reply`;

        await axios.delete(url, {
            ...axiosConfig,
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            timeout: 10000,
        });

        console.log(`Reply deleted for review: ${reviewName}`);
        return { success: true };
    } catch (error) {
        console.error(`Delete reply failed for review ${reviewName}:`, error.message);
        return extractGBPError(error, 'DELETE_REVIEW_REPLY');
    }
};

/**
 * Fetches the location profile from the Business Information API.
 */
const getProfile = async () => {
    try {
        await throttle();
        const accessToken = await getFreshAccessToken();
        const locationId = (process.env.GBP_LOCATION_ID || '').replace('locations/', '');

        if (!locationId) throw new Error('GBP_LOCATION_ID is not set.');

        const url = `https://mybusinessbusinessinformation.googleapis.com/v1/locations/${locationId}?readMask=name,title,storefrontAddress,websiteUri,regularHours,specialHours,serviceArea.places,serviceArea.businessType,phoneNumbers,categories,metadata,latlng,description`;

        const response = await axios.get(url, {
            ...axiosConfig,
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000
        });

        return response.data;
    } catch (error) {
        console.error('Failed to fetch profile:', error.message);
        return extractGBPError(error, 'GET_PROFILE');
    }
};

/**
 * Fetches 28-day performance metrics using the multi-metric endpoint.
 * Metrics: impressions, calls, website clicks, directions, and bookings.
 */
const getInsights = async () => {
    try {
        await throttle();
        const accessToken = await getFreshAccessToken();
        const locationId = (process.env.GBP_LOCATION_ID || '').replace('locations/', '');

        if (!locationId) throw new Error('GBP_LOCATION_ID is not set.');

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 28);

        const url = `https://businessprofileperformance.googleapis.com/v1/locations/${locationId}:fetchMultiDailyMetricsTimeSeries`;

        const payload = {
            dailyMetrics: [
                'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
                'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
                'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
                'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
                'CALL_CLICKS',
                'WEBSITE_CLICKS',
                'DIRECTIONS_REQUESTS'
            ],
            dailyRange: {
                start_date: {
                    year: startDate.getFullYear(),
                    month: startDate.getMonth() + 1,
                    day: startDate.getDate()
                },
                end_date: {
                    year: endDate.getFullYear(),
                    month: endDate.getMonth() + 1,
                    day: endDate.getDate()
                }
            }
        };

        const response = await axios.post(url, payload, {
            ...axiosConfig,
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000
        });

        return response.data;
    } catch (error) {
        console.error('Failed to fetch insights:', error.message);
        return extractGBPError(error, 'GET_INSIGHTS');
    }
};

/**
 * Fetches verification status for the location.
 */
const getVerificationStatus = async () => {
    try {
        await throttle();
        const accessToken = await getFreshAccessToken();
        const locationId = (process.env.GBP_LOCATION_ID || '').replace('locations/', '');

        if (!locationId) throw new Error('GBP_LOCATION_ID is not set.');

        const url = `https://mybusinessverifications.googleapis.com/v1/locations/${locationId}/verifications`;

        const response = await axios.get(url, {
            ...axiosConfig,
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000
        });

        return response.data;
    } catch (error) {
        console.error('Failed to fetch verification status:', error.message);
        return extractGBPError(error, 'GET_VERIFICATION_STATUS');
    }
};

/**
 * Fetches available attributes for the location based on its category.
 */
const getAttributes = async () => {
    try {
        await throttle();
        const accessToken = await getFreshAccessToken();
        const locationId = (process.env.GBP_LOCATION_ID || '').replace('locations/', '');

        if (!locationId) throw new Error('GBP_LOCATION_ID is not set.');

        const url = `https://mybusinessbusinessinformation.googleapis.com/v1/locations/${locationId}/attributes`;

        const response = await axios.get(url, {
            ...axiosConfig,
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000
        });

        return response.data;
    } catch (error) {
        console.error('Failed to fetch attributes:', error.message);
        return extractGBPError(error, 'GET_ATTRIBUTES');
    }
};

/**
 * Updates the attributes for the location.
 * attributeData should be the single attribute object with "name", "attributeId", and values.
 */
const updateAttributes = async (attribute) => {
    try {
        await throttle();
        const accessToken = await getFreshAccessToken();
        
        if (!attribute || !attribute.name || !attribute.attributeId) {
            throw new Error('Invalid attribute data: name and attributeId are required.');
        }

        // attribute.name is e.g. "locations/{id}/attributes/{attrId}"
        const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${attribute.name}?attributeMask=${attribute.attributeId}`;

        const response = await axios.patch(url, attribute, {
            ...axiosConfig,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        return response.data;
    } catch (error) {
        console.error('Failed to update attributes:', error.message);
        return extractGBPError(error, 'UPDATE_ATTRIBUTES');
    }
};

/**
 * Fetches local posts. Supports pagination via optional pageToken.
 */
const getPosts = async (pageToken = null) => {
    try {
        await throttle();
        const accessToken = await getFreshAccessToken();
        const accountId = (process.env.GBP_ACCOUNT_ID || '').replace('accounts/', '');
        const locationId = (process.env.GBP_LOCATION_ID || '').replace('locations/', '');

        if (!accountId || !locationId) throw new Error('GBP_ACCOUNT_ID or GBP_LOCATION_ID is not set.');

        const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`;
        const params = {};
        if (pageToken) params.pageToken = pageToken;

        const response = await axios.get(url, {
            ...axiosConfig,
            headers: { Authorization: `Bearer ${accessToken}` },
            params,
            timeout: 10000
        });

        return response.data;
    } catch (error) {
        console.error('Failed to fetch posts:', error.message);
        return extractGBPError(error, 'GET_POSTS');
    }
};

/**
 * Lists all locations for the account.
 */
const getLocations = async () => {
    try {
        await throttle();
        const accessToken = await getFreshAccessToken();
        const accountId = (process.env.GBP_ACCOUNT_ID || '').replace('accounts/', '');

        if (!accountId) throw new Error('GBP_ACCOUNT_ID is not set.');

        const url = `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations` +
            `?readMask=name,title,storefrontAddress`;

        const response = await axios.get(url, {
            ...axiosConfig,
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000
        });

        return response.data;
    } catch (error) {
        console.error('Failed to list locations:', error.message);
        return extractGBPError(error, 'LIST_LOCATIONS');
    }
};

/**
 * Updates the location profile.
 * updateMask is a comma-separated list of field paths to update.
 * Updatable fields: title, storefrontAddress, websiteUri, regularHours,
 *   phoneNumbers, categories, description, serviceAreas, attributes
 */
const updateProfile = async (updateData, updateMask) => {
    try {
        await throttle();
        const accessToken = await getFreshAccessToken();
        const locationId = (process.env.GBP_LOCATION_ID || '').replace('locations/', '');

        if (!locationId) throw new Error('GBP_LOCATION_ID is not set.');

        const url = `https://mybusinessbusinessinformation.googleapis.com/v1/locations/${locationId}?updateMask=${updateMask}`;

        const response = await axios.patch(url, updateData, {
            ...axiosConfig,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        return response.data;
    } catch (error) {
        console.error('Failed to update profile:', error.message);
        return extractGBPError(error, 'UPDATE_PROFILE');
    }
};

/**
 * Creates a local post.
 * Required fields: languageCode (e.g. "en"), summary (max 1500 chars)
 * Optional: callToAction { actionType, url }, media [{ sourceUrl, mediaFormat }]
 */
const createPost = async (postData) => {
    try {
        await throttle();
        const accessToken = await getFreshAccessToken();
        const accountId = (process.env.GBP_ACCOUNT_ID || '').replace('accounts/', '');
        const locationId = (process.env.GBP_LOCATION_ID || '').replace('locations/', '');

        if (!accountId || !locationId) throw new Error('GBP_ACCOUNT_ID or GBP_LOCATION_ID is not set.');

        const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`;

        const response = await axios.post(url, postData, {
            ...axiosConfig,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        return response.data;
    } catch (error) {
        console.error('Failed to create post:', error.message);
        return extractGBPError(error, 'CREATE_POST');
    }
};

/**
 * Deletes a local post.
 * postName must be the full resource path: accounts/{id}/locations/{id}/localPosts/{id}
 */
const deletePost = async (postName) => {
    try {
        await throttle();
        const accessToken = await getFreshAccessToken();
        const url = `https://mybusiness.googleapis.com/v4/${postName}`;

        await axios.delete(url, {
            ...axiosConfig,
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000
        });

        console.log(`Deleted post: ${postName}`);
        return { success: true };
    } catch (error) {
        console.error(`Delete failed for post ${postName}:`, error.message);
        return extractGBPError(error, 'DELETE_POST');
    }
};

// NOTE: fetchQuestions and replyToQuestion are NOT called from the route handlers
// (those return 410 immediately) but are kept here for documentation purposes.
// The My Business Q&A API was permanently discontinued on November 3, 2025.
const fetchQuestions = async () => ({
    success: false,
    error: 'API_DISCONTINUED',
    message: 'The Google Business Profile Q&A API was permanently discontinued on November 3, 2025.'
});

const replyToQuestion = async () => ({
    success: false,
    error: 'API_DISCONTINUED',
    message: 'The Google Business Profile Q&A API was permanently discontinued on November 3, 2025.'
});

/**
 * Lists media items. Supports pagination via optional pageToken.
 */
const listMedia = async (pageToken = null) => {
    try {
        await throttle();
        const accessToken = await getFreshAccessToken();
        const accountId = (process.env.GBP_ACCOUNT_ID || '').replace('accounts/', '');
        const locationId = (process.env.GBP_LOCATION_ID || '').replace('locations/', '');

        if (!accountId || !locationId) throw new Error('GBP_ACCOUNT_ID or GBP_LOCATION_ID is not set.');

        const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/media`;
        const params = {};
        if (pageToken) params.pageToken = pageToken;

        const response = await axios.get(url, {
            ...axiosConfig,
            headers: { Authorization: `Bearer ${accessToken}` },
            params,
            timeout: 10000
        });

        return response.data;
    } catch (error) {
        console.error('Failed to list media:', error.message);
        return extractGBPError(error, 'LIST_MEDIA');
    }
};

/**
 * Fetches the service list (via the location resource's serviceItems field).
 */
const getServiceList = async () => {
    try {
        await throttle();
        const accessToken = await getFreshAccessToken();
        const locationId = (process.env.GBP_LOCATION_ID || '').replace('locations/', '');

        if (!locationId) throw new Error('GBP_LOCATION_ID is not set.');

        const url = `https://mybusinessbusinessinformation.googleapis.com/v1/locations/${locationId}?readMask=serviceItems`;
        console.log(`[GBP DEBUG] Fetching service list from: ${url}`);

        const response = await axios.get(url, {
            ...axiosConfig,
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000
        });

        return response.data;
    } catch (error) {
        console.error('Failed to fetch service list:', error.message);
        return extractGBPError(error, 'GET_SERVICE_LIST');
    }
};

/**
 * Updates the service list.
 * serviceListData must be a GBP location resource fragment: { serviceItems: [...] }
 * Default updateMask covers the full serviceItems array.
 */
const updateServiceList = async (serviceListData, updateMask = 'serviceItems') => {
    try {
        await throttle();
        const accessToken = await getFreshAccessToken();
        const locationId = (process.env.GBP_LOCATION_ID || '').replace('locations/', '');

        if (!locationId) throw new Error('GBP_LOCATION_ID is not set.');

        const url = `https://mybusinessbusinessinformation.googleapis.com/v1/locations/${locationId}?updateMask=${updateMask}`;

        const response = await axios.patch(url, serviceListData, {
            ...axiosConfig,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        return response.data;
    } catch (error) {
        console.error('Failed to update service list:', error.message);
        return extractGBPError(error, 'UPDATE_SERVICE_LIST');
    }
};

/**
 * Uploads a media item via sourceUrl.
 * mediaData must include: mediaFormat ("PHOTO" | "VIDEO"), sourceUrl (string),
 * and locationAssociation.category (e.g. "COVER_PHOTO", "PROFILE_COVER", "ADDITIONAL")
 */
const uploadMedia = async (mediaData) => {
    try {
        await throttle();
        const accessToken = await getFreshAccessToken();
        const accountId = (process.env.GBP_ACCOUNT_ID || '').replace('accounts/', '');
        const locationId = (process.env.GBP_LOCATION_ID || '').replace('locations/', '');

        if (!accountId || !locationId) throw new Error('GBP_ACCOUNT_ID or GBP_LOCATION_ID is not set.');

        const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/media`;

        const response = await axios.post(url, mediaData, {
            ...axiosConfig,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        return response.data;
    } catch (error) {
        console.error('Failed to upload media:', error.message);
        return extractGBPError(error, 'UPLOAD_MEDIA');
    }
};

/**
 * Deletes a media item by its full resource name.
 * mediaId must be the full resource path: accounts/{id}/locations/{id}/media/{id}
 */
const deleteMedia = async (mediaId) => {
    try {
        await throttle();
        const accessToken = await getFreshAccessToken();
        const url = `https://mybusiness.googleapis.com/v4/${mediaId}`;

        await axios.delete(url, {
            ...axiosConfig,
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000,
        });

        console.log(`Media deleted: ${mediaId}`);
        return { success: true };
    } catch (error) {
        console.error(`Failed to delete media ${mediaId}:`, error.message);
        return extractGBPError(error, 'DELETE_MEDIA');
    }
};

module.exports = {
    fetchReviews,
    replyToReview,
    deleteReviewReply,
    getProfile,
    getInsights,
    getPosts,
    getLocations,
    getVerificationStatus,
    getAttributes,
    updateProfile,
    updateAttributes,
    createPost,
    deletePost,
    fetchQuestions,
    replyToQuestion,
    listMedia,
    uploadMedia,
    deleteMedia,
    getServiceList,
    updateServiceList,
    getAuthenticatedClient
};
