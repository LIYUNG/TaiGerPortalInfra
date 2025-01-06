const { sendEmail } = require("../config");
const { SPLIT_LINE } = require("../email-template");

const BASE_DOCUMENT_FOR_AGENT_URL = (studentId) =>
    new URL(`/student-database/${studentId}#profile`, process.env.ORIGIN).href;

const sendAssignEditorReminderEmailV2 = async (recipient, payload) => {
    let studentNames = "<ul>";
    for (let i = 0; i < payload.noEditorStudents.length; i += 1) {
        const studentName = `${payload.noEditorStudents[i].firstname} ${payload.noEditorStudents[i].lastname}`;
        const studentIdLink = `${BASE_DOCUMENT_FOR_AGENT_URL(payload.noEditorStudents[i]._id.toString())}`;
        studentNames += `<li><a href="${studentIdLink}" target="_blank" class="mui-button" rel="noopener noreferrer">Assign Editor to ${studentName}</a></li>`;
    }
    studentNames += "</ul>";
    // payload.noEditorStudents?.map((student)=>);
    const subject = "[DO NOT IGNORE] Assign Editor Reminder";
    const message = `\
<p>Hi ${recipient.firstname} ${recipient.lastname},</p>

<p> The following students have uploaded some input in his/her CVMLRL Center, <b>but they did not have any Editor yet.</b></p>

${studentNames}

<p><b>Please assign an Editor to the students above</b></p>

<p>${SPLIT_LINE}</p>

<p>以下學生上傳了一份文件至他的 CVMLRL Cetner，但他目前並無任何編輯。</p>

${studentNames} 

<p><b>請指派編輯給以上學生。</b></p>

`; // should be for admin/editor/agent/student

    return sendEmail(recipient, subject, message);
};

module.exports = { sendAssignEditorReminderEmailV2 };
