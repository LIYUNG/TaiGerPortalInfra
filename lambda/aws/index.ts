import { S3Client } from "@aws-sdk/client-s3";
import { SES, SendRawEmailCommand } from "@aws-sdk/client-ses";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

// Instantiate AWS SDK v3 clients
export const s3Client = new S3Client({ region: process.env.AWS_REGION });
export const secretsManagerClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

export const ses = new SES({
    region: process.env.AWS_REGION
});

export { SendRawEmailCommand };
