/**
 * Environment variables are injected by the CDK `CronJobsConstruct`. They are
 * typed as `string | undefined` by `@types/node`, so read them through these
 * helpers rather than sprinkling non-null assertions across the jobs.
 */
export function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

export function optionalEnv(name: string): string | undefined {
    return process.env[name];
}
