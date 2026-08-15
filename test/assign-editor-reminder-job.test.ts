// Unit tests for lambda/cron-jobs/jobs/AssignEditorTasksReminderEmails.
//
// This job survived the JS -> TS conversion unchanged in behaviour, and had no
// tests before. Its logic is entirely "who gets an email, and what is in it":
// the aggregation pipelines are handed to a fake collection, and the mailer is
// mocked, so every case below is about the filtering/grouping in between.

jest.mock("../lambda/db", () => ({
    connectToDatabase: jest.fn(),
    connectToMongoose: jest.fn()
}));
jest.mock("../lambda/email/email-contents/sendAssignEditorReminderEmail", () => ({
    sendAssignEditorReminderEmailV2: jest.fn()
}));

import { ObjectId } from "mongodb";

import { connectToDatabase as connectToDatabaseReal } from "../lambda/db";
import { sendAssignEditorReminderEmailV2 as sendReal } from "../lambda/email/email-contents/sendAssignEditorReminderEmail";
import { AssignEditorTasksReminderEmails } from "../lambda/cron-jobs/jobs/AssignEditorTasksReminderEmails";

const connectToDatabase = connectToDatabaseReal as jest.Mock;
const sendAssignEditorReminderEmail = sendReal as jest.Mock;

interface FakeUser {
    email: string;
    archiv?: boolean;
    firstname?: string;
    lastname?: string;
}

interface FakeStudent {
    _id: ObjectId;
    firstname?: string;
    lastname?: string;
    needEditor?: boolean;
    agents: FakeUser[];
    editors: FakeUser[];
}

const student = (overrides: Partial<FakeStudent> = {}): FakeStudent => ({
    _id: new ObjectId(),
    firstname: "Stu",
    lastname: "Dent",
    needEditor: true,
    agents: [],
    editors: [],
    ...overrides
});

const agent = (email: string, overrides: Partial<FakeUser> = {}): FakeUser => ({
    email,
    firstname: "Ada",
    lastname: "Agent",
    ...overrides
});

const permission = (email: string) => ({
    user_id: {
        _id: new ObjectId(),
        email,
        firstname: "Perry",
        lastname: "Mission"
    }
});

/** Minimal stand-in for the two collections the job aggregates over. */
const useDb = (students: unknown[], permissions: unknown[] = []) => {
    connectToDatabase.mockResolvedValue({
        collection: (name: string) => ({
            aggregate: () => ({
                toArray: async () => (name === "users" ? students : permissions)
            })
        })
    });
};

/** Recipient addresses the job mailed, in call order. */
const mailedAddresses = () =>
    sendAssignEditorReminderEmail.mock.calls.map((call) => call[0].address);

