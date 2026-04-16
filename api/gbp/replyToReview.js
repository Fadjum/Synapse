const gbpClient = require('../../utils/gbpClient');
const logger = require('../../utils/logger');

const handleReplyToReview = async (req, res) => {
  const { reviewName, replyText } = req.body;

  if (!reviewName || !replyText) {
    logger.error('Missing reviewName or replyText in request body.');
    return res.status(400).json({ success: false, message: 'Missing reviewName or replyText in request body.' });
  }

  try {
    logger.info(`Sending reply to review: ${reviewName}`);
    const result = await gbpClient.replyToReview(reviewName, replyText);
    
    if (result.success) {
      logger.info(`Successfully replied to review: ${reviewName}`);
      res.json(result);
    } else {
      logger.error(`Failed to reply to review ${reviewName}: ${result.error || result.message}`);
      res.status(500).json(result);
    }
  } catch (error) {
    logger.error(`Unexpected error replying to review ${reviewName}: ${error.message}`);
    res.status(500).json({ success: false, error: 'REPLY_TO_REVIEW_FAILED', message: error.message });
  }
};

module.exports = handleReplyToReview;
