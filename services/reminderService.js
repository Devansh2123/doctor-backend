import appointmentModel from "../models/appointmentModel.js";
import { sendAppointmentReminderEmail } from "../utils/mailService.js";
import { sendAppointmentReminderSMS } from "../utils/smsService.js";
import { getIO } from "../utils/socket.js";

const REMINDER_INTERVAL_MS = 5 * 60 * 1000;
const REMINDER_WINDOW_MINUTES = 60;

const getSlotDateKey = (date) => `${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}`;

const formatSlotDate = (slotDate) => {
    const [day, month, year] = String(slotDate).split("_").map(Number);
    const jsDate = new Date(year, (month || 1) - 1, day || 1);
    return jsDate.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
};

const parseSlotDateTime = (slotDate, slotTime) => {
    if (!slotDate || !slotTime) return null;

    const [day, month, year] = String(slotDate).split("_").map(Number);
    if (!day || !month || !year) return null;

    const match = String(slotTime).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return null;

    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridiem = match[3] ? match[3].toUpperCase() : "";

    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;

    return new Date(year, month - 1, day, hours, minutes, 0, 0);
};

const getSlotDatesInWindow = (start, end) => {
    const dates = new Set([getSlotDateKey(start)]);
    if (start.getDate() !== end.getDate() || start.getMonth() !== end.getMonth() || start.getFullYear() !== end.getFullYear()) {
        dates.add(getSlotDateKey(end));
    }
    return Array.from(dates);
};

const runAppointmentReminders = async () => {
    try {
        const now = new Date();
        const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MINUTES * 60 * 1000);
        const slotDates = getSlotDatesInWindow(now, windowEnd);

        const appointments = await appointmentModel.find({
            slotDate: { $in: slotDates },
            cancelled: false,
            isCompleted: false,
            appReminderSent: { $ne: true }
        });

        for (const appointment of appointments) {
            const appointmentDate = parseSlotDateTime(appointment.slotDate, appointment.slotTime);
            if (!appointmentDate || appointmentDate < now || appointmentDate > windowEnd) {
                continue;
            }

            const updates = {};

            if (!appointment.emailReminderSent) {
                try {
                    const emailResult = await sendAppointmentReminderEmail({
                        userEmail: appointment.userData?.email,
                        userName: appointment.userData?.name || "Patient",
                        doctorName: appointment.docData?.name || "Doctor",
                        slotDate: formatSlotDate(appointment.slotDate),
                        slotTime: appointment.slotTime
                    });

                    if (emailResult.sent) {
                        updates.emailReminderSent = true;
                        updates.emailReminderSentAt = Date.now();
                    } else {
                        console.log(`Email reminder skipped for ${appointment._id}: ${emailResult.reason}`);
                    }
                } catch (emailError) {
                    console.log(`Email reminder failed for ${appointment._id}: ${emailError.message}`);
                }
            }

            if (!appointment.smsReminderSent) {
                try {
                    const smsResult = await sendAppointmentReminderSMS({
                        userPhone: appointment.userData?.phone,
                        doctorName: appointment.docData?.name || "Doctor",
                        slotDate: formatSlotDate(appointment.slotDate),
                        slotTime: appointment.slotTime
                    });

                    if (smsResult.sent) {
                        updates.smsReminderSent = true;
                        updates.smsReminderSentAt = Date.now();
                    } else {
                        console.log(`SMS reminder skipped for ${appointment._id}: ${smsResult.reason}`);
                    }
                } catch (smsError) {
                    console.log(`SMS reminder failed for ${appointment._id}: ${smsError.message}`);
                }
            }

            if (!appointment.appReminderSent) {
                try {
                    const io = getIO();
                    const payload = {
                        appointmentId: appointment._id,
                        userId: appointment.userId,
                        userName: appointment.userData?.name || "Patient",
                        doctorName: appointment.docData?.name || "Doctor",
                        slotDate: formatSlotDate(appointment.slotDate),
                        slotTime: appointment.slotTime
                    };

                    io.to("admin").emit("appointment-reminder", payload);
                    io.to(`user:${appointment.userId}`).emit("appointment-reminder", payload);

                    updates.appReminderSent = true;
                    updates.appReminderSentAt = Date.now();
                } catch (socketError) {
                    console.log(`Socket reminder failed for ${appointment._id}: ${socketError.message}`);
                }
            }

            if (Object.keys(updates).length > 0) {
                await appointmentModel.findByIdAndUpdate(appointment._id, updates);
            }
        }
    } catch (error) {
        console.log("Reminder scheduler error:", error.message);
    }
};

const startReminderScheduler = () => {
    runAppointmentReminders();
    setInterval(runAppointmentReminders, REMINDER_INTERVAL_MS);
};

export { startReminderScheduler, runAppointmentReminders };
