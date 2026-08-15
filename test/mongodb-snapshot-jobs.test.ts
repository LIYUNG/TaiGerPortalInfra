// Unit tests for the two MongoDB -> S3 snapshot jobs.
//
// These are the jobs that keep direct database access (the reminder jobs moved
// behind the service webhook), so their behaviour is worth pinning: which
// collections are exported, which fields are withheld from the external
// bucket, and the S3 key layout a restore or a downstream pipeline depends on.

const s3Send = jest.fn();

jest.mock("../lambda/db", () => ({
    connectToDatabase: jest.fn(),
    connectToMongoose: jest.fn()
}));
jest.mock("../lambda/aws", () => ({
    s3Client: { send: (...args: unknown[]) => s3Send(...args) },
    secretsManagerClient: { send: jest.fn() },
    ses: {},
    SendRawEmailCommand: class {}
}));

import { ObjectId } from "mongodb";

import { connectToDatabase as connectToDatabaseReal } from "../lambda/db";
import { MongoDBDatabaseDailySnapshot } from "../lambda/cron-jobs/jobs/MongoDBDatabaseDailySnapshot";
import { MongoDBDataPipelineDailySnapshot } from "../lambda/cron-jobs/jobs/MongoDBDataPipelineDailySnapshot";

const connectToDatabase = connectToDatabaseReal as jest.Mock;

const INTERNAL_BUCKET = "taiger-internal-backup";
const EXTERNAL_BUCKET = "taiger-external-bucket";

/** Records the `find` options each collection was queried with. */
let findCalls: Record<string, unknown>;

const useDb = (collections: Record<string, unknown[]>) => {
    findCalls = {};
    connectToDatabase.mockResolvedValue({
        listCollections: () => ({
            toArray: async () => Object.keys(collections).map((name) => ({ name }))
        }),
        collection: (name: string) => ({
            find: (_filter: unknown, options?: unknown) => {
                findCalls[name] = options;
                return { toArray: async () => collections[name] ?? [] };
            }
        })
    });
};

/** The `{ Bucket, Key, Body }` of each PutObject the job issued. */
const puts = () =>
    s3Send.mock.calls.map((call) => (call[0] as { input: Record<string, string> }).input);

const putFor = (key: string) => puts().find((p) => p.Key.endsWith(key));

describe("MongoDB snapshot jobs", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {
            ...originalEnv,
            INTERNAL_MONGODB_S3_BUCKET_NAME: INTERNAL_BUCKET,
            EXTERNAL_S3_BUCKET_NAME: EXTERNAL_BUCKET
        };
        s3Send.mockResolvedValue({});
        jest.spyOn(console, "log").mockImplementation(() => undefined);
        jest.spyOn(console, "error").mockImplementation(() => undefined);
        jest.useFakeTimers().setSystemTime(new Date("2024-03-09T04:00:00.000Z"));
    });

    afterEach(() => {
        jest.useRealTimers();
        process.env = originalEnv;
        jest.restoreAllMocks();
    });

    describe("MongoDBDatabaseDailySnapshot (full backup, internal bucket)", () => {
        it("exports every collection, not a subset", async () => {
            useDb({ users: [], programs: [], secrets_stuff: [], audits: [] });

            await MongoDBDatabaseDailySnapshot();

            expect(puts()).toHaveLength(4);
        });

        it("writes to the internal bucket under a UTC date prefix", async () => {
            useDb({ users: [] });

            await MongoDBDatabaseDailySnapshot();

            expect(puts()[0]).toMatchObject({
                Bucket: INTERNAL_BUCKET,
                Key: "2024-3-9/users.json",
                ContentType: "application/json"
            });
        });

        it("encodes documents through transformDocument", async () => {
            useDb({
                users: [
                    {
                        _id: new ObjectId("507f1f77bcf86cd799439011"),
                        createdAt: new Date("2024-01-01T00:00:00.000Z")
                    }
                ]
            });

            await MongoDBDatabaseDailySnapshot();

            expect(JSON.parse(puts()[0].Body)).toEqual([
                {
                    _id: { $oid: "507f1f77bcf86cd799439011" },
                    createdAt: { $date: "2024-01-01T00:00:00.000Z" }
                }
            ]);
        });

        it("does not withhold any fields — it is the disaster-recovery copy", async () => {
            useDb({ users: [] });

            await MongoDBDatabaseDailySnapshot();

            expect(findCalls.users).toBeUndefined();
        });

        it("fails the invocation when the bucket is not configured", async () => {
            delete process.env.INTERNAL_MONGODB_S3_BUCKET_NAME;
            useDb({ users: [] });

            await expect(MongoDBDatabaseDailySnapshot()).rejects.toThrow(
                /INTERNAL_MONGODB_S3_BUCKET_NAME/
            );
        });

        it("rethrows an S3 failure rather than reporting a successful backup", async () => {
            useDb({ users: [] });
            s3Send.mockRejectedValue(new Error("AccessDenied"));

            await expect(MongoDBDatabaseDailySnapshot()).rejects.toThrow("AccessDenied");
        });
    });

    describe("MongoDBDataPipelineDailySnapshot (external share)", () => {
        it("exports only the allow-listed collections", async () => {
            useDb({
                users: [],
                courses: [],
                programs: [],
                communications: [],
                tokens: [],
                audits: []
            });

            await MongoDBDataPipelineDailySnapshot();

            const exported = puts()
                .map((p) => p.Key.split("/").pop())
                .sort();
            expect(exported).toEqual([
                "communications.json",
                "courses.json",
                "programs.json",
                "users.json"
            ]);
        });

        it("never exports a collection outside the allow-list", async () => {
            useDb({ tokens: [], users: [] });

            await MongoDBDataPipelineDailySnapshot();

            expect(putFor("tokens.json")).toBeUndefined();
        });

        it("projects credentials out of the users collection", async () => {
            useDb({ users: [] });

            await MongoDBDataPipelineDailySnapshot();

            expect(findCalls.users).toEqual({
                projection: {
                    password: 0,
                    "applications.portal_credentials.application_portal_a.account": 0,
                    "applications.portal_credentials.application_portal_a.password": 0,
                    "applications.portal_credentials.application_portal_b.account": 0,
                    "applications.portal_credentials.application_portal_b.password": 0
                }
            });
        });

        it("applies no projection to non-user collections", async () => {
            useDb({ courses: [] });

            await MongoDBDataPipelineDailySnapshot();

            expect(findCalls.courses).toBeUndefined();
        });

        it("writes to the external bucket under the tenfold folder", async () => {
            useDb({ users: [] });

            await MongoDBDataPipelineDailySnapshot();

            expect(puts()[0]).toMatchObject({
                Bucket: EXTERNAL_BUCKET,
                Key: "tenfold-ai-folder/2024-3-9/users.json"
            });
        });

        it("fails the invocation when the external bucket is not configured", async () => {
            delete process.env.EXTERNAL_S3_BUCKET_NAME;
            useDb({ users: [] });

            await expect(MongoDBDataPipelineDailySnapshot()).rejects.toThrow(
                /EXTERNAL_S3_BUCKET_NAME/
            );
        });

        it("never writes to the internal bucket", async () => {
            useDb({ users: [], courses: [] });

            await MongoDBDataPipelineDailySnapshot();

            expect(puts().every((p) => p.Bucket === EXTERNAL_BUCKET)).toBe(true);
        });
    });
});
