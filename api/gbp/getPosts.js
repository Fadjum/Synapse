const gbpClient = require('../../utils/gbpClient');
const { normalizePosts } = require('../../utils/normalizeGBPResponse');
const logger = require('../../utils/logger');

const handleGetPosts = async (req, res) => {
  try {
    logger.info('Fetching local posts...');
    const rawData = await gbpClient.getPosts(req.query.pageToken || null);

    if (rawData.error) {
        logger.error(`GBP error fetching posts: ${rawData.error}`);
        return res.status(500).json(rawData);
    }

    const normalizedData = normalizePosts(rawData);
    logger.info('Successfully fetched and normalized posts.');
    if (rawData.nextPageToken) normalizedData.nextPageToken = rawData.nextPageToken;
    res.json(normalizedData);
  } catch (error) {
    logger.error('Failed to fetch posts.');
    res.status(500).json({ success: false, error: 'GET_POSTS_FAILED', message: error.message });
  }
};

module.exports = handleGetPosts;
