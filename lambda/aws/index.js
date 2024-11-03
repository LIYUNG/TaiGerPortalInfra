const { S3Client } = require("@aws-sdk/client-s3");
const { SecretsManagerClient } = require("@aws-sdk/client-secrets-manager");

// Instantiate AWS SDK v3 clients
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const secretsManagerClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

module.exports = { s3Client, secretsManagerClient };
