import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";
import userModel from "../models/userModel.js";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import { v2 as cloudinary } from 'cloudinary'
import stripe from "stripe";
import razorpay from 'razorpay';
import { sendDoctorFeedbackEmail } from "../utils/mailService.js";
import PDFDocument from "pdfkit";
import { notifyAppointmentEvent } from "../services/appointmentNotificationService.js";
import { sanitizeAppointment, sanitizeDoctor, sanitizeRazorpayOrder, sanitizeUser } from "../utils/responseSanitizer.js";

// Gateway Initialize (guarded to avoid crashes when env is missing)
const getStripeInstance = () => {
    const secret = process.env.STRIPE_SECRET_KEY
    if (!secret) return null
    return new stripe(secret)
}

const getRazorpayInstance = () => {
    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keyId || !keySecret) return null
    return new razorpay({
        key_id: keyId,
        key_secret: keySecret,
    })
}

const getAccessPassFee = () => Number(process.env.ACCESS_PASS_FEE || 99)
const accessPassDurationDays = Number(process.env.ACCESS_PASS_DURATION_DAYS || 30)
const generateSixDigitOtp = () => String(Math.floor(100000 + (Math.random() * 900000)))

const createToken = (userId) => jwt.sign({ id: userId }, process.env.JWT_SECRET)

// API to register user
const registerUser = async (req, res) => {

    try {
        const { name, email, password } = req.body;

        // checking for all data to register user
        if (!name || !email || !password) {
            return res.json({ success: false, message: 'Missing Details' })
        }

        // validating email format
        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: "Please enter a valid email" })
        }

        // validating strong password
        if (password.length < 8) {
            return res.json({ success: false, message: "Please enter a strong password" })
        }

        // hashing user password
        const salt = await bcrypt.genSalt(10); // the more no. round the more time it will take
        const hashedPassword = await bcrypt.hash(password, salt)

        const userData = {
            name,
            email,
            password: hashedPassword,
        }

        const newUser = new userModel(userData)
        const user = await newUser.save()
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)

        res.json({ success: true, token })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to login user  
