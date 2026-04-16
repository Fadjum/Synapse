const gbpClient = require('../../utils/gbpClient');
const logger = require('../../utils/logger');

const handleDeletePost = async (req, res) => {
  const { postName } = req.body;

  if (!postName) {
    logger.error('Missing postName in request body.');
    return res.status(400).json({ success: false, message: 'Missing postName in request body.' });
  }

  try {
    logger.info(`Deleting post: ${postName}`);
    const result = await gbpClient.deletePost(postName);
    
    if (result.error) {
        logger.error(`GBP error deleting post: ${result.error}`);
        return res.status(500).json(result);
    }

    logger.info('Successfully deleted post.');
    res.json({ success: true });
  } catch (error) {
    logger.error(`Unexpected error deleting post: ${error.message}`);
    res.status(500).json({ success: false, error: 'DELETE_POST_FAILED', message: error.message });
  }
};

module.exports = handleDeletePost;
