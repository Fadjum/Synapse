const gbpClient = require('../../utils/gbpClient');
const logger = require('../../utils/logger');

const handleCreatePost = async (req, res) => {
  const { postData } = req.body;

  if (!postData) {
    logger.error('Missing postData in request body.');
    return res.status(400).json({ success: false, message: 'Missing postData in request body.' });
  }

  // Set default topicType to STANDARD if not provided
  if (!postData.topicType) {
    postData.topicType = 'STANDARD';
  }

  // GBP API requires languageCode and summary on every post
  if (!postData.languageCode) {
    logger.error('postData.languageCode is required.');
    return res.status(400).json({ success: false, message: 'postData.languageCode is required (e.g. "en").' });
  }
  if (!postData.summary) {
    logger.error('postData.summary is required.');
    return res.status(400).json({ success: false, message: 'postData.summary is required (max 1500 characters).' });
  }
  if (postData.summary.length > 1500) {
    logger.error(`postData.summary exceeds limit: ${postData.summary.length}`);
    return res.status(400).json({ success: false, message: `postData.summary exceeds 1500 character limit (got ${postData.summary.length}).` });
  }

  try {
    logger.info('Creating local post...');
    const result = await gbpClient.createPost(postData);
    
    if (result.error) {
        logger.error(`GBP error creating post: ${result.error}`);
        return res.status(500).json(result);
    }

    logger.info(`Successfully created post: ${result.name || 'Unknown'}`);
    res.json({ success: true, post: result });
  } catch (error) {
    logger.error(`Unexpected error creating post: ${error.message}`);
    res.status(500).json({ success: false, error: 'CREATE_POST_FAILED', message: error.message });
  }
};

module.exports = handleCreatePost;
