const gbpClient = require('../../utils/gbpClient');
const logger = require('../../utils/logger');

const handleUploadMedia = async (req, res) => {
  const { mediaData } = req.body;

  if (!mediaData) {
    logger.error('Missing mediaData in request body.');
    return res.status(400).json({ success: false, message: 'Missing mediaData in request body.' });
  }

  // GBP Media API requires mediaFormat and sourceUrl
  if (!mediaData.mediaFormat || !['PHOTO', 'VIDEO'].includes(mediaData.mediaFormat)) {
    logger.error(`Invalid mediaFormat: ${mediaData.mediaFormat}`);
    return res.status(400).json({ success: false, message: 'mediaData.mediaFormat is required and must be "PHOTO" or "VIDEO".' });
  }
  if (!mediaData.sourceUrl) {
    logger.error('Missing mediaData.sourceUrl.');
    return res.status(400).json({ success: false, message: 'mediaData.sourceUrl is required (publicly accessible URL of the image or video).' });
  }

  try {
    logger.info(`Uploading ${mediaData.mediaFormat} item from ${mediaData.sourceUrl}...`);
    const result = await gbpClient.uploadMedia(mediaData);
    
    if (result.error) {
        logger.error(`GBP error uploading media: ${result.error}`);
        return res.status(500).json(result);
    }

    logger.info(`Successfully uploaded media: ${result.name || 'Unknown'}`);
    res.json({ success: true, media: result });
  } catch (error) {
    logger.error(`Unexpected error uploading media: ${error.message}`);
    res.status(500).json({ success: false, error: 'UPLOAD_MEDIA_FAILED', message: error.message });
  }
};

module.exports = handleUploadMedia;
