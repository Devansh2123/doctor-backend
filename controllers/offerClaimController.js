import offerModel from "../models/offerModel.js"
import membershipModel from "../models/membershipModel.js"
import insurancePartnerModel from "../models/insurancePartnerModel.js"
import offerClaimModel from "../models/offerClaimModel.js"
import userModel from "../models/userModel.js"

const getIndiaLocalStamp = (date = new Date()) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    })

    const parts = formatter.formatToParts(date).reduce((acc, part) => {
        acc[part.type] = part.value
        return acc
    }, {})

    return {
        dateLocal: `${parts.month}/${parts.day}/${parts.year}`,
        timeLocal: `${parts.hour}:${parts.minute}:${parts.second} ${parts.dayPeriod || ''}`.trim()
    }
}

const claimOffer = async (req, res) => {
    try {
        const { userId, offerId } = req.body
        if (!offerId) {
            return res.json({ success: false, message: 'Offer ID is required' })
        }

        const offer = await offerModel.findOne({ _id: offerId, isActive: true })
        if (!offer) {
            return res.json({ success: false, message: 'Offer not found' })
        }

        const existing = await offerClaimModel.findOne({ userId, itemType: 'offer', itemId: offerId })
        if (existing) {
            return res.json({ success: false, message: 'Offer already claimed' })
        }

        const user = await userModel.findById(userId).select('name email')
        const stamp = getIndiaLocalStamp()
        await offerClaimModel.create({
            userId,
            userName: user?.name || '',
            userEmail: user?.email || '',
            itemType: 'offer',
            itemId: offerId,
            status: 'claimed',
            history: [{
                status: 'claimed',
                note: '',
                updatedBy: 'user',
                date: Date.now(),
                dateLocal: stamp.dateLocal,
                timeLocal: stamp.timeLocal
            }]
        })
        res.json({ success: true, message: 'Offer claimed successfully' })
    } catch (error) {
        if (error.code === 11000) {
            return res.json({ success: false, message: 'Offer already claimed' })
        }
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const claimMembership = async (req, res) => {
    try {
        const { userId, membershipId } = req.body
        if (!membershipId) {
            return res.json({ success: false, message: 'Membership ID is required' })
        }

        const membership = await membershipModel.findOne({ _id: membershipId, isActive: true })
        if (!membership) {
            return res.json({ success: false, message: 'Membership not found' })
        }

        const existing = await offerClaimModel.findOne({ userId, itemType: 'membership', itemId: membershipId })
        if (existing) {
            return res.json({ success: false, message: 'Membership already selected' })
        }

        const user = await userModel.findById(userId).select('name email')
        const stamp = getIndiaLocalStamp()
        await offerClaimModel.create({
            userId,
            userName: user?.name || '',
            userEmail: user?.email || '',
            itemType: 'membership',
            itemId: membershipId,
            status: 'claimed',
            history: [{
                status: 'claimed',
                note: '',
                updatedBy: 'user',
                date: Date.now(),
                dateLocal: stamp.dateLocal,
                timeLocal: stamp.timeLocal
            }]
        })
        res.json({ success: true, message: 'Membership selected successfully' })
    } catch (error) {
        if (error.code === 11000) {
            return res.json({ success: false, message: 'Membership already selected' })
        }
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const claimInsurance = async (req, res) => {
    try {
        const { userId, insuranceId } = req.body
        if (!insuranceId) {
            return res.json({ success: false, message: 'Insurance ID is required' })
        }

        const insurance = await insurancePartnerModel.findOne({ _id: insuranceId, isActive: true })
        if (!insurance) {
            return res.json({ success: false, message: 'Insurance partner not found' })
        }

        const existing = await offerClaimModel.findOne({ userId, itemType: 'insurance', itemId: insuranceId })
        if (existing) {
            return res.json({ success: false, message: 'Insurance already requested' })
        }

        const user = await userModel.findById(userId).select('name email')
        const stamp = getIndiaLocalStamp()
        await offerClaimModel.create({
            userId,
            userName: user?.name || '',
            userEmail: user?.email || '',
            itemType: 'insurance',
            itemId: insuranceId,
            status: 'claimed',
            history: [{
                status: 'claimed',
                note: '',
                updatedBy: 'user',
                date: Date.now(),
                dateLocal: stamp.dateLocal,
                timeLocal: stamp.timeLocal
            }]
        })
        res.json({ success: true, message: 'Insurance request submitted' })
    } catch (error) {
        if (error.code === 11000) {
            return res.json({ success: false, message: 'Insurance already requested' })
        }
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const hydrateClaims = async (claims) => {
    const offerIds = []
    const membershipIds = []
    const insuranceIds = []

    claims.forEach((claim) => {
        if (claim.itemType === 'offer') offerIds.push(claim.itemId)
        if (claim.itemType === 'membership') membershipIds.push(claim.itemId)
        if (claim.itemType === 'insurance') insuranceIds.push(claim.itemId)
    })

    const [offers, memberships, insurances] = await Promise.all([
        offerIds.length ? offerModel.find({ _id: { $in: offerIds } }) : [],
        membershipIds.length ? membershipModel.find({ _id: { $in: membershipIds } }) : [],
        insuranceIds.length ? insurancePartnerModel.find({ _id: { $in: insuranceIds } }) : []
    ])

    const offerMap = new Map(offers.map((item) => [String(item._id), item]))
    const membershipMap = new Map(memberships.map((item) => [String(item._id), item]))
    const insuranceMap = new Map(insurances.map((item) => [String(item._id), item]))

    return claims.map((claim) => {
        let item = null
        if (claim.itemType === 'offer') item = offerMap.get(String(claim.itemId)) || null
        if (claim.itemType === 'membership') item = membershipMap.get(String(claim.itemId)) || null
        if (claim.itemType === 'insurance') item = insuranceMap.get(String(claim.itemId)) || null

        return {
            _id: claim._id,
            userId: claim.userId,
            userName: claim.userName || '',
            userEmail: claim.userEmail || '',
            itemType: claim.itemType,
            itemId: claim.itemId,
            status: claim.status,
            adminNote: claim.adminNote || '',
            history: claim.history || [],
            createdAt: claim.createdAt,
            updatedAt: claim.updatedAt,
            item
        }
    })
}

const listUserClaims = async (req, res) => {
    try {
        const { userId } = req.body
        const claims = await offerClaimModel.find({ userId }).sort({ createdAt: -1 })
        const enriched = await hydrateClaims(claims)
        res.json({ success: true, claims: enriched })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const listClaimsAdmin = async (req, res) => {
    try {
        const claims = await offerClaimModel.find({}).sort({ createdAt: -1 })
        const enriched = await hydrateClaims(claims)

        const claimsWithUser = enriched.map((claim) => ({
            ...claim,
            user: {
                name: claim.userName || '',
                email: claim.userEmail || ''
            }
        }))

        res.json({ success: true, claims: claimsWithUser })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const updateClaimStatus = async (req, res) => {
    try {
        const { id } = req.params
        const { status, note = '' } = req.body
        const allowed = ['claimed', 'pending', 'approved', 'rejected']
        if (!allowed.includes(status)) {
            return res.json({ success: false, message: 'Invalid status' })
        }

        const stamp = getIndiaLocalStamp()
        const claim = await offerClaimModel.findByIdAndUpdate(
            id,
            {
                status,
                adminNote: note,
                $push: {
                    history: {
                        status,
                        note,
                        updatedBy: 'admin',
                        date: Date.now(),
                        dateLocal: stamp.dateLocal,
                        timeLocal: stamp.timeLocal
                    }
                }
            },
            { new: true }
        )
        if (!claim) {
            return res.json({ success: false, message: 'Claim not found' })
        }

        res.json({ success: true, message: 'Claim updated', claim })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

export { claimOffer, claimMembership, claimInsurance, listUserClaims, listClaimsAdmin, updateClaimStatus }
