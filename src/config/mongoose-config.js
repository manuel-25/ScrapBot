import mongoose from 'mongoose'
import { config } from 'dotenv'

config({ path: '../.env' })
const MONGO_URI = process.env.MONGO_URI

// Conexión a MongoDB
async function connectDB() {
    try {
        await mongoose.connect(MONGO_URI)
        console.log('Connected to MongoDB')
    } catch (error) {
        console.error('Error al conectar a MongoDB:', error)
        process.exit(1);
    }
}

export default connectDB
