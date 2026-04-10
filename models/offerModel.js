import mongoose from "mongoose";

const offerSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    desc: { type: String, required: true, trim: true },
    tag: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 }
}, { timestamps: true })

const offerModel = mongoose.models.offer || mongoose.model("offer", offerSchema);
export default offerModel;
