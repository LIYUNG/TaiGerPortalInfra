import { Construct } from "constructs";
import { InfraStack } from "./infrastack";
import { Stage, StageProps } from "aws-cdk-lib";
import { ServiceStack } from "./servicestack";
// import { AuthStack } from "./authstack";

interface DeploymentkProps extends StageProps {
    stageName: string;
    domainStage: string;
    isProd: boolean;
    mongodbUriSecretName: string;
    mongoDBName: string;
    externalS3BucketName: string;
    internalMongodbS3BucketName: string;
}

export class PipelineAppStage extends Stage {
    constructor(scope: Construct, id: string, props: DeploymentkProps) {
        super(scope, id, props);

        const infraStack = new InfraStack(this, `InfraStack-${props.stageName}`, {
            env: props.env,
            stageName: props.stageName,
            domainStage: props.domainStage,
            isProd: props.isProd,
            mongodbUriSecretName: props.mongodbUriSecretName,
            mongoDBName: props.mongoDBName,
            externalS3BucketName: props.externalS3BucketName
        });

        const serviceStack = new ServiceStack(this, `ServiceStack-${props.stageName}`, {
            env: props.env,
            stageName: props.stageName,
            domainStage: props.domainStage,
            isProd: props.isProd,
            mongodbUriSecretName: props.mongodbUriSecretName,
            mongoDBName: props.mongoDBName,
            externalS3BucketName: props.externalS3BucketName,
            internalMongodbS3BucketName: props.internalMongodbS3BucketName,
            infraStack
        });

        // new AuthStack(this, `AuthStack-${props.stageName}`, {
        //     env: props.env,
        //     stageName: props.stageName,
        //     domainStage: props.domainStage,
        //     isProd: props.isProd
        // });

        serviceStack.addDependency(infraStack);
    }
}
