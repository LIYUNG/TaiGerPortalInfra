import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
    ArnPrincipal,
    CompositePrincipal,
    PolicyStatement,
    Role,
    ServicePrincipal
} from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { tenfoldAIRoleArn } from "../configuration";

interface InfraStackProps extends cdk.StackProps {
    stageName: string;
    domainStage: string;
    isProd: boolean;
    mongodbUriSecretName: string;
    mongoDBName: string;
    externalS3BucketName: string;
}

export class InfraStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: InfraStackProps) {
        super(scope, id, props);

        // 1. Create the S3 Bucket
        const bucket = new Bucket(this, `ExternalBucket-${props.stageName}`, {
            bucketName: props.externalS3BucketName,
            versioned: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY // For testing; in production, consider RETAIN
        });

        // 2. Grant GetObject permission for /external-folder/* to the external IAM role
        bucket.addToResourcePolicy(
            new PolicyStatement({
                actions: ["s3:GetObject"],
                resources: [`${bucket.bucketArn}/tenfold-ai-folder/*`],
                principals: [new ArnPrincipal(tenfoldAIRoleArn)]
            })
        );
    }
}
