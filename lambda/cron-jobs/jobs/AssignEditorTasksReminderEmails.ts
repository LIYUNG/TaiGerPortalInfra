import { isNotArchiv } from "@taiger-common/core";
import type { ObjectId } from "mongodb";

import { connectToDatabase } from "../../db";
import {
    NoEditorStudent,
    sendAssignEditorReminderEmailV2
} from "../../email/email-contents/sendAssignEditorReminderEmail";

/** Projected user shape produced by the `$lookup` stages below. */
interface UserSummary {
    email: string;
    archiv?: boolean;
    firstname?: string;
    lastname?: string;
}

/** Shape of a single document returned by the students aggregation. */
interface StudentAggregate {
    _id: ObjectId;
    firstname?: string;
    lastname?: string;
    needEditor?: boolean;
    agents: UserSummary[];
    editors: UserSummary[];
}

/** Shape of a single document returned by the permissions aggregation. */
interface PermissionAggregate {
    canAssignEditors?: boolean;
    user_id: {
        _id: ObjectId;
        email: string;
        firstname?: string;
        lastname?: string;
    };
}

export async function AssignEditorTasksReminderEmails(): Promise<void> {
    console.log("Executing tasks for Job AssignEditorTasksReminderEmails...");
    try {
        // Connect to MongoDB
        const db = await connectToDatabase();
        const usersCollection = db.collection("users");
        const permissionsCollection = db.collection("permissions");

        // Fetch students (users with role 'student')
        const students = await usersCollection
            .aggregate<StudentAggregate>([
                {
                    $match: {
                        role: "Student", // Filtering for users who are students
                        $or: [{ archiv: { $exists: false } }, { archiv: false }]
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        let: { agentIds: "$agents" },
                        pipeline: [
                            { $match: { $expr: { $in: ["$_id", "$$agentIds"] } } },
                            { $project: { email: 1, archiv: 1, firstname: 1, lastname: 1, _id: 0 } }
                        ],
                        as: "agents"
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        let: { editorIds: "$editors" },
                        pipeline: [
                            { $match: { $expr: { $in: ["$_id", "$$editorIds"] } } },
                            { $project: { email: 1, archiv: 1, firstname: 1, lastname: 1, _id: 0 } }
                        ],
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

        // inform editor-lead
        const permissions = await permissionsCollection
            .aggregate<PermissionAggregate>([
                {
                    $match: {
                        canAssignEditors: true
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "user_id",
                        foreignField: "_id",
                        as: "user_info"
                    }
                },
                {
                    $unwind: {
                        path: "$user_info",
                        preserveNullAndEmptyArrays: false
                    }
                },
                {
                    $set: {
                        user_id: {
                            _id: "$user_info._id",
                            email: "$user_info.email",
                            firstname: "$user_info.firstname",
                            lastname: "$user_info.lastname"
                        }
                    }
                },
                {
                    $unset: "user_info" // Optional: remove the temporary user_info field
                }
            ])
            .toArray();
        console.log("permissions ", permissions);
        // Iterate over the students
        const noEditorStudents = students.filter(
            (student) => !student.editors || student.editors.length === 0
        );

        console.log("noEditorStudents: ", noEditorStudents);

        const agentsMap = new Map<string, { agent: UserSummary; students: NoEditorStudent[] }>();

        for (const student of noEditorStudents) {
            if (student.needEditor) {
                // `isNotArchiv` only reads `archiv`; the projection above omits
                // `role`, which its `UserProps` signature nominally requires.
                const activeAgents = student.agents.filter((agent) =>
                    isNotArchiv({ role: "", ...agent })
                );

                activeAgents.forEach((agent) => {
                    const key = agent.email; // Use agent's email as the unique key
                    if (!agentsMap.has(key)) {
                        agentsMap.set(key, {
                            agent,
                            students: []
                        });
                    }
                    agentsMap.get(key)!.students.push({
                        firstname: student.firstname,
                        lastname: student.lastname,
                        _id: student._id.toString()
                    });
                });
            }
        }

        // Step 2: Send a single email to each agent with their student list
        const emailPromises = Array.from(agentsMap.values()).map(({ agent, students }) =>
            sendAssignEditorReminderEmailV2(
                {
                    firstname: agent.firstname,
                    lastname: agent.lastname,
                    address: agent.email
                },
                {
                    noEditorStudents: students // Pass the list of students for the agent
                }
            )
        );

        await Promise.all(emailPromises);

        if (permissions?.length) {
            // Step 1: Filter students who need editors
            const noEditorStudentsNeedEditor = noEditorStudents.filter(
                (student) => student.needEditor
            );

            console.log("noEditorStudentsNeedEditor: ", noEditorStudentsNeedEditor);

            if (noEditorStudentsNeedEditor.length > 0) {
                // Step 2: Send an email to each permission user with the list of students
                const permissionEmailPromises = permissions.map((permission) => {
                    const userName = `${permission.user_id.firstname} ${permission.user_id.lastname}`;

                    // Format the list of student names for logging
                    const noEditorStudentsNeedEditorStringified = noEditorStudentsNeedEditor
                        .map((student) => `${student.firstname} ${student.lastname}`)
                        .join(", ");

                    console.log(
                        "noEditorStudentsNeedEditorStringified: ",
                        noEditorStudentsNeedEditorStringified
                    );

                    // Send email
                    const emailPromise = sendAssignEditorReminderEmailV2(
                        {
                            firstname: permission.user_id.firstname,
                            lastname: permission.user_id.lastname,
                            address: permission.user_id.email
                        },
                        {
                            noEditorStudents: noEditorStudentsNeedEditor.map((student) => ({
                                firstname: student.firstname,
                                lastname: student.lastname,
                                _id: student._id.toString()
                            }))
                        }
                    );

                    // Log the action
                    void emailPromise.then(() => {
                        console.log(
                            `${userName} is informed for assigning editor to ${noEditorStudentsNeedEditorStringified}`
                        );
                    });

                    return emailPromise;
                });

                // Step 3: Wait for all emails to be sent
                await Promise.all(permissionEmailPromises);
            }
        }
    } catch (error) {
        console.error("Error running AssignEditorTasksReminderEmails:", error);
        throw error;
    }
}
