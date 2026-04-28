import express from 'express';
import { loginUser, sendGuestOtp, verifyGuestOtp, registerUser, resetPasswordByEmail, getAccessPassStatus, createAccessPassRazorpayOrder, verifyAccessPassRazorpay, getProfile, updateProfile, bookAppointment, listAppointment, cancelAppointment, rescheduleAppointment, downloadAppointmentReport, paymentRazorpay, verifyRazorpay, paymentStripe, verifyStripe, addDoctorFeedback, getUserConsultation, sendUserConsultationMessage } from '../controllers/userController.js';
import { claimOffer, claimMembership, claimInsurance, listUserClaims } from '../controllers/offerClaimController.js';
import upload from '../middleware/multer.js';
import authUser from '../middleware/authUser.js';
import requireAccessPass from '../middleware/requireAccessPass.js';
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
userRouter.post("/book-appointment", authUser, restrictGuestUser, requireAccessPass, bookAppointment)
userRouter.get("/appointments", authUser, restrictGuestUser, requireAccessPass, listAppointment)
userRouter.post("/cancel-appointment", authUser, restrictGuestUser, requireAccessPass, cancelAppointment)
userRouter.post("/reschedule-appointment", authUser, restrictGuestUser, requireAccessPass, rescheduleAppointment)
userRouter.get("/download-report/:appointmentId", authUser, restrictGuestUser, requireAccessPass, downloadAppointmentReport)
userRouter.post("/payment-razorpay", authUser, restrictGuestUser, requireAccessPass, paymentRazorpay)
userRouter.post("/verifyRazorpay", authUser, restrictGuestUser, requireAccessPass, verifyRazorpay)
userRouter.post("/payment-stripe", authUser, restrictGuestUser, requireAccessPass, paymentStripe)
userRouter.post("/verifyStripe", authUser, restrictGuestUser, requireAccessPass, verifyStripe)
userRouter.post("/add-feedback", authUser, restrictGuestUser, requireAccessPass, addDoctorFeedback)
userRouter.get("/consultation/:appointmentId", authUser, restrictGuestUser, requireAccessPass, getUserConsultation)
userRouter.post("/consultation/message", authUser, restrictGuestUser, requireAccessPass, sendUserConsultationMessage)
userRouter.post("/claim-offer", authUser, restrictGuestUser, requireAccessPass, claimOffer)
userRouter.post("/claim-membership", authUser, restrictGuestUser, requireAccessPass, claimMembership)
userRouter.post("/claim-insurance", authUser, restrictGuestUser, requireAccessPass, claimInsurance)
userRouter.get("/my-claims", authUser, restrictGuestUser, requireAccessPass, listUserClaims)

export default userRouter;
