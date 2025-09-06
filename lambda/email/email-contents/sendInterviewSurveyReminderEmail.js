const ENGLISH_BELOW = "English below";
const SPLIT_LINE = "----------------------------------------";

const sendInterviewSurveyReminderEmail = async (recipient, interview, reminderType) => {
    const studentName = `${recipient.firstname} ${recipient.lastname}`;
    const programName = `${interview.program_id.school} ${interview.program_id.program_name} ${interview.program_id.degree} ${interview.program_id.semester}`;
    const interviewSurveyUrl = `${process.env.ORIGIN}/interview-training/${interview._id}/survey`;

    let subject, message;
    if (reminderType === 'first') {
        subject = `[TODO][Urgent] Interview Survey for ${programName}`;
        message = `\
<p>${ENGLISH_BELOW}</p>

<p>嗨 ${studentName},</p>

<p>幾天前，您參加了 <b>${programName}</b> 的面試。</p>

<p>我們誠摯地邀請您花費2分鐘完成這份簡短的問卷。您的回饋對我們來說非常寶貴，將幫助我們更好地支持未來的學生完成他們的申請之旅。</p>

<a href="${interviewSurveyUrl}" class="mui-button" target="_blank">開啟面試問卷</a>

<p>謝謝您的參與！</p>

<br />

<p>${SPLIT_LINE}</p>

<p>Hi ${studentName},</p>

<p>A few days ago, you had your interview for <b>${programName}</b>.</p>

<p>We would greatly appreciate it if you could take <b>2 minutes</b> to complete our <b>short survey</b>. Your feedback is incredibly valuable and will help us better support future students on their application journey.</p>

<a href="${interviewSurveyUrl}" class="mui-button" target="_blank">CLICK TO OPEN THE SURVEY</a>

<p>Thank you for your participation!</p>`;
    } else {
        subject = 'Final Reminder - Interview Training Survey';
        message = `\
<p>${ENGLISH_BELOW}</p>

<p>嗨 ${studentName},</p>

<p>您參加 <b>${programName}</b> 的面試已經幾天了。您是否已經有機會分享您對面試訓練的回饋？</p>

<p>我們非常重視您的意見，因為這將幫助我們改進並更好地支持未來的學生完成他們的申請過程。</p>

<a href="${interviewSurveyUrl}" class="mui-button" target="_blank">開啟面試問卷</a>

<p>如果您有任何問題，請隨時聯繫您的訓練官或顧問。</p>

<p>謝謝您的參與！</p>

<br />

<p>${SPLIT_LINE}</p>

<p>Hi ${studentName},</p>

<p>Your interview for <b>${programName}</b> was a few days ago. Have you had a chance to share your feedback on the interview training?</p>

<p>We truly appreciate your input, as it helps us improve and better support future students in their application process.</p>

<a href="${interviewSurveyUrl}" class="mui-button" target="_blank">CLICK TO OPEN THE SURVEY</a>

<p>If you have any questions, feel free to reach out to your trainer or agent.</p>

<p>Thank you for your participation!</p>`;
    }

    return { subject, message };
};

module.exports = { sendInterviewSurveyReminderEmail }; 