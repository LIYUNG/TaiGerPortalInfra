const { createTransport } = require("nodemailer");
const Bottleneck = require("bottleneck/es5");

const { htmlContent } = require("./email-template");
const { ses, SendRawEmailCommand } = require("../aws");

const senderEmail = "no-reply@taigerconsultancy-portal.com";
const taigerNotReplyGmail = "noreply.taigerconsultancy@gmail.com";
const senderName = `No-Reply TaiGer Consultancy ${senderEmail}`;

const transporter = createTransport({
    SES: { ses, aws: { SendRawEmailCommand } }
});

const limiter = new Bottleneck({
    minTime: 1100 / 14
});

const sendEmail = async (to, subject, message) => {
    const mail = {
        from: senderName,
        to,
        bcc: taigerNotReplyGmail,
        subject,
        html: htmlContent(message)
    };

    return limiter.schedule(() => transporter.sendMail(mail));
};

module.exports = { transporter, sendEmail };
