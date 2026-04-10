import jwt from 'jsonwebtoken'
import userModel from '../models/userModel.js'

// user authentication middleware
const authUser = async (req, res, next) => {
    const { token } = req.headers
    if (!token) {
        return res.json({ success: false, message: 'Not Authorized Login Again' })
    }
    try {
        const token_decode = jwt.verify(token, process.env.JWT_SECRET)
        if (!req.body) {
            req.body = {}
        }
        const user = await userModel.findById(token_decode.id).select('isBlocked')
        if (!user || user.isBlocked) {
            return res.json({ success: false, message: 'Your account is blocked. Contact admin.' })
        }
        req.body.userId = token_decode.id
        next()
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

export default authUser;
