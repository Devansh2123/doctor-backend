import mongoose from "mongoose";

const membershipSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    period: { type: String, default: 'month', trim: true },
    benefits: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 }
}, { timestamps: true })

const membershipModel = mongoose.models.membership || mongoose.model("membership", membershipSchema);
export default membershipModel;
