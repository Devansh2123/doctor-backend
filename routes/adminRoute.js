import express from 'express';
import { loginAdmin, appointmentsAdmin, appointmentCancel, uploadPrescriptionAdmin, downloadAppointmentReportAdmin, addDoctor, allDoctors, updateDoctorApproval, updateDoctorBlockStatus, allUsers, updateUserBlockStatus, adminDashboard } from '../controllers/adminController.js';
import { listOffers, createOffer, updateOffer, deleteOffer, listMemberships, createMembership, updateMembership, deleteMembership, listInsurancePartners, createInsurancePartner, updateInsurancePartner, deleteInsurancePartner } from '../controllers/offersInsuranceAdminController.js';
import { listClaimsAdmin, updateClaimStatus } from '../controllers/offerClaimController.js';
import { changeAvailablity } from '../controllers/doctorController.js';
import authAdmin from '../middleware/authAdmin.js';
import upload from '../middleware/multer.js';
const adminRouter = express.Router();

adminRouter.post("/login", loginAdmin)
adminRouter.post("/add-doctor", authAdmin, upload.single('image'), addDoctor)
adminRouter.get("/appointments", authAdmin, appointmentsAdmin)
adminRouter.post("/cancel-appointment", authAdmin, appointmentCancel)
adminRouter.post("/upload-prescription", authAdmin, upload.single('prescription'), uploadPrescriptionAdmin)
adminRouter.get("/download-report/:appointmentId", authAdmin, downloadAppointmentReportAdmin)
adminRouter.get("/all-doctors", authAdmin, allDoctors)
adminRouter.post("/update-doctor-approval", authAdmin, updateDoctorApproval)
adminRouter.post("/update-doctor-block", authAdmin, updateDoctorBlockStatus)
adminRouter.get("/all-users", authAdmin, allUsers)
adminRouter.post("/update-user-block", authAdmin, updateUserBlockStatus)
adminRouter.post("/change-availability", authAdmin, changeAvailablity)
adminRouter.get("/dashboard", authAdmin, adminDashboard)
adminRouter.get("/offers", authAdmin, listOffers)
adminRouter.post("/offers", authAdmin, createOffer)
adminRouter.put("/offers/:id", authAdmin, updateOffer)
adminRouter.delete("/offers/:id", authAdmin, deleteOffer)
adminRouter.get("/memberships", authAdmin, listMemberships)
adminRouter.post("/memberships", authAdmin, createMembership)
adminRouter.put("/memberships/:id", authAdmin, updateMembership)
adminRouter.delete("/memberships/:id", authAdmin, deleteMembership)
adminRouter.get("/insurances", authAdmin, listInsurancePartners)
adminRouter.post("/insurances", authAdmin, createInsurancePartner)
adminRouter.put("/insurances/:id", authAdmin, updateInsurancePartner)
adminRouter.delete("/insurances/:id", authAdmin, deleteInsurancePartner)
adminRouter.get("/claims", authAdmin, listClaimsAdmin)
adminRouter.put("/claims/:id", authAdmin, updateClaimStatus)

export default adminRouter;
