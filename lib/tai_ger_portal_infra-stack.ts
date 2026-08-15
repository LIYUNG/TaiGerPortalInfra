import * as cdk from "aws-cdk-lib";
import { Duration, RemovalPolicy, SecretValue } from "aws-cdk-lib";
import {
    CodeBuildStep,
    CodePipeline,
    CodePipelineSource,
    ManualApprovalStep
} from "aws-cdk-lib/pipelines";
import { PipelineType } from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import { BuildSpec, LinuxBuildImage } from "aws-cdk-lib/aws-codebuild";
import {
    APP_NAME,
    GITHUB_OWNER,
    GITHUB_PACKAGE_BRANCH,
    GITHUB_REPO,
    GITHUB_TOKEN
} from "../configuration/dependencies";
import { PipelineAppStage } from "./app-stage";
import { STAGES } from "../constants";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";

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

        const synthStep = new CodeBuildStep("Synth", {
            input: source,
            commands: [
                "npm ci",
                // The Lambda sources are TypeScript now and are bundled by
                // esbuild inside `cdk synth`, which does no type checking.
                // Type-check, lint and unit-test them here so a broken
                // handler fails the build instead of shipping.
                "npm run typecheck",
                "npm run lint",
                "npm run test",
                "npm run build",
                "npx cdk synth"
            ],
            logging: {
                cloudWatch: {
                    logGroup: new LogGroup(this, `${APP_NAME}Synth-LogGroup`, {
                        logGroupName: `/aws/codepipeline/synth/${APP_NAME}`,
                        retention: RetentionDays.SIX_MONTHS,
                        removalPolicy: RemovalPolicy.DESTROY
                    })
                }
            },
            partialBuildSpec: BuildSpec.fromObject({
                version: "0.2",
                phases: {
                    install: {
                        "runtime-versions": {
                            nodejs: 22
                        }
                    }
                }
            })
        });

        // Create the high-level CodePipeline
        const pipeline = new CodePipeline(this, "Pipeline", {
            pipelineName: "TaiGerPortalInfraPipeline",
            pipelineType: PipelineType.V2,
            artifactBucket: new Bucket(this, `${GITHUB_REPO}-ArtifactBucket`, {
                bucketName: `${GITHUB_REPO}-pipeline-artifact-bucket`.toLowerCase(),
                removalPolicy: RemovalPolicy.DESTROY,
                autoDeleteObjects: true,
                versioned: false,
                encryption: BucketEncryption.S3_MANAGED,
                blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
                enforceSSL: true,
                lifecycleRules: [
                    {
                        expiration: Duration.days(30)
                    }
                ]
            }),
            synth: synthStep,
            codeBuildDefaults: {
                // `NodejsFunction` shells out to esbuild during synth; pin an
                // image whose Node runtime is new enough for it and for the
                // NODEJS_20_X bundling target.
                buildEnvironment: {
                    buildImage: LinuxBuildImage.STANDARD_7_0
                },
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
                if (isProd) {
                    pipeline.addStage(stage, {
                        pre: [
                            new ManualApprovalStep("ApproveIfStable", {
                                comment:
                                    "Approve to continue production deployment. Make sure every changes are verified in dev."
                            })
                        ]
                    });
                } else {
                    pipeline.addStage(stage);
                }
            }
        );
    }
}
