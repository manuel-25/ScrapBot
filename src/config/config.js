import dotenv from 'dotenv'

dotenv.config({ path: '../.env' })

const config = {
    MONGO_URI: process.env.MONGO_URI,
    TWITTER_API_KEY: process.env.TWITTER_API_KEY,
    TWITTER_API_SECRET_KEY: process.env.TWITTER_API_SECRET_KEY,
    TWITTER_BEARER_TOKEN: process.env.TWITTER_BEARER_TOKEN,
    TWITTER_ACCESS_TOKEN: process.env.TWITTER_ACCESS_TOKEN,
    TWITTER_ACCESS_TOKEN_SECRET: process.env.TWITTER_ACCESS_TOKEN_SECRET,
}

export default config