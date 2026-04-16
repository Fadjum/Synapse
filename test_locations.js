require('dotenv').config();
const gbpClient = require('./utils/gbpClient');

async function test() {
    try {
        console.log("Testing getLocations...");
        const data = await gbpClient.getLocations();
        if (data.error) {
            console.error("Error:", data);
            return;
        }
        console.log("Locations found:", JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Failed:", error.message);
    }
}
test();
