import { TwitterApi } from "twitter-api-v2"
import config from "./config.js"

const client = new TwitterApi({
  appKey: config.TWITTER_API_KEY,
  appSecret: config.TWITTER_API_SECRET_KEY,
  accessToken: config.TWITTER_ACCESS_TOKEN,
  accessSecret: config.TWITTER_ACCESS_TOKEN_SECRET,
})

const bearer = new TwitterApi(config.TWITTER_BEARER_TOKEN)

const twitterClient = client.readWrite
const twitterBearer = bearer.readOnly
 
export { twitterClient, twitterBearer }