const { MongoClient } = require("mongodb");
const { GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { secretsManagerClient } = require("./aws");

// Configuration for MongoDB and S3
const mongoDBName = process.env.MONGODB_NAME; // MongoDB database name
const mongodbUriSecretName = process.env.MONGODB_URI_SECRET_NAME; // Secrets Manager secret name

let cachedDb = null;

// Helper function to get the MongoDB URI from Secrets Manager
async function getMongoDbUri() {
    try {
        const command = new GetSecretValueCommand({ SecretId: mongodbUriSecretName });
        const secretValue = await secretsManagerClient.send(command);

        if (secretValue && secretValue.SecretString) {
            return secretValue.SecretString; // Replace this key with the exact key in your secret
        }
        throw new Error("MONGODB_URI not found in secret.");
    } catch (error) {
        console.error("Error retrieving MongoDB URI from Secrets Manager:", error);
        throw error;
    }
}

// Helper function to connect to MongoDB
async function connectToDatabase() {
    if (cachedDb) {
        return cachedDb;
    }
    const mongoUri = await getMongoDbUri();
    const client = new MongoClient(mongoUri);
    await client.connect();
    cachedDb = client.db(mongoDBName);
    return cachedDb;
}

module.exports = { connectToDatabase };
