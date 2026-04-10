const normalizePhone = (rawPhone) => {
    if (!rawPhone) return "";
    const onlyDigits = String(rawPhone).replace(/\D/g, "");
    if (!onlyDigits) return "";
    if (String(rawPhone).startsWith("+")) return String(rawPhone);
    if (onlyDigits.length === 10) return `+91${onlyDigits}`;
    return `+${onlyDigits}`;
};

const sendAppointmentReminderSMS = async ({ userPhone, doctorName, slotDate, slotTime }) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
        return { sent: false, reason: "Twilio not configured" };
    }

    const to = normalizePhone(userPhone);
    if (!to) {
        return { sent: false, reason: "User phone missing or invalid" };
    }

    const body = `Reminder: Appointment tomorrow with Dr. ${doctorName} at ${slotTime} on ${slotDate}. - Kiaan Clinic`;

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            To: to,
            From: fromNumber,
            Body: body
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        return { sent: false, reason: `Twilio error: ${errorText}` };
    }

    return { sent: true };
};

const buildAppointmentSmsBody = ({ eventType, statusLabel, doctorName, slotDate, slotTime, note = "" }) => {
    const safeDoctor = doctorName || "Doctor";
    const safeDate = slotDate || "N/A";
    const safeTime = slotTime || "N/A";
    const safeStatus = statusLabel || "Updated";

    if (eventType === "booked") {
        return `Appointment booked: ${safeStatus}. Dr. ${safeDoctor}, ${safeDate} at ${safeTime}. - Kiaan Clinic`;
    }

    if (eventType === "cancelled") {
        return `Appointment cancelled. Dr. ${safeDoctor}, ${safeDate} at ${safeTime}.${note ? ` ${note}` : ""} - Kiaan Clinic`;
    }

    return `Appointment status changed to ${safeStatus}. Dr. ${safeDoctor}, ${safeDate} at ${safeTime}.${note ? ` ${note}` : ""} - Kiaan Clinic`;
};

const sendAppointmentEventSMS = async ({
    toPhone,
    eventType,
    statusLabel,
    doctorName,
    slotDate,
    slotTime,
    note = ""
}) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
        return { sent: false, reason: "Twilio not configured" };
    }

    const to = normalizePhone(toPhone);
    if (!to) {
        return { sent: false, reason: "Recipient phone missing or invalid" };
    }

    const body = buildAppointmentSmsBody({
        eventType,
        statusLabel,
        doctorName,
        slotDate,
        slotTime,
        note
    });

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            To: to,
            From: fromNumber,
            Body: body
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        return { sent: false, reason: `Twilio error: ${errorText}` };
    }

    return { sent: true };
};

export { sendAppointmentReminderSMS, sendAppointmentEventSMS };
