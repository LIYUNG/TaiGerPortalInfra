const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { connectToDatabase } = require("../../db");
const { s3Client } = require("../../aws");

// Example function for Job MongoDBDataPipelineDailySnapshot
async function MongoDBDataPipelineDailySnapshot() {
    // Simulate some task for Job MongoDBDataPipelineDailySnapshot
    console.log("Executing tasks for Job MongoDBDataPipelineDailySnapshot...");
    // Add more logic as needed
    try {
        // Connect to MongoDB
        const db = await connectToDatabase();

        // Get a list of all collections in the database
        const collections = await db.listCollections().toArray();
        const currentDateTime = new Date();

        const year = currentDateTime.getUTCFullYear();
        const month = currentDateTime.getUTCMonth() + 1; // Months are zero-based, so we add 1
        const day = currentDateTime.getUTCDate();

        // Iterate over each collection and back up its data to S3
        for (const collectionInfo of collections) {
            const collectionName = collectionInfo.name;
            const collection = db.collection(collectionName);

            // Fetch all documents in the collection
            const data = await collection.find({}).toArray();
            const jsonData = JSON.stringify(data);

            // Create a unique filename with the timestamp for each collection
            const timestamp = new Date().toISOString();
            const fileName = `test-${year}-${month}-${day}/${collectionName}_${timestamp}.json`;

            // Upload JSON data to S3
            const uploadParams = {
                Bucket: process.env.EXTERNAL_S3_BUCKET_NAME,
                Key: fileName,
                Body: jsonData,
                ContentType: "application/json"
            };
            const putObjectCommand = new PutObjectCommand(uploadParams);
            await s3Client.send(putObjectCommand);

            console.log(
                `Successfully backed up collection ${collectionName} to ${fileName} in bucket ${process.env.EXTERNAL_S3_BUCKET_NAME}`
            );
        }
    } catch (error) {
        console.error("Error fetching data or uploading to S3:", error);
        throw error;
    }
}

module.exports = { MongoDBDataPipelineDailySnapshot };
