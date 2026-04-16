const gbpClient = require('../../utils/gbpClient');
const logger = require('../../utils/logger');

const handleUpdateAttributes = async (req, res) => {
  try {
    const { attributeData } = req.body;
    if (!attributeData) {
      return res.status(400).json({ success: false, error: 'MISSING_DATA', message: 'attributeData is required.' });
    }

    logger.info('Updating attributes...');
    const result = await gbpClient.updateAttributes(attributeData);

    if (result.error) {
        logger.error(`GBP error updating attributes: ${result.error}`);
        return res.status(500).json(result);
    }

    logger.info('Successfully updated attributes.');
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to update attributes.');
    res.status(500).json({ success: false, error: 'UPDATE_ATTRIBUTES_FAILED', message: error.message });
  }
};

module.exports = handleUpdateAttributes;
