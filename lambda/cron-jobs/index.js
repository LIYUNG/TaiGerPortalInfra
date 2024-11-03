exports.handler = async (event) => {
    console.log("Received event:", JSON.stringify(event, null, 2));

    // Extract jobType from the incoming event
    const jobType = event.jobType;

    try {
        if (jobType === "job1") {
            console.log("Running Job 1");
            // Add your logic for Job 1 here
            await runJob1();
        } else if (jobType === "job2") {
            console.log("Running Job 2");
            // Add your logic for Job 2 here
            await runJob2();
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

// Example function for Job 1
async function runJob1() {
    // Simulate some task for Job 1
    console.log("Executing tasks for Job 1...");
    // Add more logic as needed
}

// Example function for Job 2
async function runJob2() {
    // Simulate some task for Job 2
    console.log("Executing tasks for Job 2...");
    // Add more logic as needed
}