const loginUser = async (req, res) => {

    try {
        const { email, password } = req.body;
        const user = await userModel.findOne({ email })

        if (!user) {
            return res.json({ success: false, message: "User does not exist" })
        }
        if (user.isBlocked) {
            return res.json({ success: false, message: "Your account is blocked. Contact admin." })
        }

        const isMatch = await bcrypt.compare(password, user.password)

        if (isMatch) {
            const token = createToken(user._id)
            res.json({ success: true, token })
        }
        else {
            res.json({ success: false, message: "Invalid credentials" })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to send OTP for guest member login
const sendGuestOtp = async (req, res) => {
    try {
        const { phone, name = "Guest Member" } = req.body
        if (!phone) {
            return res.json({ success: false, message: "Phone number is required" })
        }

        const phoneDigits = String(phone).replace(/\D/g, "")
        if (phoneDigits.length < 10) {
            return res.json({ success: false, message: "Please enter a valid phone number" })
        }

        const normalizedPhone = phoneDigits.slice(-10)
        let user = await userModel.findOne({ phone: normalizedPhone })

        if (!user) {
            const guestEmail = `guest_${normalizedPhone}@guest.local`
            const salt = await bcrypt.genSalt(10)
            const password = await bcrypt.hash(`guest-${normalizedPhone}-${Date.now()}`, salt)
            user = await userModel.create({
                name,
                phone: normalizedPhone,
                email: guestEmail,
                password,
                isGuestMember: true
            })
        }

        if (user.isBlocked) {
            return res.json({ success: false, message: "Your account is blocked. Contact admin." })
        }

        const otp = generateSixDigitOtp()
        const expiresAt = Date.now() + (5 * 60 * 1000)
        await userModel.findByIdAndUpdate(user._id, { otpCode: otp, otpExpiresAt: expiresAt, isGuestMember: true })

        console.log(`Guest OTP for ${normalizedPhone}: ${otp}`)

        res.json({ success: true, message: "OTP sent successfully" })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to verify OTP for guest member login
const verifyGuestOtp = async (req, res) => {
    try {
        const { phone, otp } = req.body
        if (!phone || !otp) {
            return res.json({ success: false, message: "Phone and OTP are required" })
        }

        const normalizedPhone = String(phone).replace(/\D/g, "").slice(-10)
        const user = await userModel.findOne({ phone: normalizedPhone })
        if (!user) {
            return res.json({ success: false, message: "Guest member not found" })
        }
        if (user.isBlocked) {
            return res.json({ success: false, message: "Your account is blocked. Contact admin." })
        }
        if (!user.otpCode || !user.otpExpiresAt || user.otpExpiresAt < Date.now()) {
            return res.json({ success: false, message: "OTP expired. Please request a new OTP" })
        }
        if (String(user.otpCode) !== String(otp).trim()) {
            return res.json({ success: false, message: "Invalid OTP" })
        }

        await userModel.findByIdAndUpdate(user._id, { otpCode: "", otpExpiresAt: 0, isGuestMember: true })
        const token = createToken(user._id)
        res.json({ success: true, token, message: "Guest member login successful" })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const getAccessPassStatus = async (req, res) => {
    try {
        const { userId } = req.body
        const user = await userModel.findById(userId).select("accessPassActive accessPassAmount accessPassActivatedAt accessPassExpiresAt")
        if (!user) {
            return res.json({ success: false, message: "User not found" })
        }
        res.json({ success: true, accessPass: sanitizeUser(user, { includeAccessPass: true }) })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const createAccessPassRazorpayOrder = async (req, res) => {
    try {
        const { userId } = req.body
        const user = await userModel.findById(userId)
        if (!user) return res.json({ success: false, message: "User not found" })
        if (user.isBlocked) return res.json({ success: false, message: "Your account is blocked. Contact admin." })

        const razorpayInstance = getRazorpayInstance()
        if (!razorpayInstance) {
            return res.json({ success: false, message: "Razorpay is not configured" })
        }

        const amount = getAccessPassFee()
        const order = await razorpayInstance.orders.create({
            amount: amount * 100,
            currency: (process.env.CURRENCY || "INR"),
            receipt: `access_${userId}_${Date.now()}`
        })

        await userModel.findByIdAndUpdate(userId, { accessPassPendingOrderId: order.id })
        res.json({ success: true, order: sanitizeRazorpayOrder(order), amount })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const verifyAccessPassRazorpay = async (req, res) => {
    try {
        const { userId, razorpay_order_id } = req.body
        if (!razorpay_order_id) return res.json({ success: false, message: "Order ID is required" })

        const user = await userModel.findById(userId)
        if (!user) return res.json({ success: false, message: "User not found" })
        if (!user.accessPassPendingOrderId || user.accessPassPendingOrderId !== razorpay_order_id) {
            return res.json({ success: false, message: "Invalid access pass order" })
        }

        const razorpayInstance = getRazorpayInstance()
        if (!razorpayInstance) {
            return res.json({ success: false, message: "Razorpay is not configured" })
        }

        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id)
        if (orderInfo.status !== "paid") {
            return res.json({ success: false, message: "Payment not completed" })
        }

        const activatedAt = Date.now()
        const expiresAt = activatedAt + (accessPassDurationDays * 24 * 60 * 60 * 1000)
        await userModel.findByIdAndUpdate(userId, {
            accessPassActive: true,
            accessPassAmount: getAccessPassFee(),
            accessPassActivatedAt: activatedAt,
            accessPassExpiresAt: expiresAt,
            accessPassPendingOrderId: ""
        })

        res.json({ success: true, message: "Access pass activated successfully" })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to reset password using registered email
const resetPasswordByEmail = async (req, res) => {
    try {
        const { email, newPassword } = req.body

        if (!email || !newPassword) {
            return res.json({ success: false, message: "Email and new password are required" })
        }

        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: "Please enter a valid email" })
        }

        if (newPassword.length < 8) {
            return res.json({ success: false, message: "Please enter a strong password" })
        }

        const user = await userModel.findOne({ email })
        if (!user) {
            return res.json({ success: false, message: "No user found with this email" })
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(newPassword, salt)

        await userModel.findByIdAndUpdate(user._id, { password: hashedPassword })

        res.json({ success: true, message: "Password changed successfully" })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}
 
// API to get user profile data
const getProfile = async (req, res) => {

    try {
        const { userId } = req.body
        const userRaw = await userModel.findById(userId).select('-password -otpCode -otpExpiresAt -accessPassPendingOrderId')
        const userData = sanitizeUser(userRaw, { includeAccessPass: true })

        res.json({ success: true, userData })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to update user profile
const updateProfile = async (req, res) => {

    try {

        const { userId, name, phone, address, dob, gender, removeImage } = req.body
        const imageFile = req.file

        if (!name || !phone || !dob || !gender) {
            return res.json({ success: false, message: "Data Missing" })
        }

        await userModel.findByIdAndUpdate(userId, { name, phone, address: JSON.parse(address), dob, gender })
                                                            
        if (imageFile) {

            // upload image to cloudinary
            const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" })
            const imageURL = imageUpload.secure_url

            await userModel.findByIdAndUpdate(userId, { image: imageURL })
        } else if (removeImage === 'true') {
            await userModel.findByIdAndUpdate(userId, { image: '' })
        }

        res.json({ success: true, message: 'Profile Updated' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const normalizeSlotTimeString = (slotTime = '') => {
    const value = String(slotTime).trim().toUpperCase()
    const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/)
    if (!match) return ''

    let hours = Number(match[1])
    const minutes = Number(match[2])
    const meridiem = match[3]

    if (!Number.isInteger(hours) || hours < 1 || hours > 12) return ''
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return ''

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${meridiem}`
}

const parseSlotTimeTo24 = (slotTime = '') => {
    const normalized = normalizeSlotTimeString(slotTime)
    if (!normalized) return null

    const match = normalized.match(/^(\d{2}):(\d{2})\s*(AM|PM)$/)
    if (!match) return null

    let hours = Number(match[1])
    const minutes = Number(match[2])
    const meridiem = match[3]

    if (meridiem === 'PM' && hours !== 12) hours += 12
    if (meridiem === 'AM' && hours === 12) hours = 0

    return { hours, minutes }
}

const getDoctorAllowedSlotTimes = (doctorData) => {
    const raw = doctorData?.availableSlotTimes
    if (!Array.isArray(raw) || raw.length === 0) return null

    const normalized = raw
        .map((t) => normalizeSlotTimeString(t))
        .filter(Boolean)

    return normalized.length ? Array.from(new Set(normalized)) : null
}

const isDoctorWorkingDay = (doctorData, dateObj) => {
    const days = doctorData?.workingDays
    if (!Array.isArray(days) || days.length === 0) return true
    return days.includes(dateObj.getDay())
}

const getNextAvailableEmergencySlot = (doctorData) => {
    const slotsBooked = (doctorData?.slots_booked && typeof doctorData.slots_booked === 'object') ? doctorData.slots_booked : {}
    const now = new Date()

    for (let i = 0; i < 7; i++) {
        const dateBase = new Date(now)
        dateBase.setDate(now.getDate() + i)
        dateBase.setHours(0, 0, 0, 0)

        if (!isDoctorWorkingDay(doctorData, dateBase)) continue

        const day = dateBase.getDate()
        const month = dateBase.getMonth() + 1
        const year = dateBase.getFullYear()
        const slotDate = `${day}_${month}_${year}`

        const allowedTimes = getDoctorAllowedSlotTimes(doctorData)

        if (allowedTimes && Array.isArray(allowedTimes)) {
            for (const t of allowedTimes) {
                if (typeof t !== 'string') continue
                const parsed = parseSlotTimeTo24(t)
                if (!parsed) continue

                const slotDateTime = new Date(year, month - 1, day, parsed.hours, parsed.minutes, 0, 0)
                if (slotDateTime <= now) continue

                const slotBookedArray = slotsBooked[slotDate]
                const isBooked = Array.isArray(slotBookedArray) && slotBookedArray.includes(t)
                if (!isBooked) return { slotDate, slotTime: t }
            }
            continue
        }

        // Fallback: default 30-minute schedule (10:00 AM to 8:30 PM)
        const currentDate = new Date(dateBase)
        if (i === 0) {
            currentDate.setTime(now.getTime())
            currentDate.setMinutes(currentDate.getMinutes() > 30 ? 30 : 0)
        } else {
            currentDate.setHours(10, 0, 0, 0)
        }

        const endTime = new Date(dateBase)
        endTime.setHours(21, 0, 0, 0)

        while (currentDate < endTime) {
            if (currentDate <= now) {
                currentDate.setMinutes(currentDate.getMinutes() + 30)
                continue
            }

            const t = normalizeSlotTimeString(currentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
            if (!t) {
                currentDate.setMinutes(currentDate.getMinutes() + 30)
                continue
            }

            const slotBookedArray = slotsBooked[slotDate]
            const isBooked = Array.isArray(slotBookedArray) && slotBookedArray.includes(t)
            if (!isBooked) return { slotDate, slotTime: t }

            currentDate.setMinutes(currentDate.getMinutes() + 30)
        }
    }

    return null
}

const getSlotTimeValue = (slotTime = '') => {
    const value = slotTime.trim().toUpperCase()
    const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/)
    if (!match) return Number.NaN

    let hours = Number(match[1])
    const minutes = Number(match[2])
    const meridiem = match[3]

    if (meridiem === 'PM' && hours !== 12) hours += 12
    if (meridiem === 'AM' && hours === 12) hours = 0

    return (hours * 60) + minutes
}

const parseSlotDateTime = (slotDate, slotTime) => {
    const [day, month, year] = String(slotDate || '').split('_').map(Number)
    if (!day || !month || !year) return null

    const minutesFromMidnight = getSlotTimeValue(slotTime)
    if (!Number.isFinite(minutesFromMidnight)) return null

    const hours = Math.floor(minutesFromMidnight / 60)
    const minutes = minutesFromMidnight % 60
    return new Date(year, month - 1, day, hours, minutes, 0, 0)
}

const isSlotWithinDoctorSchedule = (slotDate, slotTime) => {
    const slotDateTime = parseSlotDateTime(slotDate, slotTime)
    if (!slotDateTime || Number.isNaN(slotDateTime.getTime())) return false

    const now = new Date()
    const sevenDaysFromNow = new Date(now)
    sevenDaysFromNow.setDate(now.getDate() + 7)

    if (slotDateTime <= now || slotDateTime > sevenDaysFromNow) return false

    const minutesFromMidnight = getSlotTimeValue(slotTime)
    if (!Number.isFinite(minutesFromMidnight)) return false

    const openingMinutes = 10 * 60
    const closingMinutes = (20 * 60) + 30
    const isThirtyMinuteStep = minutesFromMidnight % 30 === 0

    return minutesFromMidnight >= openingMinutes && minutesFromMidnight <= closingMinutes && isThirtyMinuteStep
}

const isSlotAllowedForDoctor = (doctorData, slotDate, slotTime) => {
    const normalizedTime = normalizeSlotTimeString(slotTime)
    if (!normalizedTime) return false

    const slotDateTime = parseSlotDateTime(slotDate, normalizedTime)
    if (!slotDateTime || Number.isNaN(slotDateTime.getTime())) return false

    const now = new Date()
    const sevenDaysFromNow = new Date(now)
    sevenDaysFromNow.setDate(now.getDate() + 7)

    if (slotDateTime <= now || slotDateTime > sevenDaysFromNow) return false
    if (!isDoctorWorkingDay(doctorData, slotDateTime)) return false

    const allowedTimes = getDoctorAllowedSlotTimes(doctorData)
    if (allowedTimes) {
        return allowedTimes.includes(normalizedTime)
    }

    return isSlotWithinDoctorSchedule(slotDate, normalizedTime)
}

const parseMedicalList = (value) => {
    if (Array.isArray(value)) {
        return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)))
    }
    if (typeof value === 'string' && value.trim()) {
        return Array.from(new Set(value.split(',').map((item) => item.trim()).filter(Boolean)))
    }
    return []
}

const getConsultationRoomId = (appointmentData) => {
    if (appointmentData.consultationRoomId) return appointmentData.consultationRoomId
    return `kiaan-consult-${appointmentData._id}`
}

const getApprovalStatus = (appointment) => appointment?.approvalStatus || 'approved'
const isAppointmentApproved = (appointment) => getApprovalStatus(appointment) === 'approved'
const getAppointmentStatusLabel = (appointment) => {
    if (appointment?.cancelled) return 'Cancelled'
    if (appointment?.isCompleted) return 'Completed'
    if (getApprovalStatus(appointment) === 'pending') return 'Pending'
    return 'Confirmed'
}

const releaseDoctorSlot = async (docId, slotDate, slotTime) => {
    if (!docId || !slotDate || !slotTime) return

    const doctorData = await doctorModel.findById(docId)
    if (!doctorData?.slots_booked) return

    const slotsBooked = doctorData.slots_booked
    if (!Array.isArray(slotsBooked[slotDate])) return

    slotsBooked[slotDate] = slotsBooked[slotDate].filter((slot) => slot !== slotTime)
    await doctorModel.findByIdAndUpdate(docId, { slots_booked: slotsBooked })
}

// API to book appointment 
const bookAppointment = async (req, res) => {


    try {

        const {
            userId,
            docId,
            slotDate: requestedSlotDate,
            slotTime: requestedSlotTime,
            isUrgent = false,
            diseases = [],
            symptoms = [],
            notes = ''
        } = req.body
        const urgentBooking = Boolean(isUrgent)
        let slotDate = requestedSlotDate
        let slotTime = requestedSlotTime

        if (!userId || !docId) {
            return res.json({ success: false, message: 'Missing booking details' })
        }
        const [docData, userData] = await Promise.all([
            doctorModel.findById(docId).select("-password"),
            userModel.findById(userId).select("-password")
        ])

        if (!docData || !userData) {
            return res.json({ success: false, message: 'Doctor or User not found' })
        }
        if (userData.isBlocked) {
            return res.json({ success: false, message: 'Your account is blocked. Contact admin.' })
        }
        if (docData.isApproved === false) {
            return res.json({ success: false, message: 'Doctor registration is pending admin approval' })
        }
        if (docData.isBlocked) {
            return res.json({ success: false, message: 'Doctor is currently blocked' })
        }

        if (!docData.available) {
            return res.json({ success: false, message: 'Doctor Not Available' })
        }

        if (urgentBooking) {
            const emergencySlot = getNextAvailableEmergencySlot(docData)
            if (!emergencySlot) {
                return res.json({ success: false, message: 'No emergency slots available in next 7 days' })
            }
            slotDate = emergencySlot.slotDate
            slotTime = emergencySlot.slotTime
        }

        if (!slotDate || !slotTime) {
            return res.json({ success: false, message: 'Missing booking details' })
        }

        slotTime = normalizeSlotTimeString(slotTime)
        if (!slotTime) {
            return res.json({ success: false, message: 'Invalid slot time format' })
        }

        if (!urgentBooking && !isSlotAllowedForDoctor(docData, slotDate, slotTime)) {
            return res.json({ success: false, message: 'Selected slot is outside doctor availability' })
        }

        const doctorSnapshot = sanitizeDoctor(docData, { includeSchedule: false })
        const userSnapshot = sanitizeUser(userData)
        const requiresApproval = docData.appointmentApprovalMode === 'manual'
        const approvalStatus = requiresApproval ? 'pending' : 'approved'
        const medicalRecord = {
            diseases: parseMedicalList(diseases),
            symptoms: parseMedicalList(symptoms),
            diagnosis: '',
            prescription: '',
            notes: typeof notes === 'string' ? notes.trim() : '',
            updatedAt: Date.now()
        }

        const appointmentData = {
            userId,
            docId,
            userData: userSnapshot,
            docData: doctorSnapshot,
            amount: docData.fees,
            slotTime,
            slotDate,
            isUrgent: urgentBooking,
            approvalRequired: requiresApproval,
            approvalStatus,
            approvedAt: approvalStatus === 'approved' ? Date.now() : 0,
            medicalRecord,
            consultationRoomId: `kiaan-consult-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            date: Date.now()
        }

        let createdAppointment
        try {
            createdAppointment = new appointmentModel(appointmentData)
            await createdAppointment.save()
        } catch (dbError) {
            if (dbError.code === 11000) {
                return res.json({ success: false, message: 'Slot already booked' })
            }
            throw dbError
        }

        // Persist booked slot on doctor document for UI availability checks.
        const updatedDoctor = await doctorModel.findOneAndUpdate(
            { _id: docId, available: true },
            { $addToSet: { [`slots_booked.${slotDate}`]: slotTime } },
            { new: true }
        )

        if (!updatedDoctor) {
            await appointmentModel.findOneAndDelete({ userId, docId, slotDate, slotTime, cancelled: false })
            return res.json({ success: false, message: 'Doctor Not Available' })
        }

        try {
            await notifyAppointmentEvent({
                appointment: createdAppointment,
                eventType: "booked"
            })
        } catch (notifyError) {
            console.log("Book appointment notification error:", notifyError.message)
        }

        res.json({
            success: true,
            message: urgentBooking ? 'Urgent appointment booked' : 'Appointment Booked',
            appointment: { slotDate, slotTime, isUrgent: urgentBooking }
        })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API for user to get consultation details for an appointment
const getUserConsultation = async (req, res) => {
    try {
        const { userId } = req.body
        const { appointmentId } = req.params

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData || appointmentData.userId !== userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized action' })
        }
        if (appointmentData.cancelled) {
            return res.json({ success: false, message: 'Cannot open consultation for cancelled appointment' })
        }
        if (!isAppointmentApproved(appointmentData)) {
            return res.json({ success: false, message: 'Appointment is pending doctor confirmation' })
        }

        const roomId = getConsultationRoomId(appointmentData)
        if (!appointmentData.consultationRoomId) {
            await appointmentModel.findByIdAndUpdate(appointmentId, { consultationRoomId: roomId })
        }

        res.json({
            success: true,
            consultation: {
                appointmentId: appointmentData._id,
                roomId,
                videoUrl: `https://meet.jit.si/${roomId}`,
                messages: appointmentData.consultationMessages || []
            }
        })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API for user to send consultation chat message
const sendUserConsultationMessage = async (req, res) => {
    try {
        const { userId, appointmentId, message } = req.body

        if (!appointmentId || !message?.trim()) {
            return res.json({ success: false, message: 'Appointment and message are required' })
        }

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData || appointmentData.userId !== userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized action' })
        }
        if (appointmentData.cancelled) {
            return res.json({ success: false, message: 'Cannot send message for cancelled appointment' })
        }
        if (!isAppointmentApproved(appointmentData)) {
            return res.json({ success: false, message: 'Appointment is pending doctor confirmation' })
        }

        const chatItem = {
            senderType: 'user',
            senderId: userId,
            senderName: appointmentData.userData?.name || 'User',
            message: message.trim(),
            date: Date.now()
        }

        appointmentData.consultationMessages = [...(appointmentData.consultationMessages || []), chatItem]
        await appointmentData.save()

        res.json({ success: true, message: 'Message sent' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to cancel appointment
const cancelAppointment = async (req, res) => {
    try {

        const { userId, appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)

        if (!appointmentData) {
            return res.json({ success: false, message: 'Appointment not found' })
        }

        // verify appointment user 
        if (appointmentData.userId !== userId) {
            return res.json({ success: false, message: 'Unauthorized action' })
        }
        if (appointmentData.cancelled) {
            return res.json({ success: false, message: 'Appointment already cancelled' })
        }

        await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })
        appointmentData.cancelled = true

        // releasing doctor slot 
        const { docId, slotDate, slotTime } = appointmentData

        const doctorData = await doctorModel.findById(docId)
        if (doctorData?.slots_booked && Array.isArray(doctorData.slots_booked[slotDate])) {
            let slots_booked = doctorData.slots_booked
            slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime)
            await doctorModel.findByIdAndUpdate(docId, { slots_booked })
        }

        try {
            await notifyAppointmentEvent({
                appointment: appointmentData,
                eventType: "cancelled",
                note: "Cancelled by patient"
            })
        } catch (notifyError) {
            console.log("Cancel appointment notification error:", notifyError.message)
        }

        res.json({ success: true, message: 'Appointment Cancelled' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to reschedule appointment
const rescheduleAppointment = async (req, res) => {
    try {
        const { userId, appointmentId, slotDate } = req.body
        let { slotTime } = req.body

        if (!appointmentId || !slotDate || !slotTime) {
            return res.json({ success: false, message: 'Appointment, date and time are required' })
        }

        slotTime = normalizeSlotTimeString(slotTime)
        if (!slotTime) {
            return res.json({ success: false, message: 'Invalid slot time format' })
        }

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData) {
            return res.json({ success: false, message: 'Appointment not found' })
        }
        if (appointmentData.userId !== userId) {
            return res.json({ success: false, message: 'Unauthorized action' })
        }
        if (appointmentData.cancelled || appointmentData.isCompleted) {
            return res.json({ success: false, message: 'Cannot reschedule cancelled/completed appointment' })
        }
        if (appointmentData.slotDate === slotDate && appointmentData.slotTime === slotTime) {
            return res.json({ success: false, message: 'Please choose a different slot' })
        }
        const doctorData = await doctorModel.findById(appointmentData.docId).select('-password')
        if (!doctorData) {
            return res.json({ success: false, message: 'Doctor not found' })
        }
        if (!doctorData.available) {
            return res.json({ success: false, message: 'Doctor not available for reschedule' })
        }

        if (!isSlotAllowedForDoctor(doctorData, slotDate, slotTime)) {
            return res.json({ success: false, message: 'Selected slot is outside doctor availability' })
        }

        const slotsBooked = doctorData.slots_booked || {}
        const isNewSlotBooked = Array.isArray(slotsBooked[slotDate]) && slotsBooked[slotDate].includes(slotTime)
        if (isNewSlotBooked) {
            return res.json({ success: false, message: 'Slot already booked' })
        }

        const oldSlotDate = appointmentData.slotDate
        const oldSlotTime = appointmentData.slotTime

        // release old slot and reserve new slot
        if (Array.isArray(slotsBooked[oldSlotDate])) {
            slotsBooked[oldSlotDate] = slotsBooked[oldSlotDate].filter((slot) => slot !== oldSlotTime)
        }
        if (!Array.isArray(slotsBooked[slotDate])) {
            slotsBooked[slotDate] = []
        }
        if (!slotsBooked[slotDate].includes(slotTime)) {
            slotsBooked[slotDate].push(slotTime)
        }
        await doctorModel.findByIdAndUpdate(doctorData._id, { slots_booked: slotsBooked })

        const requiresApproval = doctorData.appointmentApprovalMode === 'manual'
        const approvalStatus = requiresApproval ? 'pending' : 'approved'
        const doctorSnapshot = sanitizeDoctor(doctorData, { includeSchedule: false })

        try {
            await appointmentModel.findByIdAndUpdate(appointmentId, {
                slotDate,
                slotTime,
                docData: doctorSnapshot,
                approvalRequired: requiresApproval,
                approvalStatus,
                approvedAt: approvalStatus === 'approved' ? Date.now() : 0,
                rejectedAt: 0,
                rejectedBy: '',
                approvalNote: '',
                emailReminderSent: false,
                emailReminderSentAt: 0,
                smsReminderSent: false,
                smsReminderSentAt: 0,
                appReminderSent: false,
                appReminderSentAt: 0
            })
        } catch (dbError) {
            if (dbError.code === 11000) {
                return res.json({ success: false, message: 'Slot already booked' })
            }
            throw dbError
        }

        appointmentData.slotDate = slotDate
        appointmentData.slotTime = slotTime
        appointmentData.approvalRequired = requiresApproval
        appointmentData.approvalStatus = approvalStatus
        appointmentData.approvalNote = ''

        try {
            await notifyAppointmentEvent({
                appointment: appointmentData,
                eventType: "status_changed",
                note: `Appointment rescheduled to ${slotDate} ${slotTime}`
            })
        } catch (notifyError) {
            console.log("Reschedule notification error:", notifyError.message)
        }

        res.json({ success: true, message: 'Appointment rescheduled', appointment: { slotDate, slotTime, approvalStatus } })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get user appointments for frontend my-appointments page
const listAppointment = async (req, res) => {
    try {

        const { userId } = req.body
        const appointments = (await appointmentModel
            .find({ userId })
            .sort({ date: 1 }))
            .map((appointment) => sanitizeAppointment(appointment))

        res.json({ success: true, appointments })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to download appointment report as PDF
const downloadAppointmentReport = async (req, res) => {
    try {
        const { userId } = req.body
        const { appointmentId } = req.params

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData || appointmentData.userId !== userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized action' })
        }

        const reportFileName = `appointment-report-${appointmentData._id}.pdf`
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `attachment; filename="${reportFileName}"`)

        const doc = new PDFDocument({ margin: 50 })
        doc.pipe(res)

        doc.fontSize(20).text('Appointment Report', { align: 'center' })
        doc.moveDown()
        doc.fontSize(12).text(`Report Date: ${new Date().toLocaleString()}`)
        doc.moveDown()
        doc.text(`Doctor: ${appointmentData.docData?.name || 'N/A'}`)
        doc.text(`Speciality: ${appointmentData.docData?.speciality || 'N/A'}`)
        doc.text(`Patient: ${appointmentData.userData?.name || 'N/A'}`)
        doc.text(`Appointment Date: ${appointmentData.slotDate}`)
        doc.text(`Appointment Time: ${appointmentData.slotTime}`)
        doc.text(`Fees: ${appointmentData.amount}`)
        doc.text(`Payment Status: ${appointmentData.payment ? 'Paid' : 'Pending/Cash'}`)
        doc.text(`Urgent: ${appointmentData.isUrgent ? 'Yes' : 'No'}`)
        doc.text(`Status: ${getAppointmentStatusLabel(appointmentData)}`)
        doc.moveDown()

        if (appointmentData.prescriptionUrl) {
            doc.text('Prescription:')
            doc.fillColor('blue').text(appointmentData.prescriptionUrl, {
                link: appointmentData.prescriptionUrl,
                underline: true
            })
            doc.fillColor('black')
        } else {
            doc.text('Prescription: Not uploaded')
        }

        doc.end()
    } catch (error) {
        console.log(error)
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: error.message })
        }
    }
}

// API to make payment of appointment using razorpay
const paymentRazorpay = async (req, res) => {
    try {

        const { appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)

        if (!appointmentData || appointmentData.cancelled) {
            return res.json({ success: false, message: 'Appointment Cancelled or not found' })
        }
        if (!isAppointmentApproved(appointmentData)) {
            return res.json({ success: false, message: 'Appointment is pending doctor confirmation' })
        }

        const razorpayInstance = getRazorpayInstance()
        if (!razorpayInstance) {
            return res.json({ success: false, message: 'Razorpay is not configured' })
        }

        // creating options for razorpay payment
        const options = {
            amount: appointmentData.amount * 100,
            currency: (process.env.CURRENCY || 'INR'),
            receipt: appointmentId,
        }

        // creation of an order
        const order = await razorpayInstance.orders.create(options)

        res.json({ success: true, order: sanitizeRazorpayOrder(order) })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to verify payment of razorpay
const verifyRazorpay = async (req, res) => {
    try {
        const { razorpay_order_id } = req.body
        const razorpayInstance = getRazorpayInstance()
        if (!razorpayInstance) {
            return res.json({ success: false, message: 'Razorpay is not configured' })
        }

        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id)

        if (orderInfo.status === 'paid') {
            await appointmentModel.findByIdAndUpdate(orderInfo.receipt, { payment: true })
            res.json({ success: true, message: "Payment Successful" })
        }
        else {
            res.json({ success: false, message: 'Payment Failed' })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to make payment of appointment using Stripe
const paymentStripe = async (req, res) => {
    try {

        const { appointmentId } = req.body
        const { origin } = req.headers

        const appointmentData = await appointmentModel.findById(appointmentId)

        if (!appointmentData || appointmentData.cancelled) {
            return res.json({ success: false, message: 'Appointment Cancelled or not found' })
        }
        if (!isAppointmentApproved(appointmentData)) {
            return res.json({ success: false, message: 'Appointment is pending doctor confirmation' })
        }

        const currency = (process.env.CURRENCY || 'INR').toLocaleLowerCase()

        const line_items = [{
            price_data: {
                currency,
                product_data: {
                    name: "Appointment Fees"
                },
                unit_amount: appointmentData.amount * 100
            },
            quantity: 1
        }]

        const stripeInstance = getStripeInstance()
        if (!stripeInstance) {
            return res.json({ success: false, message: 'Stripe is not configured' })
        }

        const session = await stripeInstance.checkout.sessions.create({
            success_url: `${origin}/verify?success=true&appointmentId=${appointmentData._id}`,
            cancel_url: `${origin}/verify?success=false&appointmentId=${appointmentData._id}`,
            line_items: line_items,
            mode: 'payment',
        })

        res.json({ success: true, session_url: session.url });

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const verifyStripe = async (req, res) => {
    try {

        const { appointmentId, success } = req.body

        if (success === "true") {
            await appointmentModel.findByIdAndUpdate(appointmentId, { payment: true })
            return res.json({ success: true, message: 'Payment Successful' })
        }

        res.json({ success: false, message: 'Payment Failed' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API for user to add/update doctor feedback
const addDoctorFeedback = async (req, res) => {
    try {
        const { userId, docId, rating, comment } = req.body

        const parsedRating = Number(rating)
        const normalizedComment = comment?.trim()

        if (!docId || !parsedRating || !normalizedComment) {
            return res.json({ success: false, message: 'Missing feedback details' })
        }

        if (parsedRating < 1 || parsedRating > 5) {
            return res.json({ success: false, message: 'Rating must be between 1 and 5' })
        }

        const hasAppointment = await appointmentModel.findOne({ userId, docId, cancelled: false })
        if (!hasAppointment) {
            return res.json({ success: false, message: 'Book this doctor before giving feedback' })
        }

        const [doctorData, userData] = await Promise.all([
            doctorModel.findById(docId),
            userModel.findById(userId).select('name')
        ])

        if (!doctorData) {
            return res.json({ success: false, message: 'Doctor not found' })
        }

        const feedbacks = doctorData.feedbacks || []
        const existingFeedbackIndex = feedbacks.findIndex((item) => item.userId === userId)

        const feedbackPayload = {
            userId,
            userName: userData?.name || 'User',
            rating: parsedRating,
            comment: normalizedComment,
            date: Date.now()
        }

        if (existingFeedbackIndex >= 0) {
            feedbacks[existingFeedbackIndex] = feedbackPayload
        } else {
            feedbacks.push(feedbackPayload)
        }

        const totalRating = feedbacks.reduce((sum, item) => sum + item.rating, 0)
        const feedbackCount = feedbacks.length
        const averageRating = feedbackCount ? Number((totalRating / feedbackCount).toFixed(1)) : 0

        await doctorModel.findByIdAndUpdate(docId, {
            feedbacks,
            rating: averageRating,
            feedbackCount
        })

        try {
            await sendDoctorFeedbackEmail({
                doctorEmail: doctorData.email,
                doctorName: doctorData.name,
                userName: feedbackPayload.userName,
                rating: feedbackPayload.rating,
                comment: feedbackPayload.comment
            })
        } catch (mailError) {
            console.log("Doctor feedback email not sent:", mailError.message)
        }

        res.json({
            success: true,
            message: existingFeedbackIndex >= 0 ? 'Feedback updated' : 'Feedback added'
        })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

export {
    loginUser,
    sendGuestOtp,
    verifyGuestOtp,
    registerUser,
    resetPasswordByEmail,
    getAccessPassStatus,
    createAccessPassRazorpayOrder,
    verifyAccessPassRazorpay,
    getProfile,
    updateProfile,
    bookAppointment,
    listAppointment,
    cancelAppointment,
    rescheduleAppointment,
    downloadAppointmentReport,
    paymentRazorpay,
    verifyRazorpay,
    paymentStripe,
    verifyStripe,
    addDoctorFeedback,
    getUserConsultation,
    sendUserConsultationMessage
}
