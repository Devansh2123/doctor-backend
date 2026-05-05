import express from 'express'
import { getOffersInsuranceData, getInitialData } from '../controllers/publicController.js'
import { getSiteSettingsPublic } from '../controllers/siteSettingsController.js'

const publicRouter = express.Router()

publicRouter.get('/offers-insurance', getOffersInsuranceData)
publicRouter.get('/initial-data', getInitialData)
publicRouter.get('/site-settings', getSiteSettingsPublic)

export default publicRouter
