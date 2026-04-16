const gbpClient = require('../../utils/gbpClient');
const { normalizeAttributes } = require('../../utils/normalizeGBPResponse');
const logger = require('../../utils/logger');

const handleGetAttributes = async (req, res) => {
  try {
    logger.info('Fetching attributes...');
    const rawData = await gbpClient.getAttributes();

    if (rawData.error) {
        logger.error(`GBP error fetching attributes: ${rawData.error}`);
        return res.status(500).json(rawData);
    }

    const normalizedData = normalizeAttributes(rawData);
    logger.info('Successfully fetched and normalized attributes.');
    res.json(normalizedData);
  } catch (error) {
    logger.error('Failed to fetch attributes.');
    res.status(500).json({ success: false, error: 'GET_ATTRIBUTES_FAILED', message: error.message });
  }
};

module.exports = handleGetAttributes;
