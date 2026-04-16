require('dotenv').config({ path: __dirname + '/.env' });
const gbpClient = require('./utils/gbpClient');
const { normalizeProfile } = require('./utils/normalizeGBPResponse');

async function test() {
    try {
        console.log("Fetching raw profile data...");
        const rawData = await gbpClient.getProfile();
        if (rawData.error) {
            console.error("Error:", rawData);
            return;
        }
        console.log("Raw Profile Data:", JSON.stringify(rawData, null, 2));
        
        console.log("\nNormalizing profile data...");
        const normalized = normalizeProfile(rawData);
        console.log("Normalized Profile Data:", JSON.stringify(normalized, null, 2));
    } catch (error) {
        console.error("Failed:", error.message);
    }
}
test();
