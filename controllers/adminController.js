import jwt from "jsonwebtoken";
import appointmentModel from "../models/appointmentModel.js";
import doctorModel from "../models/doctorModel.js";
import bcrypt from "bcrypt";
import validator from "validator";
import { v2 as cloudinary } from "cloudinary";
import userModel from "../models/userModel.js";
import PDFDocument from "pdfkit";
import { notifyAppointmentEvent } from "../services/appointmentNotificationService.js";

const getApprovalStatus = (appointment) => appointment?.approvalStatus || 'approved'
const getAppointmentStatusLabel = (appointment) => {
    if (appointment?.cancelled) return 'Cancelled'
    if (appointment?.isCompleted) return 'Completed'
    if (getApprovalStatus(appointment) === 'pending') return 'Pending'
    return 'Confirmed'
}

// API for admin login
const loginAdmin = async (req, res) => {
    try {

        const { email, password } = req.body

        if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
            const token = jwt.sign(email + password, process.env.JWT_SECRET)
            res.json({ success: true, token })
        } else {
            res.json({ success: false, message: "Invalid credentials" })
        }

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}


// API to get all appointments list
const appointmentsAdmin = async (req, res) => {
    try {

        const appointments = await appointmentModel.find({}).sort({ date: 1 })
        res.json({ success: true, appointments })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API for appointment cancellation
const appointmentCancel = async (req, res) => {
    try {

        const { appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData) {
            return res.json({ success: false, message: 'Appointment not found' })
        }
        if (appointmentData.cancelled) {
            return res.json({ success: false, message: 'Appointment already cancelled' })
        }
        await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })
        appointmentData.cancelled = true

        try {
            await notifyAppointmentEvent({ 
                appointment: appointmentData,
                eventType: "cancelled",
                note: "Cancelled by admin"
            })
        } catch (notifyError) {
            console.log("Admin cancel notification error:", notifyError.message)
        }

        res.json({ success: true, message: 'Appointment Cancelled' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API for admin to upload prescription for any appointment
const uploadPrescriptionAdmin = async (req, res) => {
    try {
        const { appointmentId } = req.body
        const prescriptionFile = req.file

        if (!appointmentId || !prescriptionFile) {
            return res.json({ success: false, message: 'Appointment and prescription file are required' })
        }

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData) {
            return res.json({ success: false, message: 'Appointment not found' })
        }

        const fileUpload = await cloudinary.uploader.upload(prescriptionFile.path, { resource_type: "auto" })
        if (!fileUpload?.secure_url) {
            return res.json({ success: false, message: 'Unable to upload prescription' })
        }
        await appointmentModel.findByIdAndUpdate(appointmentId, { prescriptionUrl: fileUpload.secure_url })

        res.json({ success: true, message: 'Prescription uploaded successfully' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API for admin to download appointment report as PDF
const downloadAppointmentReportAdmin = async (req, res) => {
    try {
        const { appointmentId } = req.params

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData) {
            return res.status(404).json({ success: false, message: 'Appointment not found' })
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

// API for adding Doctor
const addDoctor = async (req, res) => {

    try {

        const { name, email, password, speciality, degree, experience, about, fees, address } = req.body
        const imageFile = req.file

        // checking for all data to add doctor
        if (!name || !email || !password || !speciality || !degree || !experience || !about || !fees || !address) {
            return res.json({ success: false, message: "Missing Details" })
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

        // upload image to cloudinary
        const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" })
        const imageUrl = imageUpload.secure_url

        const doctorData = {
            name,
            email,
            image: imageUrl,
            password: hashedPassword,
            speciality,
            degree,
            experience,
            about,
            fees,
            address: JSON.parse(address),
            date: Date.now(),
            isApproved: false
        }

        const newDoctor = new doctorModel(doctorData)
        await newDoctor.save()
        res.json({ success: true, message: 'Doctor Added' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get all doctors list for admin panel
const allDoctors = async (req, res) => {
    try {

        const doctors = await doctorModel.find({}).select('-password')
        res.json({ success: true, doctors })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to approve/unapprove doctor registration
const updateDoctorApproval = async (req, res) => {
    try {
        const { docId, isApproved } = req.body

        if (!docId || typeof isApproved !== 'boolean') {
            return res.json({ success: false, message: 'Doctor and approval status are required' })
        }

        await doctorModel.findByIdAndUpdate(docId, { isApproved })
        res.json({ success: true, message: isApproved ? 'Doctor approved successfully' : 'Doctor approval removed' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to block/unblock doctor
const updateDoctorBlockStatus = async (req, res) => {
    try {
        const { docId, isBlocked } = req.body

        if (!docId || typeof isBlocked !== 'boolean') {
            return res.json({ success: false, message: 'Doctor and block status are required' })
        }

        await doctorModel.findByIdAndUpdate(docId, { isBlocked })
        res.json({ success: true, message: isBlocked ? 'Doctor blocked successfully' : 'Doctor unblocked successfully' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get all users list for admin panel
const allUsers = async (req, res) => {
    try {
        const users = await userModel.find({}).select('-password')
        res.json({ success: true, users })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to block/unblock user
const updateUserBlockStatus = async (req, res) => {
    try {
        const { userId, isBlocked } = req.body

        if (!userId || typeof isBlocked !== 'boolean') {
            return res.json({ success: false, message: 'User and block status are required' })
        }

        await userModel.findByIdAndUpdate(userId, { isBlocked })
        res.json({ success: true, message: isBlocked ? 'User blocked successfully' : 'User unblocked successfully' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get dashboard data for admin panel
const adminDashboard = async (req, res) => {
    try {

        const doctors = await doctorModel.find({})
        const users = await userModel.find({})
        const appointments = await appointmentModel.find({})

        const getAppointmentEventDate = (appointment) => {
            if (!appointment) return null
            const timestamp = appointment.completedAt || appointment.date
            if (!timestamp) return null
            const date = new Date(timestamp)
            if (Number.isNaN(date.getTime())) return null
            return date
        }

        const toDateKey = (date) => {
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            return `${year}-${month}-${day}`
        }

        const buildDateBuckets = (days) => {
            const today = new Date()
            const buckets = []
            for (let index = days - 1; index >= 0; index -= 1) {
                const bucketDate = new Date(today)
                bucketDate.setHours(12, 0, 0, 0)
                bucketDate.setDate(today.getDate() - index)
                buckets.push({
                    dateKey: toDateKey(bucketDate),
                    label: bucketDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    revenue: 0,
                    appointments: 0,
                    cancelled: 0,
                    cancelledAmount: 0
                })
            }
            return buckets
        }

        const buildTrendMap = (days) => {
            const buckets = buildDateBuckets(days)
            const map = new Map(buckets.map((bucket) => [bucket.dateKey, bucket]))
            return { buckets, map }
        }

        const trendConfig = {
            sevenDays: buildTrendMap(7),
            thirtyDays: buildTrendMap(30),
            ninetyDays: buildTrendMap(90)
        }

        const paymentSplit = {
            paid: { count: 0, amount: 0 },
            cash: { count: 0, amount: 0 },
            pending: { count: 0, amount: 0 }
        }

        const revenueByDoctor = new Map()
        const revenueBySpeciality = new Map()
        let cancelledCount = 0
        let cancelledAmount = 0

        const totalRevenue = appointments.reduce((sum, appointment) => {
            if (appointment.cancelled) return sum
            if (appointment.isCompleted || appointment.payment) {
                return sum + (appointment.amount || 0)
            }
            return sum
        }, 0)

        appointments.forEach((appointment) => {
            const amount = appointment.amount || 0
            const isCancelled = Boolean(appointment.cancelled)
            const isPaid = Boolean(appointment.payment)
            const isCompleted = Boolean(appointment.isCompleted)
            const isRevenue = !isCancelled && (isPaid || isCompleted)
            const eventDate = getAppointmentEventDate(appointment)
            const dateKey = eventDate ? toDateKey(eventDate) : null

            if (isCancelled) {
                cancelledCount += 1
                cancelledAmount += amount
            }

            if (!isCancelled) {
                if (isPaid) {
                    paymentSplit.paid.count += 1
                    paymentSplit.paid.amount += amount
                } else if (isCompleted) {
                    paymentSplit.cash.count += 1
                    paymentSplit.cash.amount += amount
                } else {
                    paymentSplit.pending.count += 1
                    paymentSplit.pending.amount += amount
                }
            }

            if (isRevenue) {
                const doctorName = appointment?.docData?.name || 'Unknown'
                const doctorSpeciality = appointment?.docData?.speciality || 'General'
                const doctorEntry = revenueByDoctor.get(doctorName) || {
                    name: doctorName,
                    speciality: doctorSpeciality,
                    revenue: 0,
                    count: 0
                }
                doctorEntry.revenue += amount
                doctorEntry.count += 1
                revenueByDoctor.set(doctorName, doctorEntry)

                const specialityEntry = revenueBySpeciality.get(doctorSpeciality) || {
                    speciality: doctorSpeciality,
                    revenue: 0,
                    count: 0
                }
                specialityEntry.revenue += amount
                specialityEntry.count += 1
                revenueBySpeciality.set(doctorSpeciality, specialityEntry)
            }

            if (dateKey) {
                const trendBuckets = [trendConfig.sevenDays, trendConfig.thirtyDays, trendConfig.ninetyDays]
                trendBuckets.forEach(({ map }) => {
                    const bucket = map.get(dateKey)
                    if (!bucket) return
                    bucket.appointments += 1
                    if (isCancelled) {
                        bucket.cancelled += 1
                        bucket.cancelledAmount += amount
                    }
                    if (isRevenue) {
                        bucket.revenue += amount
                    }
                })
            }
        })

        const toSortedArray = (map, sortKey) => {
            return Array.from(map.values())
                .sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0))
        }

        const revenueAnalytics = {
            revenueTrend: {
                sevenDays: trendConfig.sevenDays.buckets,
                thirtyDays: trendConfig.thirtyDays.buckets,
                ninetyDays: trendConfig.ninetyDays.buckets
            },
            revenueByDoctor: toSortedArray(revenueByDoctor, 'revenue').slice(0, 8),
            revenueBySpeciality: toSortedArray(revenueBySpeciality, 'revenue').slice(0, 8),
            paymentSplit,
            cancellations: {
                count: cancelledCount,
                amount: cancelledAmount
            }
        }

        const dashData = {
            doctors: doctors.length,
            appointments: appointments.length,
            patients: users.length,
            totalRevenue,
            pendingDoctorApprovals: doctors.filter((doctor) => doctor.isApproved === false).length,
            blockedDoctors: doctors.filter((doctor) => doctor.isBlocked).length,
            blockedUsers: users.filter((user) => user.isBlocked).length,
            latestAppointments: appointments.slice().reverse(),
            revenueAnalytics
        }

        res.json({ success: true, dashData })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

export {
    loginAdmin,
    appointmentsAdmin,
    appointmentCancel,
    uploadPrescriptionAdmin,
    downloadAppointmentReportAdmin,
    addDoctor,
    allDoctors,
    updateDoctorApproval,
    updateDoctorBlockStatus,
    allUsers,
    updateUserBlockStatus,
    adminDashboard
}
