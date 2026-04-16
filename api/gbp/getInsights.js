const gbpClient = require('../../utils/gbpClient');
const { normalizeInsights } = require('../../utils/normalizeGBPResponse');
const logger = require('../../utils/logger');

const handleGetInsights = async (req, res) => {
  try {
    logger.info('Fetching daily insights...');
    const rawData = await gbpClient.getInsights();

    if (rawData.error) {
        logger.error(`GBP error fetching insights: ${rawData.error}`);
        return res.status(500).json(rawData);
    }

    const normalizedData = normalizeInsights(rawData);
    logger.info('Successfully fetched and normalized insights.');
    res.json(normalizedData);
  } catch (error) {
    logger.error('Failed to fetch insights.');
    res.status(500).json({ success: false, error: 'GET_INSIGHTS_FAILED', message: error.message });
  }
};

module.exports = handleGetInsights;
