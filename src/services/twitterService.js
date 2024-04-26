import { twitterClient } from "../config/twitterClient.js"
import config from "../config/config.js"

const tweet = async () => {
    try {
        await twitterClient.v2.tweet('Buenas tuiter')
    } catch(err) {
        console.error(err)
    }
}

tweet()