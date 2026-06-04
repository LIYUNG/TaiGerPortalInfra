import { LogQueryWidget, TextWidget } from "aws-cdk-lib/aws-cloudwatch";
// `Dashboard` is used only as a function-parameter type annotation, which the
// Babel eslint parser does not track as a usage (unlike interface-property types
// such as `IWidget`), so no-unused-vars false-positives on it.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Dashboard, IWidget } from "aws-cdk-lib/aws-cloudwatch";

export interface ServiceLogSectionExtraQuery {
    title: string;
    logGroupNames: string[];
    queryLines: string[];
    /** @default 12 */
    height?: number;
    /** @default 24 */
    width?: number;
}

export interface ServiceLogSectionProps {
    serviceName: string;
    /** Application log groups (ECS, Lambda, etc.). Errors are filtered by keyword. */
    logGroupNames: string[];
    /**
     * API Gateway access log groups. Filtered by HTTP `status` >= 500 instead of
     * the keyword filter, because the JSON access log format contains keys like
     * `errorMessage` / `errorType` that yield false positives under `like /error/`.
     */
    apiGwLogGroupNames?: string[];
    /**
     * Case-insensitive substrings. Each is wrapped in CloudWatch Logs Insights' `(?i)` inline flag.
     * @default ["error", "traceback", "critical"]
     */
    errorPatterns?: string[];
    /**
     * Additional log-query widgets to append after the standard error queries.
     * Useful for scoping a query to a single log group.
     */
    extraQueries?: ServiceLogSectionExtraQuery[];
    /**
     * Optional widget rendered on the same row as the API Gateway 5XX widget.
     * When provided, the 5XX widget drops to half width (12) so the two sit side
     * by side. Construct the companion at width 12 as well. Requires
     * `apiGwLogGroupNames`.
     */
    apiGwRowCompanionWidget?: IWidget;
}

/**
 * Appends a section of error-log widgets to the given dashboard:
 * - Section header (TextWidget)
 * - Errors-grouped-by-signature LogQueryWidget
 * - All-errors LogQueryWidget across the section's log groups
 * - Optional API Gateway 5XX LogQueryWidget
 * - Any caller-supplied extra LogQueryWidgets
 *
 * Multiple sections can be added to the same Dashboard to reduce dashboard count.
 */
export function addServiceLogSection(dashboard: Dashboard, props: ServiceLogSectionProps): void {
    if (props.logGroupNames.length === 0) {
        throw new Error(
            `addServiceLogSection: '${props.serviceName}' requires at least one log group`
        );
    }

    const patterns = props.errorPatterns ?? ["error", "traceback", "critical"];
    const filterExpr = patterns.map((p) => `@message like /(?i)${p}/`).join(" or ");
    const apiGwLogGroupNames = props.apiGwLogGroupNames ?? [];

    dashboard.addWidgets(
        new TextWidget({
            markdown: [
                `## ${props.serviceName} — Errors (last 14 days)`,
                "",
                "Log groups in scope:",
                ...props.logGroupNames.map((g) => `- \`${g}\``),
                ...apiGwLogGroupNames.map((g) => `- \`${g}\` (API GW, 5XX only)`)
            ].join("\n"),
            height: 8,
            width: 12
        }),
        new LogQueryWidget({
            title: `${props.serviceName} — Errors grouped by signature`,
            logGroupNames: props.logGroupNames,
            width: 12,
            height: 8,
            queryLines: [
                "fields @timestamp, @message",
                `filter ${filterExpr}`,
                "parse @message /(?<err>[A-Z][a-zA-Z]+(Error|Exception): .+)/",
                "stats count() as occurrences by err",
                "sort occurrences desc",
                "limit 50"
            ]
        }),
        new LogQueryWidget({
            title: `${props.serviceName} — All errors (app log groups)`,
            logGroupNames: props.logGroupNames,
            width: 24,
            height: 12,
            queryLines: [
                "fields @timestamp, @log, @message",
                `filter ${filterExpr}`,
                "sort @timestamp desc",
                "limit 500"
            ]
        })
    );

    if (apiGwLogGroupNames.length > 0) {
        const companion = props.apiGwRowCompanionWidget;
        const apiGw5xxWidget = new LogQueryWidget({
            title: `${props.serviceName} — API Gateway 5XX errors`,
            logGroupNames: apiGwLogGroupNames,
            width: companion ? 12 : 24,
            height: 8,
            queryLines: [
                "fields @timestamp, @message",
                'filter @message like /"status":"5/',
                'parse @message /"status":"(?<status>[0-9]+)"/',
                'parse @message /"httpMethod":"(?<httpMethod>[^"]*)"/',
                'parse @message /"path":"(?<path>[^"]*)"/',
                'parse @message /"errorMessage":"(?<errorMessage>[^"]*)"/',
                'parse @message /"errorType":"(?<errorType>[^"]*)"/',
                "display @timestamp, status, httpMethod, path, errorMessage, errorType",
                "sort @timestamp desc",
                "limit 200"
            ]
        });
        dashboard.addWidgets(...(companion ? [apiGw5xxWidget, companion] : [apiGw5xxWidget]));
    }

    for (const extra of props.extraQueries ?? []) {
        dashboard.addWidgets(
            new LogQueryWidget({
                title: extra.title,
                logGroupNames: extra.logGroupNames,
                width: extra.width ?? 24,
                height: extra.height ?? 12,
                queryLines: extra.queryLines
            })
        );
    }
}
