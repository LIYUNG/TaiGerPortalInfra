import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { InfraStack } from "./infrastack";
import { CronJobsConstruct } from "../constructs";
import { CRON_JOBS } from "../configuration";

interface ServiceStackProps extends cdk.StackProps {
    stageName: string;
    domainStage: string;
    isProd: boolean;
    mongodbUriSecretName: string;
    mongoDBName: string;
    externalS3BucketName: string;
    internalMongodbS3BucketName: string;
    infraStack: InfraStack;
}

export class ServiceStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: ServiceStackProps) {
        super(scope, id, props);

        if (!props.env?.region) {
            throw new Error("Region is required");
        }

        new CronJobsConstruct(this, `CronJobs-${props.stageName}`, {
            stageName: props.stageName,
            isProd: props.isProd,
            region: props.env.region,
            mongodbUriSecretName: props.mongodbUriSecretName,
            mongoDBName: props.mongoDBName,
            externalS3BucketName: props.externalS3BucketName,
            internalMongodbS3BucketName: props.internalMongodbS3BucketName,
            infraStack: props.infraStack,
            cronJobs: CRON_JOBS
        });
    }
}
