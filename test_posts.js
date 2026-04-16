require('dotenv').config();
const gbpClient = require('./utils/gbpClient');
const { normalizePosts } = require('./utils/normalizeGBPResponse');

async function test() {
    try {
        const rawData = await gbpClient.getPosts();
        if (rawData.error) {
            console.error("Error:", rawData);
            return;
        }
        const normalized = normalizePosts(rawData);
        console.log(JSON.stringify(normalized, null, 2));
    } catch (error) {
        console.error("Failed:", error.message);
    }
}
test();
