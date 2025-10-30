import * as cdk from "aws-cdk-lib";
import { Duration, RemovalPolicy, SecretValue } from "aws-cdk-lib";
import { CodePipeline, CodePipelineSource, ShellStep } from "aws-cdk-lib/pipelines";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import {
    GITHUB_OWNER,
    GITHUB_PACKAGE_BRANCH,
    GITHUB_REPO,
    GITHUB_TOKEN
} from "../configuration/dependencies";
import { PipelineAppStage } from "./app-stage";
import { Region, STAGES } from "../constants";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";

export class TaiGerPortalInfraStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Define the source for the pipeline
        const source = CodePipelineSource.gitHub(
            `${GITHUB_OWNER}/${GITHUB_REPO}`,
            GITHUB_PACKAGE_BRANCH,
            {
                authentication: SecretValue.secretsManager(GITHUB_TOKEN),
                trigger: codepipeline_actions.GitHubTrigger.WEBHOOK
            }
        );

        // Create the high-level CodePipeline
        const pipeline = new CodePipeline(this, "Pipeline", {
            pipelineName: "TaiGerPortalInfraPipeline",
            crossRegionReplicationBuckets: {
                [Region.IAD]: new Bucket(
                    this,
                    `${GITHUB_REPO}-ReplicationArtifactBucket-${Region.IAD}`,
                    {
                        bucketName: `${GITHUB_REPO}-pipeline-bucket-${Region.IAD}`.toLowerCase(),
                        removalPolicy: RemovalPolicy.DESTROY,
                        autoDeleteObjects: true,
                        versioned: false,
                        enforceSSL: true,
                        encryption: BucketEncryption.S3_MANAGED,
                        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
                        lifecycleRules: [{ expiration: Duration.days(30) }]
                    }
                ),
                [Region.NRT]: new Bucket(
                    this,
                    `${GITHUB_REPO}-ReplicationArtifactBucket-${Region.NRT}`,
                    {
                        bucketName: `${GITHUB_REPO}-pipeline-bucket-${Region.NRT}`.toLowerCase(),
                        removalPolicy: RemovalPolicy.DESTROY,
                        autoDeleteObjects: true,
                        versioned: false,
                        enforceSSL: true,
                        encryption: BucketEncryption.S3_MANAGED,
                        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
                        lifecycleRules: [{ expiration: Duration.days(30) }]
                    }
                )
            },
            synth: new ShellStep("Synth", {
                input: source,
                commands: ["npm ci", "npm run build", "npx cdk synth"]
            }),
            codeBuildDefaults: {
                rolePolicy: [
                    new PolicyStatement({
                        actions: [
                            "route53:ListHostedZonesByName",
                            "route53:GetHostedZone",
                            "route53:ListHostedZones"
                        ],
                        resources: ["*"]
                    })
                ]
            }
        });

        STAGES.forEach(
            ({
                stageName,
                env,
                domainStage,
                isProd,
                mongodbUriSecretName,
                mongoDBName,
                externalS3BucketName,
                internalMongodbS3BucketName,
                origin
            }) => {
                const stage = new PipelineAppStage(this, `${stageName}-Stage`, {
                    env,
                    stageName,
                    domainStage,
                    isProd,
                    mongodbUriSecretName,
                    mongoDBName,
                    externalS3BucketName,
                    internalMongodbS3BucketName,
                    origin
                });
                pipeline.addStage(stage);
            }
        );
    }
}
