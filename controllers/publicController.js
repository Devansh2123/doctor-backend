import offerModel from "../models/offerModel.js"
import membershipModel from "../models/membershipModel.js"
import insurancePartnerModel from "../models/insurancePartnerModel.js"
import doctorModel from "../models/doctorModel.js"
import siteSettingsModel from "../models/siteSettingsModel.js"
import userModel from "../models/userModel.js"
import jwt from "jsonwebtoken"
import { sanitizeDoctor, sanitizeUser } from "../utils/responseSanitizer.js"

const defaultOffers = [
    {
        title: 'New Patient Welcome',
        desc: 'Flat 15% off on your first consultation with any specialist.',
        tag: 'Code: WELCOME15',
        sortOrder: 1
    },
    {
        title: 'Family Care Bundle',
        desc: 'Book 3 or more appointments in a month and get 10% off each visit.',
        tag: 'Auto-applied',
        sortOrder: 2
    },
    {
        title: 'Preventive Health Week',
        desc: 'Free vitals check with any general physician booking.',
        tag: 'Limited time',
        sortOrder: 3
    }
]

const defaultMemberships = [
    {
        name: 'Kiaan Care Basic',
        price: 199,
        period: 'month',
        benefits: [
            'Priority booking for GP consultations',
            '5% discount on diagnostics',
            'Free appointment reschedule'
        ],
        sortOrder: 1
    },
    {
        name: 'Kiaan Care Plus',
        price: 499,
        period: 'month',
        benefits: [
            'Priority booking for specialists',
            '10% discount on diagnostics',
            'One free follow-up within 14 days'
        ],
        sortOrder: 2
    },
    {
        name: 'Kiaan Care Family',
        price: 899,
        period: 'month',
        benefits: [
            'Covers up to 4 family members',
            '15% discount on diagnostics',
            'Dedicated support line'
        ],
        sortOrder: 3
    }
]

const defaultInsurances = [
    {
        name: 'HealthPlus',
        coverage: 'OPD consultations, basic diagnostics, follow-up within 7 days.',
        sortOrder: 1
    },
    {
        name: 'CareShield',
        coverage: 'Specialist visits, prescription discounts, annual health check.',
        sortOrder: 2
    },
    {
        name: 'PrimeSecure',
        coverage: 'Cashless OPD at partner clinics, labs, and imaging.',
        sortOrder: 3
    },
    {
        name: 'FamilyFirst',
        coverage: 'Family plans with pediatric and maternity coverage.',
        sortOrder: 4
    }
]

const seedOffersInsuranceIfEmpty = async () => {
    const [offerCount, membershipCount, insuranceCount] = await Promise.all([
        offerModel.countDocuments(),
        membershipModel.countDocuments(),
        insurancePartnerModel.countDocuments()
    ])

    const seedTasks = []
    if (offerCount === 0) seedTasks.push(offerModel.insertMany(defaultOffers))
    if (membershipCount === 0) seedTasks.push(membershipModel.insertMany(defaultMemberships))
    if (insuranceCount === 0) seedTasks.push(insurancePartnerModel.insertMany(defaultInsurances))

    if (seedTasks.length) {
        await Promise.all(seedTasks)
    }
}

const getOffersInsuranceData = async (req, res) => {
    try {
        await seedOffersInsuranceIfEmpty()

        const [offers, memberships, insurances] = await Promise.all([
            offerModel.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }),
            membershipModel.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }),
            insurancePartnerModel.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 })
        ])

        res.json({
            success: true,
            offers,
            memberships,
            insurances
        })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const getInitialData = async (req, res) => {
    try {
        // Get site settings
        let settings = await siteSettingsModel.findOne({ key: "default" });
        if (!settings) {
            settings = await siteSettingsModel.create({
                key: "default",
                contactPhone: "+91 9879141914",
                contactEmail: "info@neuronet.in",
                officeHours: "Mon - Sat, 10:00 AM to 9:00 PM",
                addressLine1: "506, Everest Onyx,",
                addressLine2: "Above Fab India, Beside Sterling Hospital, Racecourse, 390007",
                logoUrl: "",
                aboutImageUrl: "",
                theme: {
                    accent: "#0b1f4d",
                    accentStrong: "#12337a",
                    soft: "#e0e7ff",
                    border: "#a5b4fc",
                    text: "#0b1f4d",
                    bgStart: "#f6f8ff",
                    bgMid: "#ffffff",
                    bgEnd: "#eef2ff",
                },
            });
        }

        // Get doctors
        const doctors = (await doctorModel.find({ isApproved: { $ne: false }, isBlocked: { $ne: true } }).select(['-password', '-email']))
            .map((doctor) => sanitizeDoctor(doctor))

        // Check for user token
        let userData = null
        const token = req.headers.token
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET)
                const user = await userModel.findById(decoded.id).select('-password -otpCode -otpExpiresAt -accessPassPendingOrderId')
                if (user && !user.isBlocked) {
                    userData = sanitizeUser(user, { includeAccessPass: true })
                }
            } catch (tokenError) {
                // Invalid token, ignore
            }
        }

        res.json({
            success: true,
            doctors,
            siteSettings: {
                contactPhone: settings.contactPhone,
                contactEmail: settings.contactEmail,
                officeHours: settings.officeHours,
                addressLine1: settings.addressLine1,
                addressLine2: settings.addressLine2,
                logoUrl: settings.logoUrl,
                aboutImageUrl: settings.aboutImageUrl,
                theme: settings.theme || {},
            },
            userData
        })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

export { getOffersInsuranceData, getInitialData }
