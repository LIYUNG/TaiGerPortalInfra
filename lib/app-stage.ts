import { Construct } from "constructs";
import { InfraStack } from "./infrastack";
import { Stage, StageProps } from "aws-cdk-lib";

interface DeploymentkProps extends StageProps {
    stageName: string;
    domainStage: string;
    isProd: boolean;
    mongodbUriSecretName: string;
    mongoDBName: string;
    externalS3BucketName: string;
}

export class PipelineAppStage extends Stage {
    constructor(scope: Construct, id: string, props: DeploymentkProps) {
        super(scope, id, props);

        const infraStck = new InfraStack(this, `InfraStack-${props.stageName}`, {
            env: props.env,
            stageName: props.stageName,
            domainStage: props.domainStage,
            isProd: props.isProd,
            mongodbUriSecretName: props.mongodbUriSecretName,
            mongoDBName: props.mongoDBName,
            externalS3BucketName: props.externalS3BucketName
        });
    }
}
