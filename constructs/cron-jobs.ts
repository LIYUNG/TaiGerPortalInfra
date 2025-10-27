import * as cdk from "aws-cdk-lib";
import path from "path";
import { Rule, Schedule, RuleTargetInput } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Bucket } from "aws-cdk-lib/aws-s3";

import { InfraStack } from "../lib/infrastack";
import { CronJobConfig } from "../types/cron-jobs";
import { Construct } from "constructs";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { AWS_ACCOUNT } from "../configuration";

export interface CronJobsProps {
    stageName: string;
    isProd: boolean;
    region: string;
    mongodbUriSecretName: string;
    mongoDBName: string;
    externalS3BucketName: string;
    internalMongodbS3BucketName: string;
    infraStack: InfraStack;
    cronJobs: CronJobConfig[];
    origin: string;
}

export class CronJobsConstruct extends Construct {
    public readonly lambda: NodejsFunction;

    constructor(scope: Construct, id: string, props: CronJobsProps) {
        super(scope, id);

        const lambdaAppDir = path.resolve(__dirname, "../lambda/cron-jobs");

        const bucket = Bucket.fromBucketName(
            this,
            `mongodb-backup-${props.stageName}`,
            props.internalMongodbS3BucketName
        );

        const secret = Secret.fromSecretNameV2(
            this,
            `mongodb-uri-${props.stageName}`,
            props.mongodbUriSecretName
        );

        // Create the Lambda function
        this.lambda = new NodejsFunction(this, `Cron-Jobs-${props.stageName}`, {
            entry: path.join(lambdaAppDir, "index.js"),
            handler: "handler",
            runtime: Runtime.NODEJS_20_X,
            memorySize: 512,
            timeout: cdk.Duration.seconds(600), // Set timeout here (up to 600 seconds)
            // Adding environment variable for the S3 bucket name
            reservedConcurrentExecutions: 10,
            environment: {
                MONGODB_URI_SECRET_NAME: props.mongodbUriSecretName,
                MONGODB_NAME: props.mongoDBName,
                EXTERNAL_S3_BUCKET_NAME: props.externalS3BucketName,
                INTERNAL_MONGODB_S3_BUCKET_NAME: props.internalMongodbS3BucketName,
                REGION: props.region,
                ORIGIN: props.origin
            }
        });

        // Grant Lambda permission to read the secret
        secret.grantRead(this.lambda);
        props.infraStack.externalBucket.grantPut(this.lambda);
        bucket.grantPut(this.lambda);

        // Create cron rules only in production
        if (props.isProd) {
            this.lambda.addToRolePolicy(
                new PolicyStatement({
                    actions: ["ses:SendEmail", "ses:SendRawEmail"],
                    resources: [
                        `arn:aws:ses:${props.region}:${AWS_ACCOUNT}:identity/taigerconsultancy-portal.com`
                    ]
                })
            );
            this.createCronRules(props.cronJobs, props.stageName);
        }
    }

    private createCronRules(cronJobs: CronJobConfig[], stageName: string): void {
        cronJobs.forEach((jobConfig, index) => {
            const rule = new Rule(this, `CronRule${index + 1}-${stageName}`, {
                schedule: Schedule.cron(jobConfig.schedule),
                description: jobConfig.description
            });

            rule.addTarget(
                new LambdaFunction(this.lambda, {
                    event: RuleTargetInput.fromObject({
                        jobType: jobConfig.jobType
                    })
                })
            );
        });
    }
}
