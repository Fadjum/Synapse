require('dotenv').config();
const gbpClient = require('./utils/gbpClient');
const { normalizeMedia } = require('./utils/normalizeGBPResponse');

async function testMedia() {
    try {
        console.log("Testing listMedia...");
        const rawData = await gbpClient.listMedia();
        if (rawData.error) {
            console.error("Error listing media:", JSON.stringify(rawData, null, 2));
            return;
        }
        console.log("Raw Media keys:", Object.keys(rawData));
        const normalized = normalizeMedia(rawData);
        console.log("Normalized Media (first 2):", JSON.stringify(normalized.media.slice(0, 2), null, 2));
        console.log("Total Media Items:", normalized.media.length);
    } catch (error) {
        console.error("Failed:", error.message);
    }
}

testMedia();
