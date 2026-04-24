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

const parseMedicalList = (value) => {
    if (Array.isArray(value)) {
        return Array.from(
            new Set(
                value
                    .map((item) => String(item || '').trim())
                    .filter(Boolean)
            )
        )
    }

    if (typeof value === 'string' && value.trim()) {
        return Array.from(
            new Set(
                value
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean)
            )
        )
    }

    return []
}

const parsePrescriptionMedicines = (value) => {
    if (!Array.isArray(value)) return []

    return value
        .map((item = {}) => ({
            name: typeof item.name === 'string' ? item.name.trim() : '',
            dosage: typeof item.dosage === 'string' ? item.dosage.trim() : '',
            timing: typeof item.timing === 'string' ? item.timing.trim() : '',
            qty: typeof item.qty === 'string' ? item.qty.trim() : '',
            composition: typeof item.composition === 'string' ? item.composition.trim() : '',
            notes: typeof item.notes === 'string' ? item.notes.trim() : ''
        }))
        .filter((item) => item.name)
}

const sanitizeVitals = (value = {}) => ({
    pulse: typeof value.pulse === 'string' ? value.pulse.trim() : '',
    temperature: typeof value.temperature === 'string' ? value.temperature.trim() : '',
    spo2: typeof value.spo2 === 'string' ? value.spo2.trim() : ''
})

const sanitizeSystemicExamination = (value = {}) => ({
    cvs: typeof value.cvs === 'string' ? value.cvs.trim() : '',
    rs: typeof value.rs === 'string' ? value.rs.trim() : '',
    cns: typeof value.cns === 'string' ? value.cns.trim() : '',
    pa: typeof value.pa === 'string' ? value.pa.trim() : ''
})

const hasMedicalRecordData = (medicalRecord = {}) => {
    const diseases = Array.isArray(medicalRecord.diseases) ? medicalRecord.diseases.filter(Boolean) : []
    const symptoms = Array.isArray(medicalRecord.symptoms) ? medicalRecord.symptoms.filter(Boolean) : []
    const diagnosis = typeof medicalRecord.diagnosis === 'string' ? medicalRecord.diagnosis.trim() : ''
    const prescription = typeof medicalRecord.prescription === 'string' ? medicalRecord.prescription.trim() : ''
    const complaints = typeof medicalRecord.complaints === 'string' ? medicalRecord.complaints.trim() : ''
    const medicines = parsePrescriptionMedicines(medicalRecord.medicines || [])
    const dietAdvice = typeof medicalRecord.dietAdvice === 'string' ? medicalRecord.dietAdvice.trim() : ''
    const nextVisit = typeof medicalRecord.nextVisit === 'string' ? medicalRecord.nextVisit.trim() : ''
    const vitals = sanitizeVitals(medicalRecord.vitals || {})
    const systemicExamination = sanitizeSystemicExamination(medicalRecord.systemicExamination || {})

    return Boolean(
        diseases.length
        || symptoms.length
        || diagnosis
        || prescription
        || complaints
        || medicines.length
        || dietAdvice
        || nextVisit
        || vitals.pulse
        || vitals.temperature
        || vitals.spo2
        || systemicExamination.cvs
        || systemicExamination.rs
        || systemicExamination.cns
        || systemicExamination.pa
    )
}

const sanitizeMedicalRecord = (medicalRecord = {}) => ({
    diseases: parseMedicalList(medicalRecord.diseases),
    symptoms: parseMedicalList(medicalRecord.symptoms),
    diagnosis: typeof medicalRecord.diagnosis === 'string' ? medicalRecord.diagnosis.trim() : '',
    prescription: typeof medicalRecord.prescription === 'string' ? medicalRecord.prescription.trim() : '',
    complaints: typeof medicalRecord.complaints === 'string' ? medicalRecord.complaints.trim() : '',
    vitals: sanitizeVitals(medicalRecord.vitals || {}),
    systemicExamination: sanitizeSystemicExamination(medicalRecord.systemicExamination || {}),
    medicines: parsePrescriptionMedicines(medicalRecord.medicines || []),
    dietAdvice: typeof medicalRecord.dietAdvice === 'string' ? medicalRecord.dietAdvice.trim() : '',
    nextVisit: typeof medicalRecord.nextVisit === 'string' ? medicalRecord.nextVisit.trim() : '',
    updatedAt: Number(medicalRecord.updatedAt) || 0
})

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

