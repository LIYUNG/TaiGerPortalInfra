// types/cron-jobs.ts
import { JobType } from "../lambda/cron-jobs/job-types";

export interface CronJobConfig {
    /** Must be a job the Lambda handler actually implements. */
    jobType: JobType;
    schedule: {
        minute: string;
        hour: string;
        day: string;
        month: string;
        year: string;
    };
    description?: string;
}
