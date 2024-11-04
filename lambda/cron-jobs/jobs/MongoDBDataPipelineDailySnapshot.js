const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { connectToDatabase } = require("../../db");
const { s3Client } = require("../../aws");
const { ObjectId } = require("mongodb");

// Example function for Job MongoDBDataPipelineDailySnapshot
function transformDocument(doc) {
    if (Array.isArray(doc)) {
        return doc.map(transformDocument); // Recursively process arrays
    } else if (doc instanceof ObjectId) {
        return { $oid: doc.toString() }; // Transform ObjectId
    } else if (doc instanceof Date) {
        return { $date: doc.toISOString() }; // Transform Date to ISO format
    } else if (typeof doc === "object" && doc !== null) {
        const transformed = {};
        for (let key in doc) {
            if (doc.hasOwnProperty(key)) {
                transformed[key] = transformDocument(doc[key]); // Recursively process objects
            }
        }
        return transformed;
    }
    return doc; // Return primitive types as is
}

async function MongoDBDataPipelineDailySnapshot() {
    console.log("Executing tasks for Job MongoDBDataPipelineDailySnapshot...");
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
        const backupPromises = collections.map(async (collectionInfo) => {
            const collectionName = collectionInfo.name;
            const collection = db.collection(collectionName);

            // Fetch all documents in the collection
            const documents = await collection.find({}).toArray();
            // Transform each document
            const transformedData = documents.map((doc) => transformDocument(doc));
            const jsonData = JSON.stringify(transformedData);

            // Create a unique filename with the timestamp for each collection
            const fileName = `test-${year}-${month}-${day}/${collectionName}.json`;

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
        });
        await Promise.all(backupPromises);
    } catch (error) {
        console.error("Error fetching data or uploading to S3:", error);
        throw error;
    }
}

module.exports = { MongoDBDataPipelineDailySnapshot };
