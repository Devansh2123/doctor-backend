import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import hpp from "hpp";

import connectDB from "./config/mongodb.js";
import connectCloudinary from "./config/cloudinary.js";

import userRouter from "./routes/userRoute.js";
import doctorRouter from "./routes/doctorRoute.js";
import adminRouter from "./routes/adminRoute.js";
import publicRouter from "./routes/publicRoute.js";

import { startReminderScheduler } from "./services/reminderService.js";
import { initSocket } from "./utils/socket.js";

// Load env variables
dotenv.config();

// app config
const app = express();
const port = process.env.PORT || 8080;

// Connect DB & Cloudinary
connectDB();
connectCloudinary();

// Trust proxy (important for Render)
app.set("trust proxy", 1);

// Security middlewares
app.use(helmet());

// Body parser
app.use(express.json({ limit: process.env.BODY_LIMIT || "1mb" }));

// ------------------ CORS ------------------
const corsOriginsRaw = process.env.CORS_ORIGINS || "";

const corsOrigins = corsOriginsRaw
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow Postman / mobile
    if (corsOrigins.length === 0) return callback(null, true);
    if (corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS: Origin not allowed"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
};

app.use(cors(corsOptions));

// ------------------ Security ------------------
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// ------------------ Rate Limiting ------------------
const rateLimitWindowMs =
  Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 15) * 60 * 1000;

const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 300);

app.use(
  rateLimit({
    windowMs: rateLimitWindowMs,
    max: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ------------------ API ROUTES ------------------
app.use("/api/user", userRouter);
app.use("/api/admin", adminRouter);
app.use("/api/doctor", doctorRouter);
app.use("/api/public", publicRouter);

// ------------------ ROOT ROUTE ------------------
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Doctor Appointment Backend is Running 🚀",
  });
});

// ------------------ HEALTH CHECK ------------------
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "OK",
  });
});

// ------------------ 404 HANDLER ------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ------------------ GLOBAL ERROR HANDLER ------------------
app.use((err, req, res, next) => {
  console.error("ERROR:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ------------------ SERVER ------------------
const httpServer = http.createServer(app);

// Socket init
initSocket(httpServer);

// Start scheduler
startReminderScheduler();

// Listen
httpServer.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});