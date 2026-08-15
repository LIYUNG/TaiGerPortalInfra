import { createTransport, SentMessageInfo, Transporter } from "nodemailer";
import Bottleneck from "bottleneck/es5";

import { htmlContent } from "./email-template";
import { ses, SendRawEmailCommand } from "../aws";
import { Recipient } from "./types";

const senderEmail = "no-reply@taigerconsultancy-portal.com";
const taigerNotReplyGmail = "noreply.taigerconsultancy@gmail.com";
const senderName = `No-Reply TaiGer Consultancy ${senderEmail}`;

export const transporter: Transporter<SentMessageInfo> = createTransport({
    SES: { ses, aws: { SendRawEmailCommand } }
});

const limiter = new Bottleneck({
    minTime: 1100 / 14
});

export const sendEmail = async (
    to: Recipient,
    subject: string,
    message: string
): Promise<SentMessageInfo> => {
    const mail = {
        from: senderName,
        to: to.address,
        bcc: taigerNotReplyGmail,
        subject,
        html: htmlContent(message)
    };

    return limiter.schedule(() => transporter.sendMail(mail));
};
