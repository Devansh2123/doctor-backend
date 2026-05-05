import mongoose from "mongoose";

const adminCredentialSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    updatedAt: { type: Number, default: Date.now }
}, { minimize: false })

const adminCredentialModel = mongoose.models.adminCredential || mongoose.model("adminCredential", adminCredentialSchema);
export default adminCredentialModel;
