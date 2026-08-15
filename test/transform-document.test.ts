// Unit tests for lambda/common/utils.ts `transformDocument`, the hand-rolled
// Extended-JSON encoder both snapshot jobs run every document through. It had
// no tests before the TypeScript conversion, and its output is what a restore
// would have to read back, so the encoding is pinned here explicitly.

import { ObjectId } from "mongodb";

import { transformDocument } from "../lambda/common/utils";

describe("transformDocument", () => {
    it("encodes an ObjectId as $oid", () => {
        const id = new ObjectId("507f1f77bcf86cd799439011");

        expect(transformDocument(id)).toEqual({ $oid: "507f1f77bcf86cd799439011" });
    });

    it("encodes a Date as an ISO $date", () => {
        expect(transformDocument(new Date("2024-03-01T12:34:56.000Z"))).toEqual({
            $date: "2024-03-01T12:34:56.000Z"
        });
    });

    it.each([
        ["string", "hello"],
        ["number", 42],
        ["zero", 0],
        ["boolean", true],
        ["false", false],
        ["null", null]
    ])("passes a %s through untouched", (_label, value) => {
        expect(transformDocument(value)).toEqual(value);
    });

    it("recurses into nested objects", () => {
        const id = new ObjectId("507f1f77bcf86cd799439011");

        expect(
            transformDocument({
                _id: id,
                profile: { createdAt: new Date("2024-01-01T00:00:00.000Z"), name: "Ada" }
            })
        ).toEqual({
            _id: { $oid: "507f1f77bcf86cd799439011" },
            profile: {
                createdAt: { $date: "2024-01-01T00:00:00.000Z" },
                name: "Ada"
            }
        });
    });

    it("recurses into arrays, including arrays of ObjectIds", () => {
        const a = new ObjectId("507f1f77bcf86cd799439011");
        const b = new ObjectId("507f1f77bcf86cd799439012");

        expect(transformDocument([a, b])).toEqual([
            { $oid: "507f1f77bcf86cd799439011" },
            { $oid: "507f1f77bcf86cd799439012" }
        ]);
    });

    it("handles arrays nested inside objects", () => {
        expect(
            transformDocument({
                agents: [new ObjectId("507f1f77bcf86cd799439011")],
                tags: ["a", "b"]
            })
        ).toEqual({
            agents: [{ $oid: "507f1f77bcf86cd799439011" }],
            tags: ["a", "b"]
        });
    });

    it("preserves an empty object and an empty array", () => {
        expect(transformDocument({})).toEqual({});
        expect(transformDocument([])).toEqual([]);
    });

    it("produces output that survives JSON.stringify, which is how it is stored", () => {
        const doc = {
            _id: new ObjectId("507f1f77bcf86cd799439011"),
            createdAt: new Date("2024-01-01T00:00:00.000Z"),
            nested: { list: [1, "two", null] }
        };

        expect(JSON.parse(JSON.stringify(transformDocument(doc)))).toEqual({
            _id: { $oid: "507f1f77bcf86cd799439011" },
            createdAt: { $date: "2024-01-01T00:00:00.000Z" },
            nested: { list: [1, "two", null] }
        });
    });
});
