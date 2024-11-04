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
import { AWS_ACCOUNT, tenfoldAIAssumeRoleArn, tenfoldAIRoleArn } from "../configuration";

interface InfraStackProps extends cdk.StackProps {
    stageName: string;
    domainStage: string;
    isProd: boolean;
    mongodbUriSecretName: string;
    mongoDBName: string;
    externalS3BucketName: string;
}

export class InfraStack extends cdk.Stack {
    public externalBucket: Bucket;
    constructor(scope: Construct, id: string, props: InfraStackProps) {
        super(scope, id, props);

        // 1. Create the S3 Bucket
        this.externalBucket = new Bucket(this, `ExternalBucket-${props.stageName}`, {
            bucketName: props.externalS3BucketName,
            versioned: false,
            removalPolicy: cdk.RemovalPolicy.DESTROY // For testing; in production, consider RETAIN
        });
        // Create the IAM Role in your account for the external account to assume
        let assumedBy: CompositePrincipal;
        if (props.isProd) {
            assumedBy = new CompositePrincipal(
                new ServicePrincipal("ec2.amazonaws.com"),
                new ArnPrincipal(tenfoldAIAssumeRoleArn),
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
                actions: ["s3:GetObject", "s3:GetObjectVersion"],
                resources: [`${this.externalBucket.bucketArn}/tenfold-ai-folder/*`]
            })
        );

        // 3. Grant ListBucket permission for the prefix
        crossAccountRole.addToPolicy(
            new PolicyStatement({
                actions: [
                    "s3:ListBucket",
                    "s3:GetBucketLocation", // Often required for SDK operations
                    "s3:ListBucketVersions"
                ],
                resources: [this.externalBucket.bucketArn],
                conditions: {
                    StringLike: {
                        "s3:prefix": [
                            "tenfold-ai-folder/*",
                            "tenfold-ai-folder" // Include the prefix itself
                        ]
                    }
                }
            })
        );
    }
}
