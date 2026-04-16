const axios = require('axios');
const { GoogleAuth } = require('google-auth-library');
const { HttpsProxyAgent } = require('https-proxy-agent');

const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
const httpsAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

const GBP_SCOPES = ['https://www.googleapis.com/auth/business.manage'];

// --- Service Account auth (preferred) ---
let _serviceAccountAuth = null;

function getServiceAccountAuth() {
    if (_serviceAccountAuth) return _serviceAccountAuth;

    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
    const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;

    if (!keyJson && !keyFile) return null;

    const opts = { scopes: GBP_SCOPES };
    if (keyJson) {
        try {
            opts.credentials = JSON.parse(keyJson);
        } catch {
            throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_JSON is not valid JSON. Paste the full contents of the key file as a single-line JSON string.');
        }
    } else {
        opts.keyFilename = keyFile;
    }

    _serviceAccountAuth = new GoogleAuth(opts);
    return _serviceAccountAuth;
}

// --- OAuth2 refresh token auth (fallback) ---
let cachedToken = null;
let expiryTime = null;
let refreshPromise = null;

async function refreshOAuthToken() {
    if (cachedToken && expiryTime && Date.now() < (expiryTime - 60000)) {
        console.log("[GBP AUTH] using cached OAuth token");
        return {
            access_token: cachedToken,
            expires_in: Math.floor((expiryTime - Date.now()) / 1000)
        };
    }

    if (refreshPromise) {
        console.log("[GBP AUTH] waiting for existing OAuth refresh...");
        return refreshPromise;
    }

    console.log("[GBP AUTH] refreshing OAuth token");

    refreshPromise = (async () => {
        const { 
            GOOGLE_CLIENT_ID, 
            GOOGLE_CLIENT_SECRET, 
            GOOGLE_REFRESH_TOKEN,
            GBP_CLIENT_ID,
            GBP_CLIENT_SECRET
        } = process.env;

        const clientId = GOOGLE_CLIENT_ID || GBP_CLIENT_ID;
        const clientSecret = GOOGLE_CLIENT_SECRET || GBP_CLIENT_SECRET;

        if (!clientId || !clientSecret || !GOOGLE_REFRESH_TOKEN) {
            throw new Error("Missing GOOGLE_CLIENT_ID (or GBP_CLIENT_ID), GOOGLE_CLIENT_SECRET (or GBP_CLIENT_SECRET), or GOOGLE_REFRESH_TOKEN in environment.");
        }

        try {
            const response = await axios.post('https://oauth2.googleapis.com/token', {
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: GOOGLE_REFRESH_TOKEN,
                grant_type: 'refresh_token'
            }, { ...(httpsAgent && { httpsAgent, proxy: false }) });

            const { access_token, expires_in } = response.data;
            cachedToken = access_token;
            expiryTime = Date.now() + (expires_in * 1000);
            console.log("[GBP AUTH] OAuth token refreshed successfully");
            return { access_token, expires_in };
        } catch (error) {
            const detail = error.response ? error.response.data : error.message;
            console.error("[GBP AUTH] OAuth token refresh failed:", detail);
            cachedToken = null;
            expiryTime = null;
            throw new Error("Failed to refresh OAuth access token. The refresh token may be expired or revoked.");
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

/**
 * Returns a valid access token.
 * Uses service account credentials if GOOGLE_SERVICE_ACCOUNT_KEY_JSON or
 * GOOGLE_SERVICE_ACCOUNT_KEY_FILE is set; otherwise falls back to OAuth2 refresh token.
 *
 * IMPORTANT: For service account auth to work, the service account email address
 * must be added as a Manager on the Google Business Profile listing at
 * https://business.google.com — GCP IAM roles alone are not sufficient.
 *
 * @returns {Promise<{access_token: string, expires_in: number}>}
 */
async function refreshAccessToken() {
    const saAuth = getServiceAccountAuth();

    if (saAuth) {
        console.log("[GBP AUTH] using service account credentials");
        try {
            const client = await saAuth.getClient();
            const token = await client.getAccessToken();
            return {
                access_token: token.token,
                expires_in: 3600 // google-auth-library doesn't expose precise remaining time easily here, 1hr is standard
            };
        } catch (error) {
            console.error("[GBP AUTH] Service account auth failed, falling back to OAuth:", error.message);
        }
    }

    return refreshOAuthToken();
}

module.exports = {
    refreshAccessToken
};
