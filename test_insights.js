require('dotenv').config({ path: __dirname + '/.env' });
const gbpClient = require('./utils/gbpClient');
const { normalizeInsights } = require('./utils/normalizeGBPResponse');

async function test() {
    try {
        console.log("Fetching raw insights data (Last 28 Days)...");
        const rawData = await gbpClient.getInsights();
        
        if (rawData.error) {
            console.error("Error:", JSON.stringify(rawData, null, 2));
            return;
        }
        
        console.log("Raw Insights Data (First Metric):", JSON.stringify(rawData.multiDailyMetricTimeSeries[0], null, 2));
        
        console.log("\nNormalizing insights data...");
        const normalized = normalizeInsights(rawData);
        console.log("Normalized Insights Data Summary:", JSON.stringify(normalized, null, 2));
    } catch (error) {
        console.error("Failed:", error.message);
    }
}
test();
