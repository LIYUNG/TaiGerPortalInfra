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
import { AWS_ACCOUNT, tenfoldAIRoleArn } from "../configuration";

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
        // Create the IAM Role in your account for the external account to assume
        let assumedBy: CompositePrincipal;
        if (props.isProd) {
            assumedBy = new CompositePrincipal(
                new ServicePrincipal("ec2.amazonaws.com"),
                new ArnPrincipal(tenfoldAIRoleArn)
            );
        } else {
            assumedBy = new CompositePrincipal(
                new ArnPrincipal(`arn:aws:iam::${AWS_ACCOUNT}:user/taiger_leo`),
                new ArnPrincipal(`arn:aws:iam::${AWS_ACCOUNT}:user/taiger_alex`),
                new ArnPrincipal(`arn:aws:iam::${AWS_ACCOUNT}:user/taiger_abby`)
            );
        }
        const crossAccountRole = new Role(this, "CrossAccountS3AccessRole", {
            assumedBy,
            description: "Allows external account IAM role to access S3 bucket objects"
        });

        // 2. Grant GetObject permission for /external-folder/* to the external IAM role
        crossAccountRole.addToPolicy(
            new PolicyStatement({
                actions: ["s3:GetObject"],
                resources: [`${bucket.bucketArn}/tenfold-ai-folder/*`]
            })
        );
    }
}
