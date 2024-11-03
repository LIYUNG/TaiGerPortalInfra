import * as cdk from "aws-cdk-lib";
import path from "path";
import { Rule, RuleTargetInput, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

interface ServiceStackProps extends cdk.StackProps {
    stageName: string;
    domainStage: string;
    isProd: boolean;
    mongodbUriSecretName: string;
    mongoDBName: string;
    externalS3BucketName: string;
}

export class ServiceStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: ServiceStackProps) {
        super(scope, id, props);

        if (!props.env?.region) {
            throw new Error("Region is required");
        }

        const cronJobsLambda = new Function(this, `Cron-Jobs-${props.stageName}`, {
            runtime: Runtime.NODEJS_18_X,
            code: Code.fromAsset(path.join(__dirname, "..", "lambda", "cron-jobs")), // Use the zip artifact from CodeBuild
            memorySize: 512,
            handler: "index.handler",
            timeout: cdk.Duration.seconds(600) // Set timeout here (up to 600 seconds)
            // Adding environment variable for the S3 bucket name
            // environment: {
            //     MONGODB_URI_SECRET_NAME: props.mongodbUriSecretName,
            //     MONGODB_NAME: props.mongoDBName,
            //     REGION: props.env.region
            // }
        });

        // Define the first cron job (e.g., jobType: 'job1')
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
                event: RuleTargetInput.fromObject({ jobType: "job1" })
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
