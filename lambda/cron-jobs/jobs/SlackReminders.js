const { MongoClient } = require("mongodb");
const { connStr, botToken, channelId } = require("../../utils/constants");

const connectDB = async () => {
    try {
        const client = new MongoClient(connStr);
        await client.connect();
        return client;
    } catch (error) {
        console.error("Error connecting to database:", error);
    }
};

const getrecentThreads = async () => {
    const client = await connectDB();
    const db = client.db("TaiGer");
    const threadCollection = db.collection("documentthreads");

    try {
        const recentThreads = await threadCollection
            .aggregate([
                { $match: { file_type: "Essay" } },
                { $sort: { updatedAt: -1 } },
                { $limit: 3 },
                {
                    $project: {
                        _id: 1,
                        student_id: 1,
                        program_id: 1,
                        file_type: 1,
                        updatedAt: 1
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "student_id",
                        foreignField: "_id",
                        as: "student",
                        pipeline: [{ $project: { email: 1, firstname: 1, lastname: 1, _id: 1 } }]
                    }
                },
                {
                    $lookup: {
                        from: "programs",
                        localField: "program_id",
                        foreignField: "_id",
                        as: "program",
                        pipeline: [{ $project: { school: 1, program_name: 1 } }]
                    }
                }
            ])
            .toArray();
        return recentThreads;
    } catch (error) {
        console.error("Error fetching threads:", error);
    } finally {
        await client.close();
        console.log("Database connection closed");
    }
};

const getEssayAssignmentReminderText = (threads) => {
    if (!threads || threads.length === 0) {
        return;
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

    // Create a list of student threads with hyperlinks
    const studentThreadsList = threads
        .map((thread) => {
            const studentName = thread.student?.[0]
                ? `${thread.student[0].firstname} ${thread.student[0].lastname}`
                : "Unknown Student";
            const studentProfileLink = `<https://taigerconsultancy-portal.com/student-database/${thread.student_id}|${studentName}>`;
            const threadLink = `<https://taigerconsultancy-portal.com/document-modification/${thread._id}|View Thread>`;
            const programInfo = thread.program?.[0]
                ? `${thread.program[0].school} - ${thread.program[0].program_name}`
                : "N/A";

            return `- ${studentProfileLink} - ${threadLink}\n\t*${programInfo}*`;
        })
        .join("\n\n");

    const blocks = [
        {
            type: "header",
            text: {
                type: "plain_text",
                text: "🔔 [Attention] Request for Essay Writer Assignment | 指派提醒通知"
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
        },
        {
            type: "divider"
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `📌 *Over 7 Days - Editor or Essay Writer Not Assigned* \n*超過7天未指派顧問或編輯：* \n\n${studentThreadsList}`
            }
        },
        {
            type: "divider"
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `📌 *Over 3 Days - Editor or Essay Writer Not Assigned* \n*超過3天未指派顧問或編輯：*\n\n${studentThreadsList}`
            }
        },
        {
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: "Please check these cases and follow up accordingly. 請確認以上案件並盡快跟進處理。"
                }
            ]
        }
    ];

    return blocks;
};

const sendSlackMessage = async (channelId, message = "", blocks = []) => {
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
                blocks: blocks
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

const sendEssayAssignmentReminder = async () => {
    const threads = await getrecentThreads();
    const message = getEssayAssignmentReminderText(threads);
    sendSlackMessage(channelId, "", message);
};

sendEssayAssignmentReminder();
