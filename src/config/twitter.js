import { TwitterApi } from "twitter-api-v2"
import config from "./config.js"

console.log(config.TWITTER_API_KEY)

const client = new TwitterApi({
  appKey: config.TWITTER_API_KEY,
  appSecret: config.TWITTER_API_SECRET_KEY,
  accessToken: config.TWITTER_ACCESS_TOKEN,
  accessSecret: config.TWITTER_ACCESS_TOKEN_SECRET,
})

export default client