const gbpClient = require('../../utils/gbpClient');
const logger = require('../../utils/logger');

const handleGetVerificationStatus = async (req, res) => {
  try {
    logger.info('Fetching verification status...');
    const data = await gbpClient.getVerificationStatus();

    if (data.error) {
        logger.error(`GBP error fetching verification: ${data.error}`);
        return res.status(500).json(data);
    }

    logger.info('Successfully fetched verification status.');
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Failed to fetch verification status.');
    res.status(500).json({ success: false, error: 'GET_VERIFICATION_STATUS_FAILED', message: error.message });
  }
};

module.exports = handleGetVerificationStatus;
