import userModel from "../models/userModel.js"

const requireAccessPass = async (req, res, next) => {
    try {
        const { userId } = req.body || {}
        if (!userId) {
            return res.json({ success: false, message: "Not Authorized Login Again" })
        }

        const user = await userModel.findById(userId).select("accessPassActive accessPassExpiresAt")
        if (!user) {
            return res.json({ success: false, message: "User not found" })
        }

        const hasActivePass = Boolean(user.accessPassActive)
        const hasFutureExpiry = !user.accessPassExpiresAt || Number(user.accessPassExpiresAt) > Date.now()

        if (!hasActivePass || !hasFutureExpiry) {
            return res.json({
                success: false,
                message: "Access pass payment is mandatory to use this feature"
            })
        }

        next()
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

export default requireAccessPass
