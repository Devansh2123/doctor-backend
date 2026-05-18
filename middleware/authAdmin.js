import jwt from "jsonwebtoken"

const cleanCredentialValue = (value = '') => {
    return String(value)
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .trim()
}

// admin authentication middleware
const authAdmin = async (req, res, next) => {
    try {
        const atoken = req.headers.atoken || req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.query?.token || req.query?.atoken
        if (!atoken) {
            return res.json({ success: false, message: 'Not Authorized Login Again' })
        }
        const token_decode = jwt.verify(atoken, process.env.JWT_SECRET)
        const adminEmail = cleanCredentialValue(process.env.ADMIN_EMAIL || 'admin@gmail.com').toLowerCase()
        const adminPassword = cleanCredentialValue(process.env.ADMIN_PASSWORD || 'admin@123')
        const tokenEmail = cleanCredentialValue(token_decode?.email).toLowerCase()
        const isAdminToken = token_decode?.role === 'admin' && tokenEmail === adminEmail
        const isLegacyAdminToken = token_decode === adminEmail + adminPassword
        if (!isAdminToken && !isLegacyAdminToken) {
            return res.json({ success: false, message: 'Not Authorized Login Again' })
        }
        next()
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

export default authAdmin;
