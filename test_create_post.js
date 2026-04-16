require('dotenv').config();
const gbpClient = require('./utils/gbpClient');

async function testCreatePost() {
    try {
        console.log("Testing createPost...");
        const postData = {
            languageCode: "en",
            summary: "Test post from Synapse CLI - " + new Date().toISOString(),
            topicType: "STANDARD",
            callToAction: {
                actionType: "LEARN_MORE",
                url: "https://eritageentcare.com"
            }
        };
        const result = await gbpClient.createPost(postData);
        if (result.error) {
            console.error("Error creating post:", JSON.stringify(result, null, 2));
            return;
        }
        console.log("Post Created Successfully:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Failed:", error.message);
    }
}

testCreatePost();
