import express from 'express';
import { loginUser, registerUser, resetPasswordByEmail, getProfile, updateProfile, bookAppointment, listAppointment, cancelAppointment, rescheduleAppointment, downloadAppointmentReport, paymentRazorpay, verifyRazorpay, paymentStripe, verifyStripe, addDoctorFeedback, getUserConsultation, sendUserConsultationMessage } from '../controllers/userController.js';
import { claimOffer, claimMembership, claimInsurance, listUserClaims } from '../controllers/offerClaimController.js';
import upload from '../middleware/multer.js';
import authUser from '../middleware/authUser.js';
const userRouter = express.Router();

userRouter.post("/register", registerUser)
userRouter.post("/login", loginUser)
userRouter.post("/reset-password-email", resetPasswordByEmail)

userRouter.get("/get-profile", authUser, getProfile)
userRouter.post("/update-profile", upload.single('image'), authUser, updateProfile)
userRouter.post("/book-appointment", authUser, bookAppointment)
userRouter.get("/appointments", authUser, listAppointment)
userRouter.post("/cancel-appointment", authUser, cancelAppointment)
userRouter.post("/reschedule-appointment", authUser, rescheduleAppointment)
userRouter.get("/download-report/:appointmentId", authUser, downloadAppointmentReport)
userRouter.post("/payment-razorpay", authUser, paymentRazorpay)
userRouter.post("/verifyRazorpay", authUser, verifyRazorpay)
userRouter.post("/payment-stripe", authUser, paymentStripe)
userRouter.post("/verifyStripe", authUser, verifyStripe)
userRouter.post("/add-feedback", authUser, addDoctorFeedback)
userRouter.get("/consultation/:appointmentId", authUser, getUserConsultation)
userRouter.post("/consultation/message", authUser, sendUserConsultationMessage)
userRouter.post("/claim-offer", authUser, claimOffer)
userRouter.post("/claim-membership", authUser, claimMembership)
userRouter.post("/claim-insurance", authUser, claimInsurance)
userRouter.get("/my-claims", authUser, listUserClaims)

export default userRouter;
