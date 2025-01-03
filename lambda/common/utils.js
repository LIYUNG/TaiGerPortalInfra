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
            if (doc.hasOwnProperty(key)) {
                transformed[key] = transformDocument(doc[key]); // Recursively process objects
            }
        }
        return transformed;
    }
    return doc; // Return primitive types as is
}

const isNotArchiv = (user) => {
    if (user.archiv === undefined || !user.archiv) {
        return true;
    }
    return false;
};

module.exports = { transformDocument, isNotArchiv };
