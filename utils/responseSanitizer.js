const toPlainObject = (value) => {
    if (!value) return {}
    if (typeof value.toObject === 'function') return value.toObject()
    return value
}

const sanitizeAddress = (address = {}) => ({
    line1: address?.line1 || '',
    line2: address?.line2 || ''
})

const sanitizeUser = (user, options = {}) => {
    const data = toPlainObject(user)
    const includeAdminFields = Boolean(options.includeAdminFields)
    const includeAccessPass = Boolean(options.includeAccessPass)

    return {
        _id: data._id,
        name: data.name || '',
        email: data.email || '',
        image: data.image || '',
        phone: data.phone || '',
        address: sanitizeAddress(data.address),
        gender: data.gender || '',
        dob: data.dob || '',
        isBlocked: includeAdminFields ? Boolean(data.isBlocked) : undefined,
        isGuestMember: includeAdminFields ? Boolean(data.isGuestMember) : undefined,
        accessPassActive: includeAccessPass ? Boolean(data.accessPassActive) : undefined,
        accessPassAmount: includeAccessPass ? Number(data.accessPassAmount || 0) : undefined,
        accessPassActivatedAt: includeAccessPass ? Number(data.accessPassActivatedAt || 0) : undefined,
        accessPassExpiresAt: includeAccessPass ? Number(data.accessPassExpiresAt || 0) : undefined
    }
}

const sanitizeDoctor = (doctor, options = {}) => {
    const data = toPlainObject(doctor)
    const includeAdminFields = Boolean(options.includeAdminFields)
    const includeSchedule = options.includeSchedule !== false
    const includeEmail = Boolean(options.includeEmail)
    const includeFeedbacks = Boolean(options.includeFeedbacks)

    return {
        _id: data._id,
        name: data.name || '',
        email: includeEmail ? (data.email || '') : undefined,
        image: data.image || '',
        speciality: data.speciality || '',
        degree: data.degree || '',
        experience: data.experience || '',
        about: data.about || '',
        available: Boolean(data.available),
        appointmentApprovalMode: data.appointmentApprovalMode || 'auto',
        availableSlotTimes: includeSchedule ? (Array.isArray(data.availableSlotTimes) ? data.availableSlotTimes : []) : undefined,
        workingDays: includeSchedule ? (Array.isArray(data.workingDays) ? data.workingDays : []) : undefined,
        slots_booked: includeSchedule ? (data.slots_booked || {}) : undefined,
        fees: Number(data.fees || 0),
        feedbacks: includeFeedbacks ? (Array.isArray(data.feedbacks) ? data.feedbacks : []) : undefined,
        rating: Number(data.rating || 0),
        feedbackCount: Number(data.feedbackCount || 0),
        address: sanitizeAddress(data.address),
        date: data.date,
        isApproved: includeAdminFields ? data.isApproved !== false : undefined,
        isBlocked: includeAdminFields ? Boolean(data.isBlocked) : undefined
    }
}

const sanitizeAppointment = (appointment, options = {}) => {
    const data = toPlainObject(appointment)
    const includeUser = options.includeUser !== false
    const includeDoctor = options.includeDoctor !== false
    const includeMedicalRecord = Boolean(options.includeMedicalRecord)
    const includeMessages = Boolean(options.includeMessages)
    const includeReminderFlags = Boolean(options.includeReminderFlags)

    return {
        _id: data._id,
        userId: data.userId,
        docId: data.docId,
        slotDate: data.slotDate,
        slotTime: data.slotTime,
        userData: includeUser ? sanitizeUser(data.userData) : undefined,
        docData: includeDoctor ? sanitizeDoctor(data.docData, { includeSchedule: false }) : undefined,
        amount: Number(data.amount || 0),
        date: data.date,
        cancelled: Boolean(data.cancelled),
        payment: Boolean(data.payment),
        isCompleted: Boolean(data.isCompleted),
        completedAt: Number(data.completedAt || 0),
        approvalRequired: Boolean(data.approvalRequired),
        approvalStatus: data.approvalStatus || 'approved',
        approvedAt: Number(data.approvedAt || 0),
        rejectedAt: Number(data.rejectedAt || 0),
        rejectedBy: data.rejectedBy || '',
        approvalNote: data.approvalNote || '',
        isUrgent: Boolean(data.isUrgent),
        prescriptionUrl: data.prescriptionUrl || '',
        consultationRoomId: data.consultationRoomId || '',
        medicalRecord: includeMedicalRecord ? (data.medicalRecord || {}) : undefined,
        consultationMessages: includeMessages ? (Array.isArray(data.consultationMessages) ? data.consultationMessages : []) : undefined,
        emailReminderSent: includeReminderFlags ? Boolean(data.emailReminderSent) : undefined,
        emailReminderSentAt: includeReminderFlags ? Number(data.emailReminderSentAt || 0) : undefined,
        smsReminderSent: includeReminderFlags ? Boolean(data.smsReminderSent) : undefined,
        smsReminderSentAt: includeReminderFlags ? Number(data.smsReminderSentAt || 0) : undefined,
        appReminderSent: includeReminderFlags ? Boolean(data.appReminderSent) : undefined,
        appReminderSentAt: includeReminderFlags ? Number(data.appReminderSentAt || 0) : undefined
    }
}

const sanitizeRazorpayOrder = (order = {}) => ({
    id: order.id,
    amount: order.amount,
    currency: order.currency,
    receipt: order.receipt
})

export {
    sanitizeAppointment,
    sanitizeDoctor,
    sanitizeRazorpayOrder,
    sanitizeUser
}
