const autonomous = require('../../utils/autonomousAgent');
const logger = require('../../utils/logger');

/**
 * POST /api/agent/autoReplyReviews
 * Optional body: { maxReplies?: number, dryRun?: boolean }
 *
 * Drafts and publishes replies to safe (4★/5★, unanswered) reviews.
 */
module.exports = async (req, res) => {
    try {
        const { maxReplies, dryRun } = req.body || {};
        if (dryRun) process.env.AUTOPILOT_REPLY_DRY_RUN = 'true';
        const report = await autonomous.runAutoReplies({
            maxReplies: Number.isFinite(maxReplies) ? maxReplies : 5,
        });
        res.json({ success: true, report });
    } catch (err) {
        logger.error('autoReplyReviews failed: ' + err.message);
        res.status(500).json({ success: false, error: 'AUTO_REPLY_FAILED', message: err.message });
    }
};
