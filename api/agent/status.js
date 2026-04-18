const autonomous = require('../../utils/autonomousAgent');
const { getUpcomingTopics } = require('../../utils/contentStrategy');
const logger = require('../../utils/logger');

/**
 * GET /api/agent/status
 * Snapshot of autonomous-agent state for the Autopilot UI panel.
 */
module.exports = async (req, res) => {
    try {
        const status = await autonomous.getStatus();
        res.json({
            success: true,
            status,
            calendar: getUpcomingTopics(7),
        });
    } catch (err) {
        logger.error('agent status failed: ' + err.message);
        res.status(500).json({ success: false, error: 'STATUS_FAILED', message: err.message });
    }
};
