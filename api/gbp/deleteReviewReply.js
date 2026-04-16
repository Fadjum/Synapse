const gbpClient = require('../../utils/gbpClient');
const logger = require('../../utils/logger');

const handleDeleteReviewReply = async (req, res) => {
  const { reviewName } = req.body;

  if (!reviewName) {
    logger.error('Missing reviewName in request body.');
    return res.status(400).json({ success: false, message: 'Missing reviewName in request body.' });
  }

  try {
    logger.info(`Deleting reply for review: ${reviewName}`);
    const result = await gbpClient.deleteReviewReply(reviewName);

    if (result.success) {
      logger.info(`Successfully deleted reply for review: ${reviewName}`);
      res.json(result);
    } else {
      logger.error(`Failed to delete reply for review ${reviewName}: ${result.error || result.message}`);
      res.status(500).json(result);
    }
  } catch (error) {
    logger.error(`Unexpected error deleting reply for review ${reviewName}: ${error.message}`);
    res.status(500).json({ success: false, error: 'DELETE_REPLY_FAILED', message: error.message });
  }
};

module.exports = handleDeleteReviewReply;
