import express from 'express'
import { getOffersInsuranceData } from '../controllers/publicController.js'

const publicRouter = express.Router()

publicRouter.get('/offers-insurance', getOffersInsuranceData)

export default publicRouter
