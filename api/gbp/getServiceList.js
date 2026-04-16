const gbpClient = require('../../utils/gbpClient');
const { normalizeServices } = require('../../utils/normalizeGBPResponse');
const logger = require('../../utils/logger');

const handleGetServiceList = async (req, res) => {
  try {
    logger.info('Fetching service list...');
    const rawData = await gbpClient.getServiceList();
    if (rawData && rawData.error) {
      logger.error(`GBP error fetching service list: ${rawData.error}`);
      return res.status(500).json(rawData);
    }
    const normalizedData = normalizeServices(rawData);
    logger.info('Successfully fetched and normalized service list.');
    res.status(200).json(normalizedData);
  } catch (error) {
    logger.error('Failed to fetch service list.');
    res.status(500).json({
      success: false,
      error: "GBP_SERVICE_LIST_FETCH_FAILED"
    });
  }
};

module.exports = handleGetServiceList;
