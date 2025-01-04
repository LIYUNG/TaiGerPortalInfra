const { ObjectId } = require("mongodb");

// Example function for Job MongoDBDataPipelineDailySnapshot
function transformDocument(doc) {
    if (Array.isArray(doc)) {
        return doc.map(transformDocument); // Recursively process arrays
    } else if (doc instanceof ObjectId) {
        return { $oid: doc.toString() }; // Transform ObjectId
    } else if (doc instanceof Date) {
        return { $date: doc.toISOString() }; // Transform Date to ISO format
    } else if (typeof doc === "object" && doc !== null) {
        const transformed = {};
        for (let key in doc) {
            if (Object.prototype.hasOwnProperty.call(doc, key)) {
                transformed[key] = transformDocument(doc[key]); // Recursively process objects
            }
        }
        return transformed;
    }
    return doc; // Return primitive types as is
}

module.exports = { transformDocument };