const formatSlotDateReadable = (slotDate = '') => {
    const [day, month, year] = String(slotDate).split('_')
    if (!day || !month || !year) return slotDate
    return `${day}-${month}-${year}`
}

const buildConsultationHistoryEntry = (appointment) => ({
    appointmentId: appointment._id,
    slotDate: appointment.slotDate,
    slotDateLabel: formatSlotDateReadable(appointment.slotDate),
    slotTime: appointment.slotTime,
    date: appointment.date,
    isCompleted: appointment.isCompleted,
    cancelled: appointment.cancelled,
    approvalStatus: appointment.approvalStatus || 'approved',
    prescriptionUrl: appointment.prescriptionUrl || '',
    medicalRecord: sanitizeMedicalRecord(appointment.medicalRecord || {})
})

const getMedicineSummaryText = (medicines = []) => {
    if (!Array.isArray(medicines) || medicines.length === 0) return ''
    return medicines
        .map((medicine) => `${medicine.name}${medicine.dosage ? ` (${medicine.dosage})` : ''}${medicine.timing ? ` - ${medicine.timing}` : ''}${medicine.qty ? ` - Qty ${medicine.qty}` : ''}`)
        .join('\n')
}

const safeParseJson = (value = '') => {
    try {
        return JSON.parse(value)
    } catch (error) {
        return null
    }
}

