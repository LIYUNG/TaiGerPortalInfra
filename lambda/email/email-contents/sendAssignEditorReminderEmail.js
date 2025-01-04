const { sendEmail } = require("../config");
const { SPLIT_LINE } = require("../email-template");

const BASE_DOCUMENT_FOR_AGENT_URL = (studentId) =>
    new URL(`/student-database/${studentId}#profile`, process.env.ORIGIN).href;

const sendAssignEditorReminderEmail = async (recipient, payload) => {
    const student_name = `${payload.student_firstname} - ${payload.student_lastname}`;
    const baseDocumentLink = `${BASE_DOCUMENT_FOR_AGENT_URL(payload.student_id)}`;
    const subject = "[DO NOT IGNORE] Assign Editor Reminder";
    const message = `\
<p>Hi ${recipient.firstname} ${recipient.lastname},</p>

<p>${student_name} has uploaded some input in his/her CVMLRL Center, <b>but she/he did not have any Editor yet.</b></p>

<p><b>Please assign an Editor to the student <a href="${baseDocumentLink}">${student_name}</a></b></p>

<a href="${baseDocumentLink}" class="mui-button" target="_blank">Assign Editor</a>

<p>${SPLIT_LINE}</p>

<p>${student_name} 上傳了一份文件至他的 CVMLRL Cetner，但他目前並無任何編輯。</p>

<p><b>請指派編輯學生 <a href="${baseDocumentLink}">${student_name}</a></b></p>

<a href="${baseDocumentLink}" class="mui-button" target="_blank">指派編輯</a>

`; // should be for admin/editor/agent/student

    return sendEmail(recipient, subject, message);
};

module.exports = { sendAssignEditorReminderEmail };
