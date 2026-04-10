import mongoose from "mongoose";

const insurancePartnerSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    coverage: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 }
}, { timestamps: true })

const insurancePartnerModel = mongoose.models.insurancePartner || mongoose.model("insurancePartner", insurancePartnerSchema);
export default insurancePartnerModel;
