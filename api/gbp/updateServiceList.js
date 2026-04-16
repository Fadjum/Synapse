const gbpClient = require('../../utils/gbpClient');
const logger = require('../../utils/logger');

const handleUpdateServiceList = async (req, res) => {
  const { serviceListData, updateMask } = req.body;

  if (!serviceListData) {
    logger.error('Missing serviceListData in request body.');
    return res.status(400).json({ success: false, message: 'Missing serviceListData in request body.' });
  }

  const mask = updateMask || 'serviceItems';

  try {
    logger.info(`Updating service list with mask: ${mask}`);
    const result = await gbpClient.updateServiceList(serviceListData, mask);
    
    if (result.error) {
        logger.error(`GBP error updating service list: ${result.error}`);
        return res.status(500).json(result);
    }

    logger.info('Successfully updated service list.');
    res.json({ success: true, serviceList: result });
  } catch (error) {
    logger.error(`Unexpected error updating service list: ${error.message}`);
    res.status(500).json({ success: false, error: 'UPDATE_SERVICE_LIST_FAILED', message: error.message });
  }
};

module.exports = handleUpdateServiceList;
