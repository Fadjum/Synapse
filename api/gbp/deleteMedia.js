const gbpClient = require('../../utils/gbpClient');
const logger = require('../../utils/logger');

const handleDeleteMedia = async (req, res) => {
  const { mediaId } = req.body;

  if (!mediaId) {
    logger.error('Missing mediaId in request body.');
    return res.status(400).json({ success: false, message: 'Missing mediaId in request body.' });
  }

  try {
    logger.info(`Deleting media item: ${mediaId}`);
    const result = await gbpClient.deleteMedia(mediaId);

    if (result.success) {
      logger.info(`Successfully deleted media item: ${mediaId}`);
      res.json(result);
    } else {
      logger.error(`Failed to delete media ${mediaId}: ${result.error || result.message}`);
      res.status(500).json(result);
    }
  } catch (error) {
    logger.error(`Unexpected error deleting media ${mediaId}: ${error.message}`);
    res.status(500).json({ success: false, error: 'DELETE_MEDIA_FAILED', message: error.message });
  }
};

module.exports = handleDeleteMedia;
