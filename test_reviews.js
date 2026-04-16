require('dotenv').config();
const gbpClient = require('./utils/gbpClient');
const { normalizeReviews } = require('./utils/normalizeGBPResponse');

async function test() {
    try {
        console.log("Testing fetchReviews...");
        const rawData = await gbpClient.fetchReviews();
        if (rawData.error) {
            console.error("Error:", rawData);
            return;
        }
        console.log("Raw Data keys:", Object.keys(rawData));
        const normalized = normalizeReviews(rawData);
        console.log("Normalized Reviews (first 2):", JSON.stringify(normalized.reviews.slice(0, 2), null, 2));
        console.log("Total Count:", normalized.totalReviewCount);
    } catch (error) {
        console.error("Failed:", error.message);
    }
}
test();