const getPrescriptionUploadOptions = (file = {}) => {
    const mimeType = String(file.mimetype || '').toLowerCase()
    if (mimeType === 'application/pdf') {
        return { resource_type: 'raw' }
    }
    return { resource_type: 'auto' }
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

        const patientHistoryRaw = await appointmentModel
            .find({
                docId,
                userId: appointmentData.userId,
                _id: { $ne: appointmentData._id }
            })
            .sort({ date: -1 })
            .select('slotDate slotTime date medicalRecord prescriptionUrl approvalStatus isCompleted cancelled')

        const patientHistory = patientHistoryRaw
            .map((item) => buildConsultationHistoryEntry(item))
            .filter((item) => hasMedicalRecordData(item.medicalRecord))

        res.json({
            success: true,
            consultation: {
                appointmentId: appointmentData._id,
                roomId,
                videoUrl: `https://meet.jit.si/${roomId}`,
                messages: appointmentData.consultationMessages || [],
                appointment: {
                    id: appointmentData._id,
                    slotDate: appointmentData.slotDate,
                    slotDateLabel: formatSlotDateReadable(appointmentData.slotDate),
                    slotTime: appointmentData.slotTime,
                    date: appointmentData.date,
                    status: getAppointmentStatusLabel(appointmentData),
                    user: {
                        id: appointmentData.userId,
                        name: appointmentData.userData?.name || '',
                        age: appointmentData.userData?.age || '',
                        dob: appointmentData.userData?.dob || '',
                        gender: appointmentData.userData?.gender || '',
                        phone: appointmentData.userData?.phone || '',
                        email: appointmentData.userData?.email || ''
                    },
                    doctor: {
                        id: appointmentData.docId,
                        name: appointmentData.docData?.name || '',
                        speciality: appointmentData.docData?.speciality || '',
                        degree: appointmentData.docData?.degree || ''
                    }
                },
                medicalRecord: sanitizeMedicalRecord(appointmentData.medicalRecord || {}),
                patientHistory
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

// API for doctor to save a full structured prescription from consultation
const saveConsultationPrescriptionDoctor = async (req, res) => {
    try {
        const {
            docId,
            appointmentId,
            complaints,
            diseases,
            symptoms,
            diagnosis,
            prescription,
            vitals,
            systemicExamination,
            medicines,
            dietAdvice,
            nextVisit
        } = req.body

        if (!appointmentId) {
            return res.json({ success: false, message: 'Appointment is required' })
        }

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData || appointmentData.docId !== docId) {
            return res.json({ success: false, message: 'Unauthorized action' })
        }

        if (appointmentData.cancelled) {
            return res.json({ success: false, message: 'Cannot save prescription for cancelled appointment' })
        }

        const medicalRecord = {
            diseases: parseMedicalList(diseases),
            symptoms: parseMedicalList(symptoms),
            diagnosis: typeof diagnosis === 'string' ? diagnosis.trim() : '',
            prescription: typeof prescription === 'string' ? prescription.trim() : '',
            complaints: typeof complaints === 'string' ? complaints.trim() : '',
            vitals: sanitizeVitals(vitals || {}),
            systemicExamination: sanitizeSystemicExamination(systemicExamination || {}),
            medicines: parsePrescriptionMedicines(medicines || []),
            dietAdvice: typeof dietAdvice === 'string' ? dietAdvice.trim() : '',
            nextVisit: typeof nextVisit === 'string' ? nextVisit.trim() : '',
            updatedAt: Date.now()
        }

        if (!medicalRecord.prescription && medicalRecord.medicines.length > 0) {
            medicalRecord.prescription = getMedicineSummaryText(medicalRecord.medicines)
        }

        if (!hasMedicalRecordData(medicalRecord)) {
            return res.json({ success: false, message: 'Please add diagnosis, medicines, or any medical details before saving' })
        }

        await appointmentModel.findByIdAndUpdate(appointmentId, { medicalRecord })

        return res.json({
            success: true,
            message: 'Prescription saved successfully',
            medicalRecord: sanitizeMedicalRecord(medicalRecord)
        })
    } catch (error) {
        console.log(error)
        return res.json({ success: false, message: error.message })
    }
}

// API for doctor to get AI diagnosis suggestions based on symptoms
const suggestDiagnosisWithAiDoctor = async (req, res) => {
    try {
        const { docId, appointmentId, symptoms = [], notes = '' } = req.body

        if (!appointmentId) {
            return res.json({ success: false, message: 'Appointment is required' })
        }

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData || appointmentData.docId !== docId) {
            return res.json({ success: false, message: 'Unauthorized action' })
        }

        const parsedSymptoms = parseMedicalList(symptoms)
        if (!parsedSymptoms.length && !String(notes || '').trim()) {
            return res.json({ success: false, message: 'Please provide symptoms or notes for AI diagnosis' })
        }

        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            return res.json({ success: false, message: 'OPENAI_API_KEY is missing in backend environment' })
        }

        const model = process.env.OPENAI_DIAGNOSIS_MODEL || 'gpt-4.1-mini'
        const prompt = `
You are a medical assistant for licensed doctors and must return strictly valid JSON.
Input symptoms: ${JSON.stringify(parsedSymptoms)}
Additional clinical notes: ${String(notes || '').trim() || 'N/A'}

Return JSON with keys:
- suggestedDiagnosis: string
- confidence: "low" | "medium" | "high"
- differentialDiagnoses: string[]
- recommendedQuestions: string[]
- redFlags: string[]
- disclaimer: short sentence reminding final diagnosis is doctor's decision
`.trim()

        const aiResponse = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                input: prompt,
                temperature: 0.2
            })
        })

        if (!aiResponse.ok) {
            const errorText = await aiResponse.text()
            return res.json({ success: false, message: `OpenAI request failed: ${errorText}` })
        }

        const aiData = await aiResponse.json()
        const rawText = aiData?.output_text || ''
        const parsed = safeParseJson(rawText)

        if (!parsed || typeof parsed !== 'object') {
            return res.json({
                success: true,
                message: 'AI diagnosis generated (unstructured)',
                diagnosis: {
                    suggestedDiagnosis: rawText.trim() || 'No diagnosis returned',
                    confidence: 'low',
                    differentialDiagnoses: [],
                    recommendedQuestions: [],
                    redFlags: [],
                    disclaimer: 'AI suggestions are supportive only. Final diagnosis must be made by the consulting doctor.'
                }
            })
        }

        return res.json({
            success: true,
            message: 'AI diagnosis generated',
            diagnosis: {
                suggestedDiagnosis: typeof parsed.suggestedDiagnosis === 'string' ? parsed.suggestedDiagnosis.trim() : '',
                confidence: ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : 'low',
                differentialDiagnoses: parseMedicalList(parsed.differentialDiagnoses),
                recommendedQuestions: parseMedicalList(parsed.recommendedQuestions),
                redFlags: parseMedicalList(parsed.redFlags),
                disclaimer: typeof parsed.disclaimer === 'string' && parsed.disclaimer.trim()
                    ? parsed.disclaimer.trim()
                    : 'AI suggestions are supportive only. Final diagnosis must be made by the consulting doctor.'
            }
        })
    } catch (error) {
        console.log(error)
        return res.json({ success: false, message: error.message })
    }
}

