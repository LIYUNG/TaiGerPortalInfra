/**
 * The single source of truth for cron job identifiers.
 *
 * The CDK side (`configuration/cron-jobs.ts`) types its schedule entries
 * against `JobType`, and the Lambda handler dispatches on the same union, so a
 * schedule can no longer reference a job that does not exist.
 */
export const JOB_TYPES = [
    "MongoDBDataPipelineDailySnapshot",
    "MongoDBDatabaseDailySnapshot",
    "AssignEditorTasksReminderEmails"
] as const;

export type JobType = (typeof JOB_TYPES)[number];
