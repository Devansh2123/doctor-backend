import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    image: { type: String, required: true },
    speciality: { type: String, required: true },
    degree: { type: String, required: true },
    experience: { type: String, required: true },
    about: { type: String, required: true },
    available: { type: Boolean, default: true },
    appointmentApprovalMode: { type: String, enum: ['auto', 'manual'], default: 'auto' },
    fees: { type: Number, required: true },
    slots_booked: { type: Object, default: {} },
    feedbacks: {
        type: [{
            userId: { type: String, required: true },
            userName: { type: String, required: true },
            rating: { type: Number, required: true, min: 1, max: 5 },
            comment: { type: String, required: true },
            date: { type: Number, required: true }
        }],
        default: []
    },
    rating: { type: Number, default: 0 },
    feedbackCount: { type: Number, default: 0 },
    address: { type: Object, required: true },
    date: { type: Number, required: true },
    isApproved: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
}, { minimize: false })

const doctorModel = mongoose.models.doctor || mongoose.model("doctor", doctorSchema);
export default doctorModel;
