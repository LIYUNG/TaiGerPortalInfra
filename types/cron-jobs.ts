// types/cron-jobs.ts
export interface CronJobConfig {
    jobType: string;
    schedule: {
        minute: string;
        hour: string;
        day: string;
        month: string;
        year: string;
    };
    description?: string;
}
