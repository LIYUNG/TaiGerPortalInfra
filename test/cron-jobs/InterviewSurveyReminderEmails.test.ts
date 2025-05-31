import { InterviewSurveyReminderEmails } from 'lambda/cron-jobs/jobs/InterviewSurveyReminderEmails';
import { connectToDatabase } from 'lambda/db';
import { sendEmail } from 'lambda/email/config';
import { sendInterviewSurveyReminderEmail } from 'lambda/email/email-contents/sendInterviewSurveyReminderEmail';

// Mock dependencies
jest.mock('lambda/db', () => ({
    connectToDatabase: jest.fn()
}));

jest.mock('lambda/email/config', () => ({
    sendEmail: jest.fn()
}));

jest.mock('lambda/email/email-contents/sendInterviewSurveyReminderEmail', () => ({
    sendInterviewSurveyReminderEmail: jest.fn()
}));

describe('InterviewSurveyReminderEmails', () => {
    let mockDb: any;
    let mockInterviews: any[];
    let mockSurveyResponses: any[];
    let mockStudents: any[];
    let mockPrograms: any[];

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Setup mock data
        mockInterviews = [
            {
                _id: '1',
                student_id: 'student1',
                program_id: 'program1',
                interview_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
                isClosed: false
            },
            {
                _id: '2',
                student_id: 'student2',
                program_id: 'program2',
                interview_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
                isClosed: false
            }
        ];

        mockSurveyResponses = [
            { interview_id: '3' } // Different interview ID to test filtering
        ];

        mockStudents = [
            {
                _id: 'student1',
                firstname: 'John',
                lastname: 'Doe',
                email: 'john@example.com',
                archiv: false
            },
            {
                _id: 'student2',
                firstname: 'Jane',
                lastname: 'Smith',
                email: 'jane@example.com',
                archiv: false
            }
        ];

        mockPrograms = [
            {
                _id: 'program1',
                school: 'Test School',
                program_name: 'Test Program',
                degree: 'Bachelor',
                semester: 'Fall 2024'
            },
            {
                _id: 'program2',
                school: 'Test School 2',
                program_name: 'Test Program 2',
                degree: 'Master',
                semester: 'Spring 2024'
            }
        ];

        // Setup mock database
        mockDb = {
            collection: jest.fn().mockImplementation((collectionName: string) => ({
                find: jest.fn().mockReturnThis(),
                project: jest.fn().mockReturnThis(),
                toArray: jest.fn().mockImplementation(() => {
                    switch (collectionName) {
                        case 'interviews':
                            return Promise.resolve(mockInterviews);
                        case 'interviewsurveyresponses':
                            return Promise.resolve(mockSurveyResponses);
                        case 'users':
                            return Promise.resolve(mockStudents);
                        case 'programs':
                            return Promise.resolve(mockPrograms);
                        default:
                            return Promise.resolve([]);
                    }
                })
            }))
        };

        (connectToDatabase as jest.Mock).mockResolvedValue(mockDb);
        (sendEmail as jest.Mock).mockResolvedValue(true);
        (sendInterviewSurveyReminderEmail as jest.Mock).mockImplementation((student: any, interview: any, type: string) => ({
            subject: `Test Subject ${type}`,
            message: `Test Message ${type}`
        }));
    });

    it('should send reminder emails for interviews at 3 and 7 days', async () => {
        console.log('\n🧪 Running test: should send reminder emails for interviews at 3 and 7 days');
        
        // Execute the cronjob
        await InterviewSurveyReminderEmails();

        // Verify database connections
        expect(connectToDatabase).toHaveBeenCalled();

        // Verify email sending
        expect(sendEmail).toHaveBeenCalledTimes(2);
        expect(sendInterviewSurveyReminderEmail).toHaveBeenCalledTimes(2);

        // Verify first reminder (3 days)
        expect(sendInterviewSurveyReminderEmail).toHaveBeenCalledWith(
            expect.objectContaining({ _id: 'student1' }),
            expect.objectContaining({ _id: '1', reminderType: 'first' }),
            'first'
        );

        // Verify second reminder (7 days)
        expect(sendInterviewSurveyReminderEmail).toHaveBeenCalledWith(
            expect.objectContaining({ _id: 'student2' }),
            expect.objectContaining({ _id: '2', reminderType: 'second' }),
            'second'
        );

        console.log('✅ Test completed successfully');
    });

    it('should not send reminders for archived students', async () => {
        console.log('\n🧪 Running test: should not send reminders for archived students');
        
        // Modify a student to be archived
        mockStudents[0].archiv = true;

        await InterviewSurveyReminderEmails();

        // Should only send one email (for non-archived student)
        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendInterviewSurveyReminderEmail).toHaveBeenCalledTimes(1);

        console.log('✅ Test completed successfully');
    });

    it('should not send reminders for interviews with survey responses', async () => {
        console.log('\n🧪 Running test: should not send reminders for interviews with survey responses');
        
        // Add a survey response for one of the interviews
        mockSurveyResponses.push({ interview_id: '1' });

        await InterviewSurveyReminderEmails();

        // Should only send one email (for interview without response)
        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendInterviewSurveyReminderEmail).toHaveBeenCalledTimes(1);

        console.log('✅ Test completed successfully');
    });

    it('should handle errors gracefully', async () => {
        console.log('\n🧪 Running test: should handle errors gracefully');
        
        // Mock an error in sendEmail
        (sendEmail as jest.Mock).mockRejectedValueOnce(new Error('Email sending failed'));

        // Should not throw error
        await expect(InterviewSurveyReminderEmails()).resolves.not.toThrow();

        // Should still attempt to send other emails
        expect(sendEmail).toHaveBeenCalledTimes(2);

        console.log('✅ Test completed successfully');
    });
}); 