import * as cdk from "aws-cdk-lib";
import path from "path";
import { Rule, RuleTargetInput, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { InfraStack } from "./infrastack";

interface ServiceStackProps extends cdk.StackProps {
    stageName: string;
    domainStage: string;
    isProd: boolean;
    mongodbUriSecretName: string;
    mongoDBName: string;
    externalS3BucketName: string;
    infraStack: InfraStack;
}

export class ServiceStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: ServiceStackProps) {
        super(scope, id, props);

        if (!props.env?.region) {
            throw new Error("Region is required");
        }
        const lambdaAppDir = path.resolve(__dirname, "../lambda/cron-jobs");

        const cronJobsLambda = new NodejsFunction(this, `Cron-Jobs-${props.stageName}`, {
            entry: path.join(lambdaAppDir, "index.js"),
            handler: "handler",
            runtime: Runtime.NODEJS_18_X,
            memorySize: 512,
            timeout: cdk.Duration.seconds(600), // Set timeout here (up to 600 seconds)
            // Adding environment variable for the S3 bucket name
            environment: {
                MONGODB_URI_SECRET_NAME: props.mongodbUriSecretName,
                MONGODB_NAME: props.mongoDBName,
                EXTERNAL_S3_BUCKET_NAME: props.externalS3BucketName,
                REGION: props.env.region
            }
        });

        props.infraStack.externalBucket.grantPut(cronJobsLambda);

        // Define the first cron job (e.g., jobType: 'job1')
        // TODO: reverse condition when tested.
        if (!props.isProd) {
            const rule1 = new Rule(this, `CronRule1-${props.stageName}`, {
                schedule: Schedule.cron({
                    minute: "0",
                    hour: "*",
                    day: "*",
                    month: "*",
                    year: "*"
                })
            });
            rule1.addTarget(
                new LambdaFunction(cronJobsLambda, {
                    event: RuleTargetInput.fromObject({
                        jobType: "MongoDBDataPipelineDailySnapshot"
                    })
                })
            );

            // Define the second cron job (e.g., jobType: 'job2')
            const rule2 = new Rule(this, `CronRule2-${props.stageName}`, {
                schedule: Schedule.cron({
                    minute: "30",
                    hour: "14",
                    day: "*",
                    month: "*",
                    year: "*"
                })
            });

            rule2.addTarget(
                new LambdaFunction(cronJobsLambda, {
                    event: RuleTargetInput.fromObject({ jobType: "job2" })
                })
            );
        }
    }
}
