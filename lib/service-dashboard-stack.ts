import * as cdk from "aws-cdk-lib";
import { Duration } from "aws-cdk-lib";
import {
    Dashboard,
    GraphWidget,
    MathExpression,
    Metric,
    TextWidget
} from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";
import { addServiceLogSection } from "../constructs/service-log-dashboard";

export interface ServiceDashboardStackProps extends cdk.StackProps {
    /**
     * Stage suffix used in the *service's* resource names (TaiGerPortalServiceCDK
     * deploys with "beta" / "prod" — which is the infra package's `domainStage`,
     * NOT its `stageName` of "Beta-FE" / "Prod-NA"). Must match the region this
     * stack is deployed into so the metrics/log groups resolve.
     */
    serviceStageName: string;
}

/**
 * CloudWatch dashboard for TaiGerPortalService, modeled on TenfoldServicesMonitorCDK's
 * ServiceDashboardStack. The service is an ECS-on-EC2 deployment behind an
 * Application Load Balancer (deployed by TaiGerPortalServiceCDK), so:
 *   - ECS CPU/Memory/task-count come from AWS/ECS + ECS/ContainerInsights using
 *     the known cluster/service names.
 *   - ALB request/latency/host metrics use a CloudWatch SEARCH expression keyed
 *     on the load balancer name, because the metric `LoadBalancer` dimension is
 *     the ARN suffix (`app/<name>/<hash>`) and the hash is not known at synth
 *     time from this separate package.
 *   - Application error logs come from the ECS task log group.
 */
export class ServiceDashboardStack extends cdk.Stack {
    public readonly dashboard: Dashboard;

    constructor(scope: Construct, id: string, props: ServiceDashboardStackProps) {
        super(scope, id, props);

        this.dashboard = this.buildTaiGerPortalServiceDashboard(props.serviceStageName);
    }

    private buildTaiGerPortalServiceDashboard(stageName: string): Dashboard {
        const appName = "TaiGerPortalService";
        // Resource names from TaiGerPortalServiceCDK/stacks/ecs-ec2-stack.ts.
        const clusterName = `${appName}-ec2-cluster-${stageName}`;
        const serviceName = `${appName}-ecs-ec2-${stageName}`;
        const albName = `${appName}-alb-${stageName}`;
        const ecsLogGroup = `/ecs/ec2/${appName}-${stageName}`;

        const period = Duration.minutes(1);
        const periodSeconds = period.toSeconds();

        const ecsMetric = (
            namespace: string,
            metricName: string,
            statistic: string,
            label: string
        ) =>
            new Metric({
                namespace,
                metricName,
                period,
                statistic,
                dimensionsMap: { ClusterName: clusterName, ServiceName: serviceName },
                label
            });

        // ALB metrics are dimensioned by the LoadBalancer ARN suffix
        // (`app/<name>/<hash>`); SEARCH matches it by the name prefix so the
        // dashboard does not need the runtime-generated hash. `schema` selects
        // metrics carrying exactly those dimensions (e.g. the LB aggregate, not
        // per-AZ breakdowns). Label is left empty so each series keeps its name.
        const albSearch = (schema: string, metricName: string, statistic: string) =>
            new MathExpression({
                expression: `SEARCH('{${schema}} MetricName="${metricName}" "app/${albName}"', '${statistic}', ${periodSeconds})`,
                label: "",
                period
            });

        const dashboard = new Dashboard(this, "TaiGerPortalServiceDashboard", {
            dashboardName: `${appName}-${stageName}`,
            defaultInterval: Duration.days(14)
        });

        dashboard.addWidgets(
            new TextWidget({
                markdown: `# ${appName} — ${stageName}\n\nECS-on-EC2 REST API behind an Application Load Balancer. ALB metrics are matched by load balancer name via CloudWatch SEARCH.`,
                width: 24,
                height: 2
            })
        );

        // ---- Application Load Balancer ----
        dashboard.addWidgets(
            new GraphWidget({
                title: "ALB — Requests / Target 4XX / 5XX / ELB 5XX",
                width: 12,
                height: 6,
                left: [albSearch("AWS/ApplicationELB,LoadBalancer", "RequestCount", "Sum")],
                right: [
                    albSearch(
                        "AWS/ApplicationELB,LoadBalancer",
                        "HTTPCode_Target_4XX_Count",
                        "Sum"
                    ),
                    albSearch(
                        "AWS/ApplicationELB,LoadBalancer",
                        "HTTPCode_Target_5XX_Count",
                        "Sum"
                    ),
                    albSearch("AWS/ApplicationELB,LoadBalancer", "HTTPCode_ELB_5XX_Count", "Sum")
                ]
            }),
            new GraphWidget({
                title: "ALB — Target response time p50 / p95 / p99 (s)",
                width: 12,
                height: 6,
                left: [
                    albSearch("AWS/ApplicationELB,LoadBalancer", "TargetResponseTime", "p50"),
                    albSearch("AWS/ApplicationELB,LoadBalancer", "TargetResponseTime", "p95"),
                    albSearch("AWS/ApplicationELB,LoadBalancer", "TargetResponseTime", "p99")
                ]
            })
        );

        dashboard.addWidgets(
            new GraphWidget({
                title: "ALB — Healthy / Unhealthy hosts",
                width: 12,
                height: 6,
                left: [
                    albSearch(
                        "AWS/ApplicationELB,LoadBalancer,TargetGroup",
                        "HealthyHostCount",
                        "Maximum"
                    ),
                    albSearch(
                        "AWS/ApplicationELB,LoadBalancer,TargetGroup",
                        "UnHealthyHostCount",
                        "Maximum"
                    )
                ]
            }),
            new GraphWidget({
                title: "ALB — Active / New connections",
                width: 12,
                height: 6,
                left: [
                    albSearch("AWS/ApplicationELB,LoadBalancer", "ActiveConnectionCount", "Sum"),
                    albSearch("AWS/ApplicationELB,LoadBalancer", "NewConnectionCount", "Sum")
                ]
            })
        );

        // ---- ECS service ----
        dashboard.addWidgets(
            new GraphWidget({
                title: "ECS — CPU utilization (avg / max %)",
                width: 12,
                height: 6,
                left: [
                    ecsMetric("AWS/ECS", "CPUUtilization", "Average", "CPU avg %"),
                    ecsMetric("AWS/ECS", "CPUUtilization", "Maximum", "CPU max %")
                ]
            }),
            new GraphWidget({
                title: "ECS — Memory utilization (avg / max %)",
                width: 12,
                height: 6,
                left: [
                    ecsMetric("AWS/ECS", "MemoryUtilization", "Average", "Mem avg %"),
                    ecsMetric("AWS/ECS", "MemoryUtilization", "Maximum", "Mem max %")
                ]
            })
        );

        // Container Insights (enabled on the cluster) exposes task counts.
        dashboard.addWidgets(
            new GraphWidget({
                title: "ECS — Running / Desired task count",
                width: 24,
                height: 6,
                left: [
                    ecsMetric(
                        "ECS/ContainerInsights",
                        "RunningTaskCount",
                        "Maximum",
                        "Running tasks"
                    ),
                    ecsMetric(
                        "ECS/ContainerInsights",
                        "DesiredTaskCount",
                        "Maximum",
                        "Desired tasks"
                    )
                ]
            })
        );

        // ---- Application error logs ----
        addServiceLogSection(dashboard, {
            serviceName: appName,
            logGroupNames: [ecsLogGroup]
        });

        return dashboard;
    }
}
