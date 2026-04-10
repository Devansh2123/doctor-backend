import { sendAppointmentEventEmail } from "../utils/mailService.js";
import { sendAppointmentEventSMS } from "../utils/smsService.js";
import userModel from "../models/userModel.js";
import doctorModel from "../models/doctorModel.js";

const getApprovalStatus = (appointment) => appointment?.approvalStatus || "approved";

const getAppointmentStatusLabel = (appointment) => {
    if (appointment?.cancelled) return "Cancelled";
    if (appointment?.isCompleted) return "Completed";
    if (getApprovalStatus(appointment) === "pending") return "Pending";
    return "Confirmed";
};

const formatSlotDate = (slotDate) => {
    const [day, month, year] = String(slotDate || "").split("_").map(Number);
    const jsDate = new Date(year, (month || 1) - 1, day || 1);
    return jsDate.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
};

const resolvePatientContact = async (appointment) => {
    try {
        if (appointment?.userId) {
            const user = await userModel.findById(appointment.userId).select("name email phone");
            if (user) {
                return {
                    name: user.name || appointment?.userData?.name || "Patient",
                    email: user.email || appointment?.userData?.email || "",
                    phone: user.phone || appointment?.userData?.phone || ""
                };
            }
        }
    } catch (error) {
        console.log(`Patient contact lookup failed (${appointment?._id}): ${error.message}`);
    }

    return {
        name: appointment?.userData?.name || "Patient",
        email: appointment?.userData?.email || "",
        phone: appointment?.userData?.phone || ""
    };
};

const resolveDoctorContact = async (appointment) => {
    try {
        if (appointment?.docId) {
            const doctor = await doctorModel.findById(appointment.docId).select("name email phone");
            if (doctor) {
                return {
                    name: doctor.name || appointment?.docData?.name || "Doctor",
                    email: doctor.email || appointment?.docData?.email || "",
                    phone: doctor.phone || appointment?.docData?.phone || ""
                };
            }
        }
    } catch (error) {
        console.log(`Doctor contact lookup failed (${appointment?._id}): ${error.message}`);
    }

    return {
        name: appointment?.docData?.name || "Doctor",
        email: appointment?.docData?.email || "",
        phone: appointment?.docData?.phone || ""
    };
};

const notifyParty = async (appointment, eventType, party, note = "") => {
    const statusLabel = getAppointmentStatusLabel(appointment);
    const slotDate = formatSlotDate(appointment?.slotDate);
    const slotTime = appointment?.slotTime || "N/A";
    const [patientContact, doctorContact] = await Promise.all([
        resolvePatientContact(appointment),
        resolveDoctorContact(appointment)
    ]);

    const doctorName = doctorContact.name || "Doctor";
    const userName = patientContact.name || "Patient";

    const email = party === "doctor" ? doctorContact.email : patientContact.email;
    const phone = party === "doctor" ? doctorContact.phone : patientContact.phone;
    const recipientName = party === "doctor" ? `Dr. ${doctorName}` : userName;

    const emailResult = await sendAppointmentEventEmail({
        toEmail: email,
        recipientName,
        eventType,
        statusLabel,
        doctorName,
        userName,
        slotDate,
        slotTime,
        note
    });

    if (!emailResult.sent) {
        console.log(`Appointment ${eventType} email skipped for ${party} (${appointment?._id}): ${emailResult.reason}`);
    }

    const smsResult = await sendAppointmentEventSMS({
        toPhone: phone,
        eventType,
        statusLabel,
        doctorName,
        slotDate,
        slotTime,
        note
    });

    if (!smsResult.sent) {
        console.log(`Appointment ${eventType} SMS skipped for ${party} (${appointment?._id}): ${smsResult.reason}`);
    }
};

const notifyAppointmentEvent = async ({ appointment, eventType, note = "" }) => {
    if (!appointment) return;

    const tasks = [
        notifyParty(appointment, eventType, "patient", note),
        notifyParty(appointment, eventType, "doctor", note)
    ];

    const results = await Promise.allSettled(tasks);
    results.forEach((result, index) => {
        if (result.status === "rejected") {
            const party = index === 0 ? "patient" : "doctor";
            console.log(`Appointment ${eventType} notification failed for ${party} (${appointment._id}): ${result.reason?.message || result.reason}`);
        }
    });
};

export { getAppointmentStatusLabel, notifyAppointmentEvent };
