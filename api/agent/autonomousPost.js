const autonomous = require('../../utils/autonomousAgent');
const logger = require('../../utils/logger');

/**
 * POST /api/agent/autonomousPost
 * Optional body: { force?: boolean, dryRun?: boolean }
 *
 * Manually trigger the daily-post job. Idempotent: if a post already went
 * live today, returns a "skipped" report unless force=true.
 */
module.exports = async (req, res) => {
    try {
        const { force, dryRun } = req.body || {};
        if (dryRun) process.env.AUTOPILOT_POST_DRY_RUN = 'true';
        const report = await autonomous.runDailyPost({ force: !!force });
        res.json({ success: true, report });
    } catch (err) {
        logger.error('autonomousPost failed: ' + err.message);
        res.status(500).json({ success: false, error: 'AUTONOMOUS_POST_FAILED', message: err.message });
    }
};
