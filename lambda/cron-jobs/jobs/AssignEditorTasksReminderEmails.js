const { isNotArchiv } = require("@taiger-common/core");
const { connectToDatabase } = require("../../db");
const {
    sendAssignEditorReminderEmail
} = require("../../email/email-contents/sendAssignEditorReminderEmail");

async function AssignEditorTasksReminderEmails() {
    console.log("Executing tasks for Job AssignEditorTasksReminderEmails...");
    try {
        // Connect to MongoDB
        const db = await connectToDatabase();
        const usersCollection = db.collection("users");
        const permissionsCollection = db.collection("permissions");

        // Fetch students (users with role 'student')
        const students = await usersCollection
            .aggregate([
                {
                    $match: {
                        role: "Student", // Filtering for users who are students
                        $or: [{ archiv: { $exists: false } }, { archiv: false }]
                    }
                },
                {
                    $lookup: {
                        from: "users", // Assuming agents and editors are also in the 'users' collection
                        localField: "agents",
                        foreignField: "_id",
                        as: "agents"
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "editors",
                        foreignField: "_id",
                        as: "editors"
                    }
                },
                {
                    $lookup: {
                        from: "programs",
                        localField: "applications.programId",
                        foreignField: "_id",
                        as: "applications.programId"
                    }
                },
                {
                    $lookup: {
                        from: "documentthreads",
                        localField: "generaldocs_threads.doc_thread_id",
                        foreignField: "_id",
                        as: "generaldocs_threads.doc_thread_id"
                    }
                },
                {
                    $lookup: {
                        from: "documentthreads",
                        localField: "applications.doc_modification_thread.doc_thread_id",
                        foreignField: "_id",
                        as: "applications.doc_modification_thread.doc_thread_id"
                    }
                },
                {
                    $project: {
                        notification: 0 // Remove notification field
                    }
                }
            ])
            .toArray();

        // Iterate over the students
        for (let i = 0; i < students.length; i += 1) {
            if (!students[i].editors || students[i].editors.length === 0) {
                for (let j = 0; j < students[i].agents.length; j += 1) {
                    // inform active-agent
                    if (isNotArchiv(students[i])) {
                        if (isNotArchiv(students[i].agents[j])) {
                            if (students[i].needEditor) {
                                sendAssignEditorReminderEmail(
                                    {
                                        firstname: students[i].agents[j].firstname,
                                        lastname: students[i].agents[j].lastname,
                                        address: students[i].agents[j].email
                                    },
                                    {
                                        student_firstname: students[i].firstname,
                                        student_id: students[i]._id.toString(),
                                        student_lastname: students[i].lastname
                                    }
                                );
                            }
                        }
                    }
                }
                // inform editor-lead
                const permissions = await permissionsCollection
                    .find({
                        canAssignEditors: true
                    })
                    .toArray();

                if (permissions) {
                    for (let x = 0; x < permissions.length; x += 1) {
                        if (students[i].needEditor) {
                            sendAssignEditorReminderEmail(
                                {
                                    firstname: permissions[x].user_id.firstname,
                                    lastname: permissions[x].user_id.lastname,
                                    address: permissions[x].user_id.email
                                },
                                {
                                    student_firstname: students[i].firstname,
                                    student_id: students[i]._id.toString(),
                                    student_lastname: students[i].lastname
                                }
                            );
                        }
                    }
                }
                logger.info("Assign editor reminded");
            }
        }

        // Close MongoDB connection
        await client.close();
    } catch (error) {
        console.error("Error running AssignEditorTasksReminderEmails:", error);
        throw error;
    }
}

module.exports = { AssignEditorTasksReminderEmails };
