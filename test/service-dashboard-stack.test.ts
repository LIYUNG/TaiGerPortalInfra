import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ServiceDashboardStack } from "../lib/service-dashboard-stack";

describe("ServiceDashboardStack", () => {
    test.each([
        ["beta", "TaiGerPortalService-beta"],
        ["prod", "TaiGerPortalService-prod"]
    ])("creates the TaiGerPortalService dashboard for %s", (serviceStageName, dashboardName) => {
        const app = new cdk.App();
        const stack = new ServiceDashboardStack(app, `ServiceDashboardStack-${serviceStageName}`, {
            serviceStageName
        });
        const template = Template.fromStack(stack);

        template.resourceCountIs("AWS::CloudWatch::Dashboard", 1);
        template.hasResourceProperties("AWS::CloudWatch::Dashboard", {
            DashboardName: dashboardName
        });
    });

    test("dashboard body references the stage-specific resource names", () => {
        const app = new cdk.App();
        const stack = new ServiceDashboardStack(app, "ServiceDashboardStack-beta", {
            serviceStageName: "beta"
        });
        const template = Template.fromStack(stack);
        const dashboards = template.findResources("AWS::CloudWatch::Dashboard");
        const body = JSON.stringify(Object.values(dashboards)[0].Properties.DashboardBody);

        // ECS cluster/service names, ALB name, and ECS log group should all be wired in.
        expect(body).toContain("TaiGerPortalService-ec2-cluster-beta");
        expect(body).toContain("TaiGerPortalService-ecs-ec2-beta");
        expect(body).toContain("app/TaiGerPortalService-alb-beta");
        expect(body).toContain("/ecs/ec2/TaiGerPortalService-beta");
    });
});
