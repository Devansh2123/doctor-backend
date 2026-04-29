import express from 'express';
import { loginUser, sendGuestOtp, verifyGuestOtp, registerUser, resetPasswordByEmail, getAccessPassStatus, createAccessPassRazorpayOrder, verifyAccessPassRazorpay, getProfile, updateProfile, bookAppointment, listAppointment, cancelAppointment, rescheduleAppointment, downloadAppointmentReport, paymentRazorpay, verifyRazorpay, paymentStripe, verifyStripe, addDoctorFeedback, getUserConsultation, sendUserConsultationMessage } from '../controllers/userController.js';
import { claimOffer, claimMembership, claimInsurance, listUserClaims } from '../controllers/offerClaimController.js';
import upload from '../middleware/multer.js';
import authUser from '../middleware/authUser.js';
import restrictGuestUser from '../middleware/restrictGuestUser.js';
const userRouter = express.Router();

userRouter.post("/register", registerUser)
userRouter.post("/login", loginUser)
userRouter.post("/guest/send-otp", sendGuestOtp)
userRouter.post("/guest/verify-otp", verifyGuestOtp)
userRouter.post("/reset-password-email", resetPasswordByEmail)
userRouter.get("/access-pass/status", authUser, getAccessPassStatus)
userRouter.post("/access-pass/payment-razorpay", authUser, createAccessPassRazorpayOrder)
userRouter.post("/access-pass/verify-razorpay", authUser, verifyAccessPassRazorpay)

userRouter.get("/get-profile", authUser, getProfile)
userRouter.post("/update-profile", upload.single('image'), authUser, restrictGuestUser, updateProfile)
userRouter.post("/book-appointment", authUser, restrictGuestUser, bookAppointment)
userRouter.get("/appointments", authUser, restrictGuestUser, listAppointment)
userRouter.post("/cancel-appointment", authUser, restrictGuestUser, cancelAppointment)
userRouter.post("/reschedule-appointment", authUser, restrictGuestUser, rescheduleAppointment)
userRouter.get("/download-report/:appointmentId", authUser, restrictGuestUser, downloadAppointmentReport)
userRouter.post("/payment-razorpay", authUser, restrictGuestUser, paymentRazorpay)
userRouter.post("/verifyRazorpay", authUser, restrictGuestUser, verifyRazorpay)
userRouter.post("/payment-stripe", authUser, restrictGuestUser, paymentStripe)
userRouter.post("/verifyStripe", authUser, restrictGuestUser, verifyStripe)
userRouter.post("/add-feedback", authUser, restrictGuestUser, addDoctorFeedback)
userRouter.get("/consultation/:appointmentId", authUser, restrictGuestUser, getUserConsultation)
userRouter.post("/consultation/message", authUser, restrictGuestUser, sendUserConsultationMessage)
userRouter.post("/claim-offer", authUser, restrictGuestUser, claimOffer)
userRouter.post("/claim-membership", authUser, restrictGuestUser, claimMembership)
userRouter.post("/claim-insurance", authUser, restrictGuestUser, claimInsurance)
userRouter.get("/my-claims", authUser, restrictGuestUser, listUserClaims)

export default userRouter;
