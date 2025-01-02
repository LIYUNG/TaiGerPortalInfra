import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { UserPool, UserPoolClient } from "aws-cdk-lib/aws-cognito";

interface AuthStackProps extends cdk.StackProps {
    stageName: string;
    domainStage: string;
    isProd: boolean;
}

export class AuthStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: AuthStackProps) {
        super(scope, id, props);
        // Create the Cognito User Pool
        const userPool = new UserPool(this, `UserPool-${props.stageName}`, {
            selfSignUpEnabled: true,
            signInAliases: {
                username: true,
                email: true
            },
            autoVerify: { email: true },
            passwordPolicy: {
                minLength: 8,
                requireSymbols: true,
                requireUppercase: true,
                requireLowercase: true,
                requireDigits: true
            }
        });

        // Create the App Client for the User Pool
        new UserPoolClient(this, `AppClient-${props.stageName}`, {
            userPool,
            generateSecret: false
        });
    }
}