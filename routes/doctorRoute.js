import express from 'express';
import { loginDoctor, resetDoctorPasswordByEmail, appointmentsDoctor, appointmentCancel, doctorList, changeAvailablity, appointmentComplete, getDoctorConsultation, sendDoctorConsultationMessage, uploadPrescriptionDoctor, viewPrescriptionDoctor, downloadAppointmentReportDoctor, updatePatientMedicalHistoryDoctor, getPatientMedicalHistoryDoctor, approveAppointmentRequestDoctor, rejectAppointmentRequestDoctor, doctorDashboard, doctorProfile, updateDoctorProfile, saveConsultationPrescriptionDoctor, suggestDiagnosisWithAiDoctor } from '../controllers/doctorController.js';
import authDoctor from '../middleware/authDoctor.js';
import upload from '../middleware/multer.js';
const doctorRouter = express.Router();

doctorRouter.post("/login", loginDoctor)
doctorRouter.post("/reset-password-email", resetDoctorPasswordByEmail)
doctorRouter.post("/cancel-appointment", authDoctor, appointmentCancel)
doctorRouter.get("/appointments", authDoctor, appointmentsDoctor)
doctorRouter.get("/list", doctorList)
doctorRouter.post("/change-availability", authDoctor, changeAvailablity)
doctorRouter.post("/complete-appointment", authDoctor, appointmentComplete)
doctorRouter.post("/approve-appointment", authDoctor, approveAppointmentRequestDoctor)
doctorRouter.post("/reject-appointment", authDoctor, rejectAppointmentRequestDoctor)
doctorRouter.get("/consultation/:appointmentId", authDoctor, getDoctorConsultation)
doctorRouter.post("/consultation/message", authDoctor, sendDoctorConsultationMessage)
doctorRouter.post("/consultation/prescription", authDoctor, saveConsultationPrescriptionDoctor)
doctorRouter.post("/consultation/ai-diagnosis", authDoctor, suggestDiagnosisWithAiDoctor)
doctorRouter.post("/upload-prescription", authDoctor, upload.single('prescription'), uploadPrescriptionDoctor)
doctorRouter.get("/view-prescription/:appointmentId", authDoctor, viewPrescriptionDoctor)
doctorRouter.get("/download-report/:appointmentId", authDoctor, downloadAppointmentReportDoctor)
doctorRouter.post("/medical-history", authDoctor, updatePatientMedicalHistoryDoctor)
doctorRouter.get("/medical-history/:userId", authDoctor, getPatientMedicalHistoryDoctor)
doctorRouter.get("/dashboard", authDoctor, doctorDashboard)
doctorRouter.get("/profile", authDoctor, doctorProfile)
doctorRouter.post("/update-profile", authDoctor, updateDoctorProfile)

export default doctorRouter;
