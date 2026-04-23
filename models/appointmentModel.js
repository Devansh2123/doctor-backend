import mongoose from "mongoose"

const appointmentSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    docId: { type: String, required: true },
    slotDate: { type: String, required: true },
    slotTime: { type: String, required: true },
    userData: { type: Object, required: true },
    docData: { type: Object, required: true },
    amount: { type: Number, required: true },
    date: { type: Number, required: true },
    cancelled: { type: Boolean, default: false }, 
    payment: { type: Boolean, default: false },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Number, default: 0 },
    approvalRequired: { type: Boolean, default: false },
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
    approvedAt: { type: Number, default: 0 },
    rejectedAt: { type: Number, default: 0 },
    rejectedBy: { type: String, default: '' },
    approvalNote: { type: String, default: '' },
    isUrgent: { type: Boolean, default: false },
    emailReminderSent: { type: Boolean, default: false },
    emailReminderSentAt: { type: Number, default: 0 },
    smsReminderSent: { type: Boolean, default: false },
    smsReminderSentAt: { type: Number, default: 0 },
    appReminderSent: { type: Boolean, default: false },
    appReminderSentAt: { type: Number, default: 0 },
    prescriptionUrl: { type: String, default: '' },
    consultationRoomId: { type: String, default: '' },
    consultationMessages: {
        type: [{
            senderType: { type: String, enum: ['user', 'doctor'], required: true },
            senderId: { type: String, required: true },
            senderName: { type: String, required: true },
            message: { type: String, required: true },
            date: { type: Number, required: true }
        }],
        default: []
    },
    medicalRecord: {
        diseases: { type: [String], default: [] },
        symptoms: { type: [String], default: [] },
        diagnosis: { type: String, default: '' },
        prescription: { type: String, default: '' },
        notes: { type: String, default: '' },
        updatedAt: { type: Number, default: 0 }
    }
    
})

// Add unique compound index to prevent double booking
// This ensures that a slot (docId + slotDate + slotTime) can only be booked once
// We use partialFilterExpression to allow re-booking after cancellation
appointmentSchema.index(
    { docId: 1, slotDate: 1, slotTime: 1 },
    { 
        unique: true,
        partialFilterExpression: { cancelled: false }
    }
)

const appointmentModel = mongoose.models.appointment || mongoose.model("appointment", appointmentSchema)
export default appointmentModel
