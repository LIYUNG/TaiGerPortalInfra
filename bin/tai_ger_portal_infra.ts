#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { TaiGerPortalInfraStack } from "../lib/tai_ger_portal_infra-stack";
import { AWS_ACCOUNT } from "../configuration";
import { Region } from "../constants";

const app = new cdk.App();
new TaiGerPortalInfraStack(app, "TaiGerPortalInfraStack", {
    env: { region: Region.IAD, account: AWS_ACCOUNT }
});
