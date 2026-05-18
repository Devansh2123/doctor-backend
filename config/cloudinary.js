import { v2 as cloudinary } from 'cloudinary';

const cleanEnv = (value = '') => String(value).trim().replace(/^['"]|['"]$/g, '').trim()

const connectCloudinary = async () => {

    const cloudName = cleanEnv(process.env.CLOUDINARY_NAME || process.env.CLOUDINARY_CLOUD_NAME)
    const apiKey = cleanEnv(process.env.CLOUDINARY_API_KEY)
    const apiSecret = cleanEnv(process.env.CLOUDINARY_SECRET_KEY || process.env.CLOUDINARY_API_SECRET)
    const cloudinaryUrl = cleanEnv(process.env.CLOUDINARY_URL)

    if (cloudinaryUrl) {
        cloudinary.config({ secure: true })
        return
    }

    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true
    });

}

export default connectCloudinary;
