import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import { v2 as cloudinary } from "cloudinary";
import PDFDocument from "pdfkit";
import { notifyAppointmentEvent } from "../services/appointmentNotificationService.js";

// API for doctor Login 
const loginDoctor = async (req, res) => {

    try{

        const { email, password } = req.body
        const user = await doctorModel.findOne({ email })

        if (!user) {
            return res.json({ success: false, message: "Invalid credentials" })
        }
        if (user.isApproved === false) {
            return res.json({ success: false, message: "Doctor registration is pending admin approval" })
        }
        if (user.isBlocked) {
            return res.json({ success: false, message: "Your account is blocked. Contact admin." })
        }

        const isMatch = await bcrypt.compare(password, user.password)

        if (isMatch) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
            res.json({ success: true, token })
        } else {
            res.json({ success: false, message: "Invalid credentials" })
        }


    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const getConsultationRoomId = (appointmentData) => {
    if (appointmentData.consultationRoomId) return appointmentData.consultationRoomId
    return `kiaan-consult-${appointmentData._id}`
}

const getTodaySlotDateKey = () => {
    const now = new Date()
    return `${now.getDate()}_${now.getMonth() + 1}_${now.getFullYear()}`
} 

const getSlotTimeValue = (slotTime = '') => {
    const value = slotTime.trim().toUpperCase()
    const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/)
    if (!match) return Number.MAX_SAFE_INTEGER

    let hours = Number(match[1])
    const minutes = Number(match[2])
    const meridiem = match[3]

    if (meridiem === 'PM' && hours !== 12) hours += 12
    if (meridiem === 'AM' && hours === 12) hours = 0

    return (hours * 60) + minutes
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

const parseAvailableSlotTimes = (value) => {
    if (Array.isArray(value)) {
        return Array.from(new Set(value.map((t) => normalizeSlotTimeString(t)).filter(Boolean)))
    }
    if (typeof value === 'string' && value.trim()) {
        return Array.from(new Set(value.split(',').map((t) => normalizeSlotTimeString(t)).filter(Boolean)))
    }
    return undefined
}

const parseWorkingDays = (value) => {
    if (Array.isArray(value)) {
        const parsed = value.map((d) => Number(d)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
        return Array.from(new Set(parsed))
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = value.split(',').map((d) => Number(d.trim())).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
        return Array.from(new Set(parsed))
    }
    return undefined
}
const getAppointmentDateTime = (appointment) => {
    if (!appointment?.slotDate || !appointment?.slotTime) return null

    const [day, month, year] = appointment.slotDate.split('_').map(Number)
    if (!day || !month || !year) return null

    const minutesFromMidnight = getSlotTimeValue(appointment.slotTime)
    if (!Number.isFinite(minutesFromMidnight) || minutesFromMidnight === Number.MAX_SAFE_INTEGER) return null

    const hours = Math.floor(minutesFromMidnight / 60)
    const minutes = minutesFromMidnight % 60

    return new Date(year, month - 1, day, hours, minutes, 0, 0)
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

// API to get doctor appointments for doctor panel
const appointmentsDoctor = async (req, res) => {
    try {

        const { docId } = req.body
        const appointments = await appointmentModel.find({ docId })

        res.json({ success: true, appointments })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to cancel appointment for doctor panel
const appointmentCancel = async (req, res) => {
    try {

        const { docId, appointmentId } = req.body

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData) {
            return res.json({ success: false, message: 'Appointment not found' })
        }
        if (appointmentData && appointmentData.docId === docId) {
            if (appointmentData.cancelled) {
                return res.json({ success: false, message: 'Appointment already cancelled' })
            }
            await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })
            appointmentData.cancelled = true
            await releaseDoctorSlot(appointmentData.docId, appointmentData.slotDate, appointmentData.slotTime)

            try {
                await notifyAppointmentEvent({
                    appointment: appointmentData,
                    eventType: "cancelled",
                    note: "Cancelled by doctor"
                })
            } catch (notifyError) {
                console.log("Doctor cancel notification error:", notifyError.message)
            }
            return res.json({ success: true, message: 'Appointment Cancelled' })
        }

        res.json({ success: false, message: 'Unauthorized action' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API to mark appointment completed for doctor panel
const appointmentComplete = async (req, res) => {
    try {

        const { docId, appointmentId } = req.body

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData) {
            return res.json({ success: false, message: 'Appointment not found' })
        }
        if (appointmentData && appointmentData.docId === docId) {
            if (!isAppointmentApproved(appointmentData)) {
                return res.json({ success: false, message: 'Cannot complete appointment before approval' })
            }
            if (appointmentData.cancelled) {
                return res.json({ success: false, message: 'Cannot complete cancelled appointment' })
            }
            await appointmentModel.findByIdAndUpdate(appointmentId, { isCompleted: true, completedAt: Date.now() })

            appointmentData.isCompleted = true
            appointmentData.completedAt = Date.now()
            try {
                await notifyAppointmentEvent({
                    appointment: appointmentData,
                    eventType: "status_changed",
                    note: "Appointment marked as completed by doctor"
                })
            } catch (notifyError) {
                console.log("Appointment complete notification error:", notifyError.message)
            }
            return res.json({ success: true, message: 'Appointment Completed' })
        }

        res.json({ success: false, message: 'Unauthorized action' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API for doctor to get consultation details for an appointment
const getDoctorConsultation = async (req, res) => {
    try {
        const { docId } = req.body
        const { appointmentId } = req.params

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData || appointmentData.docId !== docId) {
            return res.status(401).json({ success: false, message: 'Unauthorized action' })
        }
        if (appointmentData.cancelled) {
            return res.json({ success: false, message: 'Cannot open consultation for cancelled appointment' })
        }
        if (!isAppointmentApproved(appointmentData)) {
            return res.json({ success: false, message: 'Cannot open consultation before appointment approval' })
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

// API for doctor to send consultation chat message
const sendDoctorConsultationMessage = async (req, res) => {
    try {
        const { docId, appointmentId, message } = req.body

        if (!appointmentId || !message?.trim()) {
            return res.json({ success: false, message: 'Appointment and message are required' })
        }

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData || appointmentData.docId !== docId) {
            return res.status(401).json({ success: false, message: 'Unauthorized action' })
        }
        if (appointmentData.cancelled) {
            return res.json({ success: false, message: 'Cannot send message for cancelled appointment' })
        }
        if (!isAppointmentApproved(appointmentData)) {
            return res.json({ success: false, message: 'Cannot send message before appointment approval' })
        }

        const chatItem = {
            senderType: 'doctor',
            senderId: docId,
            senderName: appointmentData.docData?.name || 'Doctor',
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

// API to upload prescription for a doctor appointment
const uploadPrescriptionDoctor = async (req, res) => {
    try {
        const { docId, appointmentId } = req.body
        const prescriptionFile = req.file

        if (!appointmentId || !prescriptionFile) {
            return res.json({ success: false, message: 'Appointment and prescription file are required' })
        }

        const appointmentData = await appointmentModel.findById(appointmentId)

        if (!appointmentData || appointmentData.docId !== docId) {
            return res.json({ success: false, message: 'Unauthorized action' })
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

// API for doctor to download appointment report as PDF
const downloadAppointmentReportDoctor = async (req, res) => {
    try {
        const { docId } = req.body
        const { appointmentId } = req.params

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData || appointmentData.docId !== docId) {
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

// API to get all doctors list for Frontend
const doctorList = async (req, res) => {
    try {

        const doctors = await doctorModel.find({ isApproved: { $ne: false }, isBlocked: { $ne: true } }).select(['-password', '-email'])
        res.json({ success: true, doctors })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API to change doctor availablity for Admin and Doctor Panel
const changeAvailablity = async (req, res) => {
    try {

        const { docId } = req.body

        const docData = await doctorModel.findById(docId)
        await doctorModel.findByIdAndUpdate(docId, { available: !docData.available })
        res.json({ success: true, message: 'Availablity Changed' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get doctor profile for  Doctor Panel
const doctorProfile = async (req, res) => {
    try {

        const { docId } = req.body
        const profileData = await doctorModel.findById(docId).select('-password')

        res.json({ success: true, profileData })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to update doctor profile data from  Doctor Panel
const updateDoctorProfile = async (req, res) => {
    try {

        const { docId, fees, address, available, appointmentApprovalMode, availableSlotTimes, workingDays } = req.body

        const allowedModes = ['auto', 'manual']
        const mode = allowedModes.includes(appointmentApprovalMode) ? appointmentApprovalMode : 'auto'

        const update = { fees, address, available, appointmentApprovalMode: mode }

        const parsedTimes = parseAvailableSlotTimes(availableSlotTimes)
        if (parsedTimes !== undefined) update.availableSlotTimes = parsedTimes

        const parsedDays = parseWorkingDays(workingDays)
        if (parsedDays !== undefined) update.workingDays = parsedDays

        await doctorModel.findByIdAndUpdate(docId, update)

        res.json({ success: true, message: 'Profile Updated' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get dashboard data for doctor panel
const doctorDashboard = async (req, res) => {
    try {

        const { docId } = req.body

        const appointments = await appointmentModel.find({ docId })
        const todaySlotDateKey = getTodaySlotDateKey()

        let earnings = 0

        appointments.forEach((item) => {
            if (item.isCompleted || item.payment) {
                earnings += item.amount
            }
        })

        let patients = []

        appointments.forEach((item) => {
            if (!patients.includes(item.userId)) {
                patients.push(item.userId)
            }
        })

        const pendingRequests = appointments.filter((item) => getApprovalStatus(item) === 'pending' && !item.cancelled)

        const todaySchedule = appointments
            .filter((item) => item.slotDate === todaySlotDateKey && !item.cancelled)
            .sort((a, b) => getSlotTimeValue(a.slotTime) - getSlotTimeValue(b.slotTime))

        const latestAppointments = [...appointments].sort((a, b) => b.date - a.date)


        const dashData = {
            earnings,
            appointments: appointments.length,
            patients: patients.length,
            pendingRequests: pendingRequests.length,
            todayScheduleCount: todaySchedule.length,
            todaySchedule,
            latestAppointments
        }

        res.json({ success: true, dashData })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to approve pending appointment request for doctor panel
const approveAppointmentRequestDoctor = async (req, res) => {
    try {
        const { docId, appointmentId } = req.body

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData || appointmentData.docId !== docId) {
            return res.json({ success: false, message: 'Unauthorized action' })
        }
        if (appointmentData.cancelled) {
            return res.json({ success: false, message: 'Cannot approve cancelled appointment' })
        }
        if (getApprovalStatus(appointmentData) !== 'pending') {
            return res.json({ success: false, message: 'Appointment is not pending approval' })
        }

        await appointmentModel.findByIdAndUpdate(appointmentId, {
            approvalStatus: 'approved',
            approvedAt: Date.now(),
            rejectedAt: 0,
            rejectedBy: '',
            approvalNote: ''
        })

        appointmentData.approvalStatus = 'approved'
        appointmentData.approvedAt = Date.now()
        appointmentData.rejectedAt = 0
        appointmentData.rejectedBy = ''
        appointmentData.approvalNote = ''

        try {
            await notifyAppointmentEvent({
                appointment: appointmentData,
                eventType: "status_changed",
                note: "Appointment request approved by doctor"
            })
        } catch (notifyError) {
            console.log("Approve appointment notification error:", notifyError.message)
        }

        res.json({ success: true, message: 'Appointment request approved' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to reject pending appointment request for doctor panel
const rejectAppointmentRequestDoctor = async (req, res) => {
    try {
        const { docId, appointmentId, reason = '' } = req.body

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData || appointmentData.docId !== docId) {
            return res.json({ success: false, message: 'Unauthorized action' })
        }
        if (appointmentData.cancelled) {
            return res.json({ success: false, message: 'Appointment already cancelled' })
        }
        if (getApprovalStatus(appointmentData) !== 'pending') {
            return res.json({ success: false, message: 'Appointment is not pending approval' })
        }

        await appointmentModel.findByIdAndUpdate(appointmentId, {
            approvalStatus: 'rejected',
            rejectedAt: Date.now(),
            rejectedBy: 'doctor',
            approvalNote: reason.trim(),
            cancelled: true
        })
        appointmentData.approvalStatus = 'rejected'
        appointmentData.rejectedAt = Date.now()
        appointmentData.rejectedBy = 'doctor'
        appointmentData.approvalNote = reason.trim()
        appointmentData.cancelled = true
        await releaseDoctorSlot(appointmentData.docId, appointmentData.slotDate, appointmentData.slotTime)

        try {
            await notifyAppointmentEvent({
                appointment: appointmentData,
                eventType: "status_changed",
                note: reason.trim() || "Appointment request rejected by doctor"
            })
        } catch (notifyError) {
            console.log("Reject appointment notification error:", notifyError.message)
        }

        res.json({ success: true, message: 'Appointment request rejected' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

export {
    loginDoctor,
    appointmentsDoctor,
    appointmentCancel,
    doctorList,
    changeAvailablity,
    appointmentComplete,
    getDoctorConsultation,
    sendDoctorConsultationMessage,
    uploadPrescriptionDoctor,
    downloadAppointmentReportDoctor,
    approveAppointmentRequestDoctor,
    rejectAppointmentRequestDoctor,
    doctorDashboard,
    doctorProfile,
    updateDoctorProfile
}
