import offerModel from "../models/offerModel.js"
import membershipModel from "../models/membershipModel.js"
import insurancePartnerModel from "../models/insurancePartnerModel.js"

const listOffers = async (req, res) => {
    try {
        const offers = await offerModel.find({}).sort({ sortOrder: 1, createdAt: -1 })
        res.json({ success: true, offers })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const createOffer = async (req, res) => {
    try {
        const { title, desc, tag, isActive = true, sortOrder = 0 } = req.body
        if (!title || !desc || !tag) {
            return res.json({ success: false, message: 'Title, description and tag are required' })
        }
        const offer = await offerModel.create({ title, desc, tag, isActive, sortOrder })
        res.json({ success: true, offer, message: 'Offer created' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const updateOffer = async (req, res) => {
    try {
        const { id } = req.params
        const { title, desc, tag, isActive, sortOrder } = req.body
        const update = {}
        if (title !== undefined) update.title = title
        if (desc !== undefined) update.desc = desc
        if (tag !== undefined) update.tag = tag
        if (isActive !== undefined) update.isActive = isActive
        if (sortOrder !== undefined) update.sortOrder = sortOrder

        const offer = await offerModel.findByIdAndUpdate(id, update, { new: true })
        if (!offer) {
            return res.json({ success: false, message: 'Offer not found' })
        }
        res.json({ success: true, offer, message: 'Offer updated' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const deleteOffer = async (req, res) => {
    try {
        const { id } = req.params
        const offer = await offerModel.findByIdAndDelete(id)
        if (!offer) {
            return res.json({ success: false, message: 'Offer not found' })
        }
        res.json({ success: true, message: 'Offer deleted' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const listMemberships = async (req, res) => {
    try {
        const memberships = await membershipModel.find({}).sort({ sortOrder: 1, createdAt: -1 })
        res.json({ success: true, memberships })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const createMembership = async (req, res) => {
    try {
        const { name, price, period = 'month', benefits = [], isActive = true, sortOrder = 0 } = req.body
        if (!name || price === undefined) {
            return res.json({ success: false, message: 'Name and price are required' })
        }
        const membership = await membershipModel.create({
            name,
            price,
            period,
            benefits: Array.isArray(benefits) ? benefits : [],
            isActive,
            sortOrder
        })
        res.json({ success: true, membership, message: 'Membership created' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const updateMembership = async (req, res) => {
    try {
        const { id } = req.params
        const { name, price, period, benefits, isActive, sortOrder } = req.body
        const update = {}
        if (name !== undefined) update.name = name
        if (price !== undefined) update.price = price
        if (period !== undefined) update.period = period
        if (benefits !== undefined) update.benefits = Array.isArray(benefits) ? benefits : []
        if (isActive !== undefined) update.isActive = isActive
        if (sortOrder !== undefined) update.sortOrder = sortOrder

        const membership = await membershipModel.findByIdAndUpdate(id, update, { new: true })
        if (!membership) {
            return res.json({ success: false, message: 'Membership not found' })
        }
        res.json({ success: true, membership, message: 'Membership updated' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const deleteMembership = async (req, res) => {
    try {
        const { id } = req.params
        const membership = await membershipModel.findByIdAndDelete(id)
        if (!membership) {
            return res.json({ success: false, message: 'Membership not found' })
        }
        res.json({ success: true, message: 'Membership deleted' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const listInsurancePartners = async (req, res) => {
    try {
        const insurances = await insurancePartnerModel.find({}).sort({ sortOrder: 1, createdAt: -1 })
        res.json({ success: true, insurances })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const createInsurancePartner = async (req, res) => {
    try {
        const { name, coverage, isActive = true, sortOrder = 0 } = req.body
        if (!name || !coverage) {
            return res.json({ success: false, message: 'Name and coverage are required' })
        }
        const insurance = await insurancePartnerModel.create({ name, coverage, isActive, sortOrder })
        res.json({ success: true, insurance, message: 'Insurance partner created' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const updateInsurancePartner = async (req, res) => {
    try {
        const { id } = req.params
        const { name, coverage, isActive, sortOrder } = req.body
        const update = {}
        if (name !== undefined) update.name = name
        if (coverage !== undefined) update.coverage = coverage
        if (isActive !== undefined) update.isActive = isActive
        if (sortOrder !== undefined) update.sortOrder = sortOrder

        const insurance = await insurancePartnerModel.findByIdAndUpdate(id, update, { new: true })
        if (!insurance) {
            return res.json({ success: false, message: 'Insurance partner not found' })
        }
        res.json({ success: true, insurance, message: 'Insurance partner updated' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const deleteInsurancePartner = async (req, res) => {
    try {
        const { id } = req.params
        const insurance = await insurancePartnerModel.findByIdAndDelete(id)
        if (!insurance) {
            return res.json({ success: false, message: 'Insurance partner not found' })
        }
        res.json({ success: true, message: 'Insurance partner deleted' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

export {
    listOffers,
    createOffer,
    updateOffer,
    deleteOffer,
    listMemberships,
    createMembership,
    updateMembership,
    deleteMembership,
    listInsurancePartners,
    createInsurancePartner,
    updateInsurancePartner,
    deleteInsurancePartner
}
