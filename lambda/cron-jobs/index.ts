import { AssignEditorTasksReminderEmails } from "./jobs/AssignEditorTasksReminderEmails";
import { MongoDBDatabaseDailySnapshot } from "./jobs/MongoDBDatabaseDailySnapshot";
import { MongoDBDataPipelineDailySnapshot } from "./jobs/MongoDBDataPipelineDailySnapshot";
import { JobType } from "./job-types";

/** Payload built by the EventBridge rule in `constructs/cron-jobs.ts`. */
export interface CronJobEvent {
    jobType?: string;
}

export interface CronJobResult {
    statusCode: number;
    body: string;
}

const JOBS: Record<JobType, () => Promise<void>> = {
    MongoDBDataPipelineDailySnapshot,
    MongoDBDatabaseDailySnapshot,
    AssignEditorTasksReminderEmails
};

const isJobType = (value: string | undefined): value is JobType =>
    value !== undefined && Object.prototype.hasOwnProperty.call(JOBS, value);

export const handler = async (event: CronJobEvent): Promise<CronJobResult> => {
    console.log("Received event:", JSON.stringify(event, null, 2));

    // Extract jobType from the incoming event
    const jobType = event.jobType;

    if (!isJobType(jobType)) {
        console.warn(`No matching job for jobType: ${jobType}`);
        return {
            statusCode: 200,
            body: JSON.stringify({ message: `Job ${jobType} completed` })
        };
    }

    try {
        console.log(`Running Job ${jobType}`);
        await JOBS[jobType]();
    } catch (error) {
        console.error(`Error executing ${jobType}:`, error);
        throw error;
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ message: `Job ${jobType} completed` })
    };
};
