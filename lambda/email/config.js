const { createTransport } = require("nodemailer");
const Bottleneck = require("bottleneck/es5");

const { htmlContent } = require("./email-template");

const transporter = createTransport({
    SES: { ses, aws: { SendRawEmailCommand } }
});

const limiter = new Bottleneck({
    minTime: 1100 / 14
});

const sendEmail = (to, subject, message) => {
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
