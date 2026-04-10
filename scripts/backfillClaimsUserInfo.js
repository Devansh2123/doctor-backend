import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../config/mongodb.js'
import offerClaimModel from '../models/offerClaimModel.js'
import userModel from '../models/userModel.js'

const backfillClaims = async () => {
    await connectDB()

    const claims = await offerClaimModel.find({
        $or: [
            { userName: { $exists: false } },
            { userEmail: { $exists: false } },
            { userName: '' },
            { userEmail: '' }
        ]
    })

    if (!claims.length) {
        console.log('No claims to backfill.')
        return
    }

    const userIds = [...new Set(claims.map((claim) => claim.userId))]
    const users = await userModel.find({ _id: { $in: userIds } }).select('name email')
    const userMap = new Map(users.map((user) => [String(user._id), user]))

    let updated = 0
    for (const claim of claims) {
        const user = userMap.get(String(claim.userId))
        if (!user) continue
        claim.userName = claim.userName || user.name || ''
        claim.userEmail = claim.userEmail || user.email || ''
        await claim.save()
        updated += 1
    }

    console.log(`Backfill complete. Updated ${updated} claim(s).`)
}

backfillClaims()
    .catch((error) => {
        console.error('Backfill failed:', error)
        process.exitCode = 1
    })
    .finally(async () => {
        await mongoose.connection.close()
    })
