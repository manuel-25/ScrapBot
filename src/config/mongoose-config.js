import mongoose from 'mongoose'
import config from './config.js'
import logger from './winston.js'

const MONGO_URI = config.MONGO_URI

// Conexión a MongoDB
async function connectDB() {
    try {
        await mongoose.connect(MONGO_URI)
        logger.info('Connected to MongoDB')
    } catch (error) {
        logger.error('Error al conectar a MongoDB:', error)
        process.exit(1)
    }
}

export default connectDB
