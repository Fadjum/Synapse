const logger = require('../../utils/logger');

// Google discontinued the My Business Q&A API on November 3, 2025.
// The feature has been replaced by AI-powered Ask Maps (Gemini).
// There is no migration path or replacement API endpoint.
// Ref: https://developers.google.com/my-business/content/qanda/change-log

const handleFetchQuestions = async (req, res) => {
  logger.info('Q&A fetchQuestions called — API discontinued by Google Nov 2025');
  res.status(410).json({
    success: false,
    error: 'API_DISCONTINUED',
    message: 'The Google Business Profile Q&A API was permanently discontinued on November 3, 2025. Google replaced it with AI-powered Ask Maps (Gemini). No API replacement is available.'
  });
};

module.exports = handleFetchQuestions;
