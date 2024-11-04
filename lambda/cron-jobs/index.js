const { MongoDBDatabaseDailySnapshot } = require("./jobs/MongoDBDataBaseDailySnapshot");
const { MongoDBDataPipelineDailySnapshot } = require("./jobs/MongoDBDataPipelineDailySnapshot");

exports.handler = async (event) => {
    console.log("Received event:", JSON.stringify(event, null, 2));

    // Extract jobType from the incoming event
    const jobType = event.jobType;

    try {
        if (jobType === "MongoDBDataPipelineDailySnapshot") {
            console.log("Running Job MongoDBDataPipelineDailySnapshot");
            await MongoDBDataPipelineDailySnapshot();
        } else if (jobType === "MongoDBDatabaseDailySnapshot") {
            console.log("Running Job MongoDBDatabaseDailySnapshot");
            await MongoDBDatabaseDailySnapshot();
        } else {
            console.warn(`No matching job for jobType: ${jobType}`);
        }
    } catch (error) {
        console.error(`Error executing ${jobType}:`, error);
        throw error;
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ message: `Job ${jobType} completed` })
    };
};
