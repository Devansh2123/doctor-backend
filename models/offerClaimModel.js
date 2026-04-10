import mongoose from "mongoose";

const offerClaimSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    userName: { type: String, default: '' },
    userEmail: { type: String, default: '' },
    itemType: { type: String, enum: ['offer', 'membership', 'insurance'], required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    status: { type: String, enum: ['claimed', 'pending', 'approved', 'rejected'], default: 'claimed' },
    adminNote: { type: String, default: '' },
    history: {
        type: [{
            status: { type: String, required: true },
            note: { type: String, default: '' },
            updatedBy: { type: String, default: '' },
            date: { type: Number, required: true },
            dateLocal: { type: String, default: '' },
            timeLocal: { type: String, default: '' }
        }],
        default: []
    }
}, { timestamps: true })

offerClaimSchema.index({ userId: 1, itemType: 1, itemId: 1 }, { unique: true })

const offerClaimModel = mongoose.models.offerClaim || mongoose.model("offerClaim", offerClaimSchema);
export default offerClaimModel;
