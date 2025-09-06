const { connectToDatabase } = require("../../db");
const { sendEmail } = require("../../email/config");
const { isNotArchiv } = require("@taiger-common/core");
const { sendInterviewSurveyReminderEmail } = require("../../email/email-contents/sendInterviewSurveyReminderEmail");

const ENGLISH_BELOW = "English below";
const SPLIT_LINE = "----------------------------------------";

async function InterviewSurveyReminderEmails() {
    console.log("Executing tasks for Job InterviewSurveyReminderEmails...");
    try {
        // Connect to MongoDB
        const db = await connectToDatabase();

        // Get current date
        const currentDate = new Date();
        
        // Find interviews that:
        // 1. Have no survey response
        // 2. Are not closed
        // 3. Have an interview date
        const interviews = await db.collection('interviews')
            .find({
                isClosed: false,
                interview_date: { $exists: true, $ne: null }
            })
            .toArray();

        // Find all survey responses
        const surveyResponses = await db.collection('interviewsurveyresponses')
            .find({})
            .project({ interview_id: 1 })
            .toArray();

        // Create a set of interview IDs that have survey responses
        const respondedInterviewIds = new Set(surveyResponses.map(survey => survey.interview_id.toString()));

        // Get all student and program IDs for population
        const studentIds = interviews.map(interview => interview.student_id);
        const programIds = interviews.map(interview => interview.program_id);

        // Fetch all related students and programs
        const [students, programs] = await Promise.all([
            db.collection('users').find({ _id: { $in: studentIds } }).toArray(),
            db.collection('programs').find({ _id: { $in: programIds } }).toArray()
        ]);

        // Create lookup maps
        const studentMap = new Map(students.map(student => [student._id.toString(), student]));
        const programMap = new Map(programs.map(program => [program._id.toString(), program]));

        // Filter interviews that need reminders
        const interviewsNeedingReminders = interviews.filter(interview => {
            const student = studentMap.get(interview.student_id.toString());
            if (!student || !isNotArchiv(student)) return false;
            if (respondedInterviewIds.has(interview._id.toString())) return false;

            const interviewDate = new Date(interview.interview_date);
            const daysSinceInterview = Math.floor((currentDate - interviewDate) / (1000 * 60 * 60 * 24));

            // Send first reminder after 3 days
            if (daysSinceInterview === 3) {
                interview.reminderType = 'first';
                interview.student_id = student;
                interview.program_id = programMap.get(interview.program_id.toString());
                return true;
            }
            // Send second reminder after 7 days
            else if (daysSinceInterview === 7) {
                interview.reminderType = 'second';
                interview.student_id = student;
                interview.program_id = programMap.get(interview.program_id.toString());
                return true;
            }
            return false;
        });

        // Send reminder emails
        for (const interview of interviewsNeedingReminders) {
            try {
                const { subject, message } = await sendInterviewSurveyReminderEmail(
                    interview.student_id,
                    interview,
                    interview.reminderType
                );
                await sendEmail(interview.student_id.email, subject, message);
                console.log(`Sent ${interview.reminderType} reminder email to ${interview.student_id.email}`);
            } catch (error) {
                console.error(`Failed to send reminder email to ${interview.student_id.email}:`, error);
            }
        }
    } catch (error) {
        console.error("Error in InterviewSurveyReminderEmails:", error);
        throw error;
    }
}

module.exports = { InterviewSurveyReminderEmails }; 