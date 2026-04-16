const gbpClient = require('../../utils/gbpClient');
const { normalizeMedia } = require('../../utils/normalizeGBPResponse');
const logger = require('../../utils/logger');

const handleListMedia = async (req, res) => {
  try {
    logger.info('Listing media items...');
    const rawData = await gbpClient.listMedia(req.query.pageToken || null);
    if (rawData && rawData.error) {
      logger.error(`GBP error listing media: ${rawData.error}`);
      return res.status(500).json(rawData);
    }
    const normalizedData = normalizeMedia(rawData);
    logger.info('Successfully listed and normalized media items.');
    if (rawData.nextPageToken) normalizedData.nextPageToken = rawData.nextPageToken;
    res.status(200).json(normalizedData);
  } catch (error) {
    logger.error('Failed to list media.');
    res.status(500).json({
      success: false,
      error: "GBP_MEDIA_LIST_FAILED"
    });
  }
};

module.exports = handleListMedia;
