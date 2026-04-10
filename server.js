import express from "express"
import cors from 'cors'
import 'dotenv/config'
import http from "http"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import mongoSanitize from "express-mongo-sanitize"
import xss from "xss-clean"
import hpp from "hpp"
import connectDB from "./config/mongodb.js"
import connectCloudinary from "./config/cloudinary.js"
import userRouter from "./routes/userRoute.js"
import doctorRouter from "./routes/doctorRoute.js"
import adminRouter from "./routes/adminRoute.js"
import publicRouter from "./routes/publicRoute.js"
import { startReminderScheduler } from "./services/reminderService.js"
import { initSocket } from "./utils/socket.js"

// app config
const app = express()
const port = process.env.PORT || 8080
connectDB()
connectCloudinary()

// middlewares
app.set('trust proxy', 1)
app.use(helmet())
app.use(express.json({ limit: process.env.BODY_LIMIT || '1mb' }))
const corsOriginsRaw = process.env.CORS_ORIGINS || ''
const corsOrigins = corsOriginsRaw
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (corsOrigins.length === 0) return callback(null, true)
    if (corsOrigins.includes(origin)) return callback(null, true)
    return callback(new Error('CORS: Origin not allowed'))
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true
}

app.use(cors(corsOptions))
app.use(mongoSanitize())
app.use(xss())
app.use(hpp())

const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 15) * 60 * 1000
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 300)
app.use(rateLimit({
  windowMs: rateLimitWindowMs,
  max: rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false
}))

// api endpoints
app.use("/api/user", userRouter)
app.use("/api/admin", adminRouter)
app.use("/api/doctor", doctorRouter)
app.use("/api/public", publicRouter)

app.get("/", (req, res) => {
  res.send("API Working")
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" })
})

// Global error handler
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500
  const message = err.message || "Internal server error"
  if (process.env.NODE_ENV !== 'production') {
    console.error("Unhandled error:", err)
  }
  res.status(status).json({ success: false, message })
})

const httpServer = http.createServer(app)
initSocket(httpServer)
startReminderScheduler()

httpServer.listen(port, () => console.log(`Server started on PORT:${port}`))
