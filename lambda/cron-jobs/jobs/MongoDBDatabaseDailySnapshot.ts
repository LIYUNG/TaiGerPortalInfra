import { PutObjectCommand, PutObjectCommandInput } from "@aws-sdk/client-s3";

import { connectToDatabase } from "../../db";
import { s3Client } from "../../aws";
import { transformDocument } from "../../common/utils";
import { requireEnv } from "../../common/env";

export async function MongoDBDatabaseDailySnapshot(): Promise<void> {
    console.log("Executing tasks for Job MongoDBDatabaseDailySnapshot...");
    const bucketName = requireEnv("INTERNAL_MONGODB_S3_BUCKET_NAME");
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
            const fileName = `${year}-${month}-${day}/${collectionName}.json`;

            // Upload JSON data to S3
            const uploadParams: PutObjectCommandInput = {
                Bucket: bucketName,
                Key: fileName,
                Body: jsonData,
                ContentType: "application/json"
            };
            const putObjectCommand = new PutObjectCommand(uploadParams);
            await s3Client.send(putObjectCommand);

            console.log(
                `Successfully backed up collection ${collectionName} to ${fileName} in bucket ${bucketName}`
            );
        });
        await Promise.all(backupPromises);
    } catch (error) {
        console.error("Error fetching data or uploading to S3:", error);
        throw error;
    }
}
