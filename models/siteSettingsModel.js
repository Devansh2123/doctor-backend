import mongoose from "mongoose";

const themeSchema = new mongoose.Schema(
  {
    accent: { type: String, trim: true },
    accentStrong: { type: String, trim: true },
    soft: { type: String, trim: true },
    border: { type: String, trim: true },
    text: { type: String, trim: true },
    bgStart: { type: String, trim: true },
    bgMid: { type: String, trim: true },
    bgEnd: { type: String, trim: true },
  },
  { _id: false }
);

const siteSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    contactPhone: { type: String, trim: true, default: "" },
    contactEmail: { type: String, trim: true, default: "" },
    officeHours: { type: String, trim: true, default: "" },
    addressLine1: { type: String, trim: true, default: "" },
    addressLine2: { type: String, trim: true, default: "" },
    logoUrl: { type: String, trim: true, default: "" },
    aboutImageUrl: { type: String, trim: true, default: "" },
    theme: { type: themeSchema, default: () => ({}) },
  },
  { timestamps: true }
);

const siteSettingsModel =
  mongoose.models.site_settings ||
  mongoose.model("site_settings", siteSettingsSchema);

export default siteSettingsModel;

