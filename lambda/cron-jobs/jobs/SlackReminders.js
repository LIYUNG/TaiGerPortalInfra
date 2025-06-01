const { MongoClient } = require("mongodb");
const {
    TENANT_PORTAL_LINK,
    connStr,
    botToken,
    channelId,
    slackMemberIds
} = require("../../utils/constants");

/**
 * Database connection utilities
 */
const connectDB = async () => {
    try {
        const client = new MongoClient(connStr);
        await client.connect();
        return client;
    } catch (error) {
        console.error("Error connecting to database:", error);
        throw error;
    }
};

/**
 * Retrieves all active student users who have no assigned editors and at least one application,
 * along with their associated document threads that contain at least one message.
 * @returns {Promise<Array<Object>>} An array of student user objects, each including their matching document threads.
 */
const getNoEditorStudentActiveThreads = async () => {
    let client;
    try {
        client = await connectDB();
        const db = client.db("TaiGer_Prod");
        const userCollection = db.collection("users");

        const studentsWithActiveThreads = await userCollection
            .aggregate([
                {
                    $match: {
                        role: "Student",
                        $and: [
                            { $or: [{ archiv: { $exists: false } }, { archiv: false }] },
                            { $or: [{ editors: { $size: 0 } }, { editors: { $exists: false } }] }
                        ],
                        $expr: {
                            $gt: [
                                {
                                    $size: "$applications"
                                },
                                0
                            ]
                        }
                    }
                },
                {
                    $lookup: {
                        from: "documentthreads",
                        let: {
                            studentId: "$_id"
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            {
                                                $eq: ["$student_id", "$$studentId"]
                                            },
                                            {
                                                $gt: [
                                                    {
                                                        $size: "$messages"
                                                    },
                                                    0
                                                ]
                                            }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "documentthreads"
                    }
                },
                {
                    $match: {
                        $expr: {
                            $gt: [
                                {
                                    $size: "$documentthreads"
                                },
                                0
                            ]
                        }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        documentthreads: 1,
                        firstname: 1,
                        lastname: 1
                    }
                }
            ])
            .toArray();
        return studentsWithActiveThreads;
    } catch (error) {
        console.error("Error fetching threads:", error);
        throw error;
    } finally {
        if (client) {
            await client.close();
            console.log("Database connection closed");
        }
    }
};

/**
 * Retrieves the creation date of the first message in a thread sent by the student that contains a file.
 * @param {Object} thread - The thread object containing messages and student information.
 * @returns {string|null} The `createdAt` timestamp of the first matching message, or `null` if none found.
 */
const getFirstFileMsgInThread = (thread) => {
    const messages = thread.messages || [];
    const studentId = thread?.student_id?.toString();
    if (!messages || messages.length === 0 || !studentId) {
        return null;
    }

    const firstMsg = messages.find((message) => {
        const fromStudent = message.user_id.toString() === studentId;
        const hasFile = message.file && message.file.length > 0;
        return fromStudent && hasFile;
    });

    return firstMsg ? firstMsg.createdAt : null;
};

/**
 * Returns the earliest file message date from a list of threads.
 *
 * @param {Array} threads - An array of thread objects to search for file messages.
 * @returns {Date|null} The earliest file message date as a Date object, or null if none found.
 */
const getStudentEarliestFileMsg = (threads) => {
    if (!threads || threads.length === 0) {
        return null;
    }
    // Get all createdAt dates from studentFileMsgInThread, ignoring nulls
    const dates = threads
        .map(getFirstFileMsgInThread)
        .filter((firstMsgDatetime) => firstMsgDatetime !== null && firstMsgDatetime !== undefined)
        .map((firstMsgDatetime) => new Date(firstMsgDatetime));

    if (dates.length === 0) {
        return null;
    }

    // Return the earliest date
    return new Date(Math.min(...dates));
};

/**
 * Formats a Slack message link for a student, including their name, profile link,
 * days since their first file message, and the date/time of that message.
 *
 * @param {Object} student - The student object containing relevant information.
 * @returns {string} A formatted Slack message string with the student's profile link and message info.
 */
const formatStudentSlackLink = (student) => {
    const studentName = student ? `${student.firstname} ${student.lastname}` : "Unknown Student";
    const cleanDatetime = new Date(student?.firstFileMsgTime).toLocaleString("en-CA", {
        dateStyle: "short",
        timeStyle: "short"
    });
    const studentProfileLink = `<${TENANT_PORTAL_LINK}student-database/${student._id}|${studentName}>`;
    return `- ${studentProfileLink}: *${student?.daysSinceMessage}* days since first file message. (${cleanDatetime})`;
};

/**
 * Creates a formatted message for a specific time period
 * @param {Array} students - Array of thread objects
 * @param {number} days - Number of days
 * @param {boolean} shouldTag - Whether to include member tags
 * @returns {string} Formatted message
 */
const createTimeBasedMessage = (students, days, tagMember = []) => {
    if (!students || students.length === 0) {
        return null;
    }

    const studentThreadsList = students.map(formatStudentSlackLink).join("\n\n");

    const memberTags =
        tagMember.length > 0 ? `\n\n cc: ${tagMember.map((member) => "<@" + member + ">")}` : "";

    return `📌 *Over ${days} Days - Editor not Assigned* \n*超過${days}天未指派顧問或編輯：* \n\n${studentThreadsList}${memberTags}`;
};

/**
 * Generates the reminder message blocks for Slack
 * @param {Array} students - Array of thread objects
 * @returns {Array} Slack message blocks
 */
const generateEditorAssignmentSlackBlocks = (students) => {
    if (!students || students.length === 0) {
        return null;
    }

    const currentDateTime = new Date();
    const enCurrentDateTime = currentDateTime.toLocaleString("en-CA", {
        dateStyle: "short",
        timeStyle: "short"
    });
    const zhCurrentDateTime = currentDateTime.toLocaleString("zh-tw", {
        dateStyle: "long",
        timeStyle: "short"
    });

    // Filter threads for different time periods
    const sevenDayStudents = students.filter((student) => {
        const daysSinceMessage = student?.daysSinceMessage;
        return daysSinceMessage > 7;
    });
    const threeDayStudents = students.filter((student) => {
        const daysSinceMessage = student?.daysSinceMessage;
        return daysSinceMessage > 3 && daysSinceMessage <= 7;
    });

    // Create messages only if there are threads for each period
    const sevenDayMessage = createTimeBasedMessage(sevenDayStudents, 7, [
        slackMemberIds.David,
        slackMemberIds.Sydney
    ]);
    const threeDayMessage = createTimeBasedMessage(threeDayStudents, 3, [slackMemberIds.Lena]);

    const blocks = [
        {
            type: "header",
            text: {
                type: "plain_text",
                text: "🔔 [Attention] Request for Editor Assignment | 指派提醒通知"
            }
        },
        {
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: `*Generated on:* ${enCurrentDateTime} | *生成時間:* ${zhCurrentDateTime}`
                }
            ]
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: "*Hi team*,\nThe following student cases have *not been assigned* within the expected timeframe.\n*以下學生案件尚未完成指派，請儘速處理，謝謝！*"
            }
        }
    ];

    // Only add sections if there are threads for that time period
    if (sevenDayMessage) {
        blocks.push(
            { type: "divider" },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: sevenDayMessage
                }
            }
        );
    }

    if (threeDayMessage) {
        blocks.push(
            { type: "divider" },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: threeDayMessage
                }
            }
        );
    }

    // Only add the context block if there are any threads to process
    if (sevenDayMessage || threeDayMessage) {
        blocks.push({
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: "Please check these cases and follow up accordingly. 請確認以上案件並盡快跟進處理。"
                }
            ]
        });
    }

    return blocks;
};