describe("AssignEditorTasksReminderEmails", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sendAssignEditorReminderEmail.mockResolvedValue(undefined);
        jest.spyOn(console, "log").mockImplementation(() => undefined);
        jest.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("which students count as needing an editor", () => {
        it("ignores students who already have an editor", async () => {
            useDb([
                student({
                    editors: [{ email: "editor@taiger.com" }],
                    agents: [agent("agent@taiger.com")]
                })
            ]);

            await AssignEditorTasksReminderEmails();

            expect(sendAssignEditorReminderEmail).not.toHaveBeenCalled();
        });

        it("ignores editor-less students who have not asked for one", async () => {
            useDb([student({ needEditor: false, agents: [agent("agent@taiger.com")] })]);

            await AssignEditorTasksReminderEmails();

            expect(sendAssignEditorReminderEmail).not.toHaveBeenCalled();
        });

        it("treats a student with an empty editors array as editor-less", async () => {
            useDb([student({ editors: [], agents: [agent("agent@taiger.com")] })]);

            await AssignEditorTasksReminderEmails();

            expect(mailedAddresses()).toEqual(["agent@taiger.com"]);
        });
    });

    describe("emails to agents", () => {
        it("sends one email per agent, not one per student", async () => {
            const shared = agent("agent@taiger.com");
            useDb([
                student({ firstname: "Alice", agents: [shared] }),
                student({ firstname: "Bob", agents: [shared] })
            ]);

            await AssignEditorTasksReminderEmails();

            expect(sendAssignEditorReminderEmail).toHaveBeenCalledTimes(1);
            const [, payload] = sendAssignEditorReminderEmail.mock.calls[0];
            expect(payload.noEditorStudents).toHaveLength(2);
            expect(payload.noEditorStudents.map((s: { firstname: string }) => s.firstname)).toEqual(
                ["Alice", "Bob"]
            );
        });

        it("groups by agent email even across separate agent objects", async () => {
            useDb([
                student({ firstname: "Alice", agents: [agent("dup@taiger.com")] }),
                student({ firstname: "Bob", agents: [agent("dup@taiger.com")] })
            ]);

            await AssignEditorTasksReminderEmails();

            expect(mailedAddresses()).toEqual(["dup@taiger.com"]);
        });

        it("mails each distinct agent of a shared student", async () => {
            useDb([student({ agents: [agent("one@taiger.com"), agent("two@taiger.com")] })]);

            await AssignEditorTasksReminderEmails();

            expect(mailedAddresses().sort()).toEqual(["one@taiger.com", "two@taiger.com"]);
        });

        it("skips archived agents", async () => {
            useDb([
                student({
                    agents: [
                        agent("active@taiger.com", { archiv: false }),
                        agent("gone@taiger.com", { archiv: true })
                    ]
                })
            ]);

            await AssignEditorTasksReminderEmails();

            expect(mailedAddresses()).toEqual(["active@taiger.com"]);
        });

        it("passes the student id as a string the email can build a link from", async () => {
            const id = new ObjectId();
            useDb([student({ _id: id, agents: [agent("agent@taiger.com")] })]);

            await AssignEditorTasksReminderEmails();

            const [, payload] = sendAssignEditorReminderEmail.mock.calls[0];
            expect(payload.noEditorStudents[0]._id).toBe(id.toString());
            expect(typeof payload.noEditorStudents[0]._id).toBe("string");
        });
    });

    describe("emails to editor-leads (permissions)", () => {
        it("mails every user who can assign editors", async () => {
            useDb(
                [student({ agents: [] })],
                [permission("lead1@taiger.com"), permission("lead2@taiger.com")]
            );

            await AssignEditorTasksReminderEmails();

            expect(mailedAddresses().sort()).toEqual(["lead1@taiger.com", "lead2@taiger.com"]);
        });

        it("gives leads the full list of students needing an editor", async () => {
            useDb(
                [
                    student({ firstname: "Alice", agents: [] }),
                    student({ firstname: "Bob", agents: [] })
                ],
                [permission("lead@taiger.com")]
            );

            await AssignEditorTasksReminderEmails();

            const [, payload] = sendAssignEditorReminderEmail.mock.calls[0];
            expect(payload.noEditorStudents.map((s: { firstname: string }) => s.firstname)).toEqual(
                ["Alice", "Bob"]
            );
            // Same id contract as the agent branch — stringified, not ObjectId.
            expect(typeof payload.noEditorStudents[0]._id).toBe("string");
        });

        it("sends nothing to leads when no student needs an editor", async () => {
            useDb([student({ needEditor: false, agents: [] })], [permission("lead@taiger.com")]);

            await AssignEditorTasksReminderEmails();

            expect(sendAssignEditorReminderEmail).not.toHaveBeenCalled();
        });

        it("sends nothing when nobody holds the permission", async () => {
            useDb([student({ agents: [] })], []);

            await AssignEditorTasksReminderEmails();

            expect(sendAssignEditorReminderEmail).not.toHaveBeenCalled();
        });

        it("mails both the agent and the lead for the same student", async () => {
            useDb(
                [student({ agents: [agent("agent@taiger.com")] })],
                [permission("lead@taiger.com")]
            );

            await AssignEditorTasksReminderEmails();

            expect(mailedAddresses().sort()).toEqual(["agent@taiger.com", "lead@taiger.com"]);
        });
    });

    describe("failure handling", () => {
        it("rethrows a database failure so the invocation is marked failed", async () => {
            connectToDatabase.mockRejectedValue(new Error("no route to host"));

            await expect(AssignEditorTasksReminderEmails()).rejects.toThrow("no route to host");
        });

        it("rethrows if sending fails", async () => {
            useDb([student({ agents: [agent("agent@taiger.com")] })]);
            sendAssignEditorReminderEmail.mockRejectedValue(new Error("SES throttled"));

            await expect(AssignEditorTasksReminderEmails()).rejects.toThrow("SES throttled");
        });

        it("does nothing, quietly, when there are no students at all", async () => {
            useDb([], [permission("lead@taiger.com")]);

            await expect(AssignEditorTasksReminderEmails()).resolves.toBeUndefined();
            expect(sendAssignEditorReminderEmail).not.toHaveBeenCalled();
        });
    });
});
