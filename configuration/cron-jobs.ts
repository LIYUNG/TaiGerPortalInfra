import { CronJobConfig } from "../types";

export const CRON_JOBS: CronJobConfig[] = [
    {
        jobType: "MongoDBDataPipelineDailySnapshot",
        schedule: {
            minute: "58",
            hour: "21",
            day: "*",
            month: "*",
            year: "*"
        },
        description: "Daily snapshot of MongoDB data pipeline"
    },
    {
        jobType: "MongoDBDatabaseDailySnapshot",
        schedule: {
            minute: "58",
            hour: "21",
            day: "*",
            month: "*",
            year: "*"
        },
        description: "Daily snapshot of MongoDB database"
    }
    // Add new jobs here easily
];
