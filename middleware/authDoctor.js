import jwt from 'jsonwebtoken'
import doctorModel from '../models/doctorModel.js'

// doctor authentication middleware
const authDoctor = async (req, res, next) => {
    const { dtoken } = req.headers
    if (!dtoken) {
        return res.json({ success: false, message: 'Not Authorized Login Again' })
    }
    try {
        const token_decode = jwt.verify(dtoken, process.env.JWT_SECRET)
        if (!req.body) {
            req.body = {}
        }
        const doctor = await doctorModel.findById(token_decode.id).select('isBlocked isApproved')
        if (!doctor) {
            return res.json({ success: false, message: 'Not Authorized Login Again' })
        }
        if (doctor.isApproved === false) {
            return res.json({ success: false, message: 'Doctor registration is pending admin approval' })
        }
        if (doctor.isBlocked) {
            return res.json({ success: false, message: 'Your account is blocked. Contact admin.' })
        }
        req.body.docId = token_decode.id
        next()
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

export default authDoctor;
