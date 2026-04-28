import userModel from "../models/userModel.js"

const restrictGuestUser = async (req, res, next) => {
    try {
        const { userId } = req.body || {}
        if (!userId) {
            return res.json({ success: false, message: "Not Authorized Login Again" })
        }

        const user = await userModel.findById(userId).select("isGuestMember")
        if (!user) {
            return res.json({ success: false, message: "User not found" })
        }

        if (user.isGuestMember) {
            return res.json({
                success: false,
                message: "Guest users can only view the site. Please create a regular account to use features."
            })
        }

        next()
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

export default restrictGuestUser