/**
 * Sends a message to a Slack channel
 * @param {string} channelId - The Slack channel ID
 * @param {string} message - The message text
 * @param {Array} blocks - The message blocks
 * @returns {Promise<boolean>} Success status
 */
const postSlackMessage = async (channelId, message = "", blocks = []) => {
    if (!channelId) {
        console.error("Channel ID is required");
        return false;
    }

    try {
        const response = await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${botToken}`
            },
            body: JSON.stringify({
                channel: channelId,
                text: message,
                blocks: blocks,
                unfurl_links: false, // disable link previews
                unfurl_media: false
            })
        });

        const data = await response.json();

        if (!data.ok) {
            console.error("Error sending Slack message:", data.error);
            return false;
        }

        return true;
    } catch (error) {
        console.error("Error sending Slack message:", error);
        return false;
    }
};

/**
 * Main function to send Editor assignment reminders
 */
const sendEditorAssignmentReminder = async () => {
    try {
        const studentThreads = await getNoEditorStudentActiveThreads();
        const needEditorStudents = studentThreads
            .map((student) => {
                const firstFileMsgTime = getStudentEarliestFileMsg(student.documentthreads);
                const daysSinceMessage = firstFileMsgTime
                    ? Math.floor((new Date() - new Date(firstFileMsgTime)) / (1000 * 60 * 60 * 24))
                    : null;
                return firstFileMsgTime ? { ...student, firstFileMsgTime, daysSinceMessage } : null;
            })
            .filter((student) => student !== null);

        if (needEditorStudents.length === 0) {
            console.log("No students need reminders.");
            return;
        }
        const messageBlocks = generateEditorAssignmentSlackBlocks(needEditorStudents);
        await postSlackMessage(channelId, "", messageBlocks);
        console.log(
            `Editor assignment reminder sent successfully. (${needEditorStudents.length} students)`
        );
    } catch (error) {
        console.error("Error in sendEditorAssignmentReminder:", error);
    }
};

// Execute the reminder
sendEditorAssignmentReminder();
