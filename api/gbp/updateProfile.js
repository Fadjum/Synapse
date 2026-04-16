const gbpClient = require('../../utils/gbpClient');
const logger = require('../../utils/logger');

const handleUpdateProfile = async (req, res) => {
  const { updateData, updateMask } = req.body;

  if (!updateData || !updateMask) {
    logger.error('Missing updateData or updateMask in request body.');
    return res.status(400).json({ success: false, message: 'Missing updateData or updateMask in request body.' });
  }

  try {
    logger.info(`Updating profile with mask: ${updateMask}`);
    const result = await gbpClient.updateProfile(updateData, updateMask);
    
    if (result.error) {
        logger.error(`GBP error updating profile: ${result.error}`);
        return res.status(500).json(result);
    }

    logger.info('Successfully updated profile.');
    res.json({ success: true, profile: result });
  } catch (error) {
    logger.error(`Unexpected error updating profile: ${error.message}`);
    res.status(500).json({ success: false, error: 'UPDATE_PROFILE_FAILED', message: error.message });
  }
};

module.exports = handleUpdateProfile;
