import nodemailer from "nodemailer";

const createTransporter = () => {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        return null;
    }

    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    });
};

const sendDoctorFeedbackEmail = async ({ doctorEmail, doctorName, userName, rating, comment }) => {
    const transporter = createTransporter();

    if (!transporter || !doctorEmail) {
        return { sent: false, reason: "SMTP not configured or doctor email missing" };
    }

    const fromEmail = process.env.MAIL_FROM || process.env.SMTP_USER;

    await transporter.sendMail({
        from: fromEmail,
        to: doctorEmail,
        subject: `New feedback from ${userName}`,
        text: `Hello Dr. ${doctorName},\n\nYou received new feedback from ${userName}.\n\nRating: ${rating}/5\nComment: ${comment}\n\nRegards,\nKiaan Clinic`,
        html: `
            <p>Hello Dr. ${doctorName},</p>
            <p>You received new feedback from <strong>${userName}</strong>.</p>
            <p><strong>Rating:</strong> ${rating}/5</p>
            <p><strong>Comment:</strong> ${comment}</p>
            <p>Regards,<br/>Kiaan Clinic</p>
        `
    });

    return { sent: true };
};

const sendAppointmentReminderEmail = async ({ userEmail, userName, doctorName, slotDate, slotTime }) => {
    const transporter = createTransporter();

    if (!transporter || !userEmail) {
        return { sent: false, reason: "SMTP not configured or user email missing" };
    }

    const fromEmail = process.env.MAIL_FROM || process.env.SMTP_USER;

    await transporter.sendMail({
        from: fromEmail,
        to: userEmail,
        subject: "Appointment Reminder - Tomorrow",
        text: `Hello ${userName},\n\nThis is a reminder for your appointment tomorrow.\nDoctor: ${doctorName}\nDate: ${slotDate}\nTime: ${slotTime}\n\nRegards,\nKiaan Clinic`,
        html: `
            <p>Hello ${userName},</p>
            <p>This is a reminder for your appointment tomorrow.</p>
            <p><strong>Doctor:</strong> ${doctorName}</p>
            <p><strong>Date:</strong> ${slotDate}</p>
            <p><strong>Time:</strong> ${slotTime}</p>
            <p>Regards,<br/>Kiaan Clinic</p>
        `
    });

    return { sent: true };
};

const buildAppointmentEmailContent = ({
    recipientName,
    eventType,
    statusLabel,
    doctorName,
    userName,
    slotDate,
    slotTime,
    note = ""
}) => {
    const safeRecipient = recipientName || "there";
    const safeDoctor = doctorName || "Doctor";
    const safeUser = userName || "Patient";
    const safeDate = slotDate || "N/A";
    const safeTime = slotTime || "N/A";
    const safeStatus = statusLabel || "Updated";

    if (eventType === "booked") {
        return {
            subject: `Appointment booked: ${safeStatus}`,
            text: `Hello ${safeRecipient},\n\nYour appointment has been booked.\nStatus: ${safeStatus}\nDoctor: ${safeDoctor}\nPatient: ${safeUser}\nDate: ${safeDate}\nTime: ${safeTime}\n\nRegards,\nKiaan Clinic`,
            html: `
                <p>Hello ${safeRecipient},</p>
                <p>Your appointment has been booked.</p>
                <p><strong>Status:</strong> ${safeStatus}</p>
                <p><strong>Doctor:</strong> ${safeDoctor}</p>
                <p><strong>Patient:</strong> ${safeUser}</p>
                <p><strong>Date:</strong> ${safeDate}</p>
                <p><strong>Time:</strong> ${safeTime}</p>
                <p>Regards,<br/>Kiaan Clinic</p>
            `
        };
    }

    if (eventType === "cancelled") {
        return {
            subject: "Appointment cancelled",
            text: `Hello ${safeRecipient},\n\nYour appointment has been cancelled.\nDoctor: ${safeDoctor}\nPatient: ${safeUser}\nDate: ${safeDate}\nTime: ${safeTime}${note ? `\nNote: ${note}` : ""}\n\nRegards,\nKiaan Clinic`,
            html: `
                <p>Hello ${safeRecipient},</p>
                <p>Your appointment has been cancelled.</p>
                <p><strong>Doctor:</strong> ${safeDoctor}</p>
                <p><strong>Patient:</strong> ${safeUser}</p>
                <p><strong>Date:</strong> ${safeDate}</p>
                <p><strong>Time:</strong> ${safeTime}</p>
                ${note ? `<p><strong>Note:</strong> ${note}</p>` : ""}
                <p>Regards,<br/>Kiaan Clinic</p>
            `
        };
    }

    return {
        subject: `Appointment status updated: ${safeStatus}`,
        text: `Hello ${safeRecipient},\n\nYour appointment status has changed.\nNew Status: ${safeStatus}\nDoctor: ${safeDoctor}\nPatient: ${safeUser}\nDate: ${safeDate}\nTime: ${safeTime}${note ? `\nNote: ${note}` : ""}\n\nRegards,\nKiaan Clinic`,
        html: `
            <p>Hello ${safeRecipient},</p>
            <p>Your appointment status has changed.</p>
            <p><strong>New Status:</strong> ${safeStatus}</p>
            <p><strong>Doctor:</strong> ${safeDoctor}</p>
            <p><strong>Patient:</strong> ${safeUser}</p>
            <p><strong>Date:</strong> ${safeDate}</p>
            <p><strong>Time:</strong> ${safeTime}</p>
            ${note ? `<p><strong>Note:</strong> ${note}</p>` : ""}
            <p>Regards,<br/>Kiaan Clinic</p>
        `
    };
};

const sendAppointmentEventEmail = async ({
    toEmail,
    recipientName,
    eventType,
    statusLabel,
    doctorName,
    userName,
    slotDate,
    slotTime,
    note = ""
}) => {
    const transporter = createTransporter();

    if (!transporter || !toEmail) {
        return { sent: false, reason: "SMTP not configured or recipient email missing" };
    }

    const fromEmail = process.env.MAIL_FROM || process.env.SMTP_USER;
    const content = buildAppointmentEmailContent({
        recipientName,
        eventType,
        statusLabel,
        doctorName,
        userName,
        slotDate,
        slotTime,
        note
    });

    await transporter.sendMail({
        from: fromEmail,
        to: toEmail,
        subject: content.subject,
        text: content.text,
        html: content.html
    });

    return { sent: true };
};

export { sendDoctorFeedbackEmail, sendAppointmentReminderEmail, sendAppointmentEventEmail };
