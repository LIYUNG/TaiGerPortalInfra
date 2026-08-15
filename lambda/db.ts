import { Db, MongoClient } from "mongodb";
import { GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

import { secretsManagerClient } from "./aws";
import { requireEnv } from "./common/env";

let cachedDb: Db | null = null;

// Helper function to get the MongoDB URI from Secrets Manager
async function getMongoDbUri(): Promise<string> {
    try {
        // Secrets Manager secret name holding the connection string.
        const command = new GetSecretValueCommand({
            SecretId: requireEnv("MONGODB_URI_SECRET_NAME")
        });
        const secretValue = await secretsManagerClient.send(command);

        if (secretValue?.SecretString) {
            return secretValue.SecretString; // Replace this key with the exact key in your secret
        }
        throw new Error("MONGODB_URI not found in secret.");
    } catch (error) {
        console.error("Error retrieving MongoDB URI from Secrets Manager:", error);
        throw error;
    }
}

// Helper function to connect to MongoDB
export async function connectToDatabase(): Promise<Db> {
    if (cachedDb) {
        return cachedDb;
    }
    const mongoUri = await getMongoDbUri();
    const client = new MongoClient(mongoUri);
    await client.connect();
    // MongoDB database name.
    cachedDb = client.db(requireEnv("MONGODB_NAME"));
    return cachedDb;
}
