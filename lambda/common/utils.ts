import { ObjectId } from "mongodb";

/**
 * Extended-JSON-ish representation used by the daily snapshot jobs: ObjectIds
 * become `{ $oid }` and Dates become `{ $date }`, matching what mongoimport
 * expects on the way back in.
 */
export type TransformedDocument =
    | { $oid: string }
    | { $date: string }
    | TransformedDocument[]
    | { [key: string]: TransformedDocument }
    | unknown;

// Example function for Job MongoDBDataPipelineDailySnapshot
export function transformDocument(doc: unknown): TransformedDocument {
    if (Array.isArray(doc)) {
        return doc.map(transformDocument); // Recursively process arrays
    } else if (doc instanceof ObjectId) {
        return { $oid: doc.toString() }; // Transform ObjectId
    } else if (doc instanceof Date) {
        return { $date: doc.toISOString() }; // Transform Date to ISO format
    } else if (typeof doc === "object" && doc !== null) {
        const transformed: Record<string, TransformedDocument> = {};
        for (const key in doc) {
            if (Object.prototype.hasOwnProperty.call(doc, key)) {
                // Recursively process objects
                transformed[key] = transformDocument((doc as Record<string, unknown>)[key]);
            }
        }
        return transformed;
    }
    return doc; // Return primitive types as is
}
