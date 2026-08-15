// Unit tests for the Lambda entry point (lambda/cron-jobs/index.ts).
//
// The handler is pure dispatch, and dispatch is exactly what the JS -> TS
// conversion rewrote (an if/else chain became a typed lookup table), so these
// pin the behaviour that EventBridge depends on: the right job runs, an
// unknown jobType is a no-op rather than a crash, and a real failure still
// propagates so the invocation is marked failed.

import { JOB_TYPES } from "../lambda/cron-jobs/job-types";
import { CRON_JOBS } from "../configuration/cron-jobs";

const AssignEditorTasksReminderEmails = jest.fn();
const MongoDBDatabaseDailySnapshot = jest.fn();
const MongoDBDataPipelineDailySnapshot = jest.fn();

jest.mock("../lambda/cron-jobs/jobs/AssignEditorTasksReminderEmails", () => ({
    AssignEditorTasksReminderEmails: (...args: unknown[]) =>
        AssignEditorTasksReminderEmails(...args)
}));
jest.mock("../lambda/cron-jobs/jobs/MongoDBDatabaseDailySnapshot", () => ({
    MongoDBDatabaseDailySnapshot: (...args: unknown[]) => MongoDBDatabaseDailySnapshot(...args)
}));
jest.mock("../lambda/cron-jobs/jobs/MongoDBDataPipelineDailySnapshot", () => ({
    MongoDBDataPipelineDailySnapshot: (...args: unknown[]) =>
        MongoDBDataPipelineDailySnapshot(...args)
}));

import { handler } from "../lambda/cron-jobs";

describe("cron-jobs handler", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        AssignEditorTasksReminderEmails.mockResolvedValue(undefined);
        MongoDBDatabaseDailySnapshot.mockResolvedValue(undefined);
        MongoDBDataPipelineDailySnapshot.mockResolvedValue(undefined);
        jest.spyOn(console, "log").mockImplementation(() => undefined);
        jest.spyOn(console, "warn").mockImplementation(() => undefined);
        jest.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("dispatches AssignEditorTasksReminderEmails", async () => {
        const result = await handler({ jobType: "AssignEditorTasksReminderEmails" });

        expect(AssignEditorTasksReminderEmails).toHaveBeenCalledTimes(1);
        expect(MongoDBDatabaseDailySnapshot).not.toHaveBeenCalled();
        expect(MongoDBDataPipelineDailySnapshot).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(200);
    });

    it("dispatches MongoDBDatabaseDailySnapshot", async () => {
        await handler({ jobType: "MongoDBDatabaseDailySnapshot" });

        expect(MongoDBDatabaseDailySnapshot).toHaveBeenCalledTimes(1);
        expect(MongoDBDataPipelineDailySnapshot).not.toHaveBeenCalled();
    });

    it("dispatches MongoDBDataPipelineDailySnapshot", async () => {
        await handler({ jobType: "MongoDBDataPipelineDailySnapshot" });

        expect(MongoDBDataPipelineDailySnapshot).toHaveBeenCalledTimes(1);
        expect(MongoDBDatabaseDailySnapshot).not.toHaveBeenCalled();
    });

    it("no-ops on an unknown jobType instead of throwing", async () => {
        const result = await handler({ jobType: "NotARealJob" });

        expect(AssignEditorTasksReminderEmails).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(200);
    });

    it("no-ops on an event with no jobType at all", async () => {
        const result = await handler({});

        expect(AssignEditorTasksReminderEmails).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(200);
    });

    it("does not treat an inherited Object property as a job", async () => {
        // The lookup table is a plain object; `"constructor" in JOBS` would be
        // true, so the guard has to use hasOwnProperty.
        const result = await handler({ jobType: "constructor" });

        expect(result.statusCode).toBe(200);
        expect(AssignEditorTasksReminderEmails).not.toHaveBeenCalled();
    });

    it("rethrows so the invocation is marked failed", async () => {
        AssignEditorTasksReminderEmails.mockRejectedValue(new Error("boom"));

        await expect(handler({ jobType: "AssignEditorTasksReminderEmails" })).rejects.toThrow(
            "boom"
        );
    });
});

describe("cron schedule configuration", () => {
    it("only schedules jobs the handler implements", () => {
        for (const job of CRON_JOBS) {
            expect(JOB_TYPES).toContain(job.jobType);
        }
    });

    it("still schedules all three jobs", () => {
        expect(CRON_JOBS.map((job) => job.jobType).sort()).toEqual(
            [
                "AssignEditorTasksReminderEmails",
                "MongoDBDataPipelineDailySnapshot",
                "MongoDBDatabaseDailySnapshot"
            ].sort()
        );
    });
});
