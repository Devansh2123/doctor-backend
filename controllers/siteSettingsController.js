import { v2 as cloudinary } from "cloudinary";
import siteSettingsModel from "../models/siteSettingsModel.js";

const DEFAULT_SETTINGS = {
  key: "default",
  contactPhone: "+91 9879141914",
  contactEmail: "info@neuronet.in",
  officeHours: "Mon - Sat, 10:00 AM to 9:00 PM",
  addressLine1: "506, Everest Onyx,",
  addressLine2: "Above Fab India, Beside Sterling Hospital, Racecourse, 390007",
  // Use local assets when these are empty.
  logoUrl: "",
  aboutImageUrl: "",
  theme: {
    accent: "#0b1f4d",
    accentStrong: "#12337a",
    soft: "#e0e7ff",
    border: "#a5b4fc",
    text: "#0b1f4d",
    bgStart: "#f6f8ff",
    bgMid: "#ffffff",
    bgEnd: "#eef2ff",
  },
};

const getOrSeedSettings = async () => {
  let settings = await siteSettingsModel.findOne({ key: "default" });
  if (!settings) {
    settings = await siteSettingsModel.create(DEFAULT_SETTINGS);
  }
  return settings;
};

const normalizeTheme = (raw) => {
  if (!raw || typeof raw !== "object") return undefined;
  const keys = [
    "accent",
    "accentStrong",
    "soft",
    "border",
    "text",
    "bgStart",
    "bgMid",
    "bgEnd",
  ];
  const theme = {};
  for (const key of keys) {
    if (typeof raw[key] === "string" && raw[key].trim()) {
      theme[key] = raw[key].trim();
    }
  }
  return Object.keys(theme).length ? theme : undefined;
};

// Public API: used by frontend without auth
const getSiteSettingsPublic = async (req, res) => {
  try {
    const settings = await getOrSeedSettings();
    res.json({
      success: true,
      settings: {
        contactPhone: settings.contactPhone,
        contactEmail: settings.contactEmail,
        officeHours: settings.officeHours,
        addressLine1: settings.addressLine1,
        addressLine2: settings.addressLine2,
        logoUrl: settings.logoUrl,
        aboutImageUrl: settings.aboutImageUrl,
        theme: settings.theme || {},
      },
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Admin API: view current settings
const getSiteSettingsAdmin = async (req, res) => {
  try {
    const settings = await getOrSeedSettings();
    res.json({ success: true, settings });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Admin API: update settings + optional logo/about image upload
const updateSiteSettingsAdmin = async (req, res) => {
  try {
    const settings = await getOrSeedSettings();

    const updates = {};
    const fields = [
      "contactPhone",
      "contactEmail",
      "officeHours",
      "addressLine1",
      "addressLine2",
      "logoUrl",
      "aboutImageUrl",
    ];

    for (const field of fields) {
      if (typeof req.body[field] === "string") {
        updates[field] = req.body[field].trim();
      }
    }

    if (typeof req.body.theme === "string") {
      try {
        const parsed = JSON.parse(req.body.theme);
        const theme = normalizeTheme(parsed);
        if (theme) updates.theme = { ...(settings.theme?.toObject?.() || {}), ...theme };
      } catch (e) {
        // ignore invalid theme JSON
      }
    } else if (typeof req.body.theme === "object") {
      const theme = normalizeTheme(req.body.theme);
      if (theme) updates.theme = { ...(settings.theme?.toObject?.() || {}), ...theme };
    }

    const logoFile = req.files?.logo?.[0];
    if (logoFile?.path) {
      const logoUpload = await cloudinary.uploader.upload(logoFile.path, {
        resource_type: "image",
      });
      if (logoUpload?.secure_url) updates.logoUrl = logoUpload.secure_url;
    }

    const aboutFile = req.files?.aboutImage?.[0];
    if (aboutFile?.path) {
      const aboutUpload = await cloudinary.uploader.upload(aboutFile.path, {
        resource_type: "image",
      });
      if (aboutUpload?.secure_url) updates.aboutImageUrl = aboutUpload.secure_url;
    }

    const updated = await siteSettingsModel.findOneAndUpdate(
      { key: "default" },
      { $set: updates },
      { new: true }
    );

    res.json({ success: true, message: "Site settings updated", settings: updated });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

export { getSiteSettingsPublic, getSiteSettingsAdmin, updateSiteSettingsAdmin };