// API to upload prescription for a doctor appointment
const uploadPrescriptionDoctor = async (req, res) => {
    try {
        const docId = req.body?.docId || req.docId
        const { appointmentId } = req.body
        const prescriptionFile = req.file

        if (!appointmentId || !prescriptionFile) {
            return res.json({ success: false, message: 'Appointment and prescription file are required' })
        }

        const appointmentData = await appointmentModel.findById(appointmentId)

        if (!appointmentData || appointmentData.docId !== docId) {
            return res.json({ success: false, message: 'Unauthorized action' })
        }

        const fileUpload = await cloudinary.uploader.upload(
            prescriptionFile.path,
            getPrescriptionUploadOptions(prescriptionFile)
        )
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

// API for doctor to securely view prescription file for an appointment
const viewPrescriptionDoctor = async (req, res) => {
    try {
        const docId = req.body?.docId || req.docId
        const { appointmentId } = req.params

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData || appointmentData.docId !== docId) {
            return res.status(401).json({ success: false, message: 'Unauthorized action' })
        }
        if (!appointmentData.prescriptionUrl) {
            return res.status(404).json({ success: false, message: 'Prescription not found' })
        }

        return res.redirect(appointmentData.prescriptionUrl)
    } catch (error) {
        console.log(error)
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: error.message })
        }
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

// API to update patient medical history for an appointment
const updatePatientMedicalHistoryDoctor = async (req, res) => {
    try {
        const {
            docId,
            appointmentId,
            diseases,
            symptoms,
            diagnosis,
            prescription,
            complaints,
            vitals,
            systemicExamination,
            medicines,
            dietAdvice,
            nextVisit
        } = req.body

        if (!appointmentId) {
            return res.json({ success: false, message: 'Appointment is required' })
        }

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData || appointmentData.docId !== docId) {
            return res.json({ success: false, message: 'Unauthorized action' })
        }

        if (appointmentData.cancelled) {
            return res.json({ success: false, message: 'Cannot update history for cancelled appointment' })
        }

        const medicalRecord = {
            diseases: parseMedicalList(diseases),
            symptoms: parseMedicalList(symptoms),
            diagnosis: typeof diagnosis === 'string' ? diagnosis.trim() : '',
            prescription: typeof prescription === 'string' ? prescription.trim() : '',
            complaints: typeof complaints === 'string' ? complaints.trim() : '',
            vitals: sanitizeVitals(vitals || {}),
            systemicExamination: sanitizeSystemicExamination(systemicExamination || {}),
            medicines: parsePrescriptionMedicines(medicines || []),
            dietAdvice: typeof dietAdvice === 'string' ? dietAdvice.trim() : '',
            nextVisit: typeof nextVisit === 'string' ? nextVisit.trim() : '',
            updatedAt: Date.now()
        }

        if (!medicalRecord.prescription && medicalRecord.medicines.length > 0) {
            medicalRecord.prescription = getMedicineSummaryText(medicalRecord.medicines)
        }

        if (!hasMedicalRecordData(medicalRecord)) {
            return res.json({ success: false, message: 'Please add at least one medical history detail' })
        }

        await appointmentModel.findByIdAndUpdate(appointmentId, { medicalRecord })

        res.json({ success: true, message: 'Medical history updated', medicalRecord: sanitizeMedicalRecord(medicalRecord) })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to fetch past medical history entries for a patient under current doctor
const getPatientMedicalHistoryDoctor = async (req, res) => {
    try {
        const { docId } = req.body
        const { userId } = req.params

        if (!userId) {
            return res.json({ success: false, message: 'Patient is required' })
        }

        const patientAppointments = await appointmentModel
            .find({ docId, userId })
            .sort({ date: -1 })
            .select('slotDate slotTime date medicalRecord prescriptionUrl approvalStatus isCompleted cancelled')

        const history = patientAppointments
            .map((appointment) => ({
                appointmentId: appointment._id,
                slotDate: appointment.slotDate,
                slotTime: appointment.slotTime,
                date: appointment.date,
                isCompleted: appointment.isCompleted,
                cancelled: appointment.cancelled,
                approvalStatus: appointment.approvalStatus || 'approved',
                prescriptionUrl: appointment.prescriptionUrl || '',
                medicalRecord: sanitizeMedicalRecord(appointment.medicalRecord || {})
            }))
            .filter((item) => hasMedicalRecordData(item.medicalRecord))

        res.json({ success: true, history })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
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
    saveConsultationPrescriptionDoctor,
    suggestDiagnosisWithAiDoctor,
    uploadPrescriptionDoctor,
    viewPrescriptionDoctor,
    downloadAppointmentReportDoctor,
    updatePatientMedicalHistoryDoctor,
    getPatientMedicalHistoryDoctor,
    approveAppointmentRequestDoctor,
    rejectAppointmentRequestDoctor,
    doctorDashboard,
    doctorProfile,
    updateDoctorProfile
}
