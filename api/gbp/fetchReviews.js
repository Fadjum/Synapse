const gbpClient = require('../../utils/gbpClient');
const { normalizeReviews } = require('../../utils/normalizeGBPResponse');
const logger = require('../../utils/logger');

const handleGetReviews = async (req, res) => {
  try {
    logger.info('Fetching reviews...');
    const rawData = await gbpClient.fetchReviews(req.query.pageToken || null);
    if (rawData && rawData.error) {
      logger.error(`GBP error fetching reviews: ${rawData.error}`);
      return res.status(500).json(rawData);
    }
    const normalizedData = normalizeReviews(rawData);
    logger.info('Successfully fetched and normalized reviews.');
    // Pass nextPageToken through so callers know if more pages exist
    if (rawData.nextPageToken) normalizedData.nextPageToken = rawData.nextPageToken;
    res.status(200).json(normalizedData);
  } catch (error) {
    logger.error('Failed to fetch reviews.');
    res.status(500).json({
      success: false,
      error: "GBP_FETCH_FAILED"
    });
  }
};

module.exports = handleGetReviews;
