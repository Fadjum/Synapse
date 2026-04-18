const gbpClient = require('../../utils/gbpClient');
const logger = require('../../utils/logger');

const handleGetLocations = async (req, res) => {
  try {
    logger.info('Listing all locations for the account...');
    const data = await gbpClient.getLocations();
    
    if (data.error) {
        return res.status(500).json(data);
    }

    logger.info('Successfully listed locations.');
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Failed to list locations.');
    res.status(500).json({ success: false, error: 'LIST_LOCATIONS_FAILED', message: error.message });
  }
};

module.exports = handleGetLocations;
