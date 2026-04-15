import express from 'express'
import { getOffersInsuranceData } from '../controllers/publicController.js'
import { getSiteSettingsPublic } from '../controllers/siteSettingsController.js'

const publicRouter = express.Router()

publicRouter.get('/offers-insurance', getOffersInsuranceData)
publicRouter.get('/site-settings', getSiteSettingsPublic)

export default publicRouter
