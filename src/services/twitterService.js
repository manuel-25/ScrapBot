import { twitterClient } from "../config/twitterClient.js"
import { formatter, getEmojiForCategory, getDaysAndMonth } from "../config/utils.js"


// Función para tuitear información sobre variaciones de precios
export const tweetVariations = async (variations, date, firstDateOfMonth) => {
    try {
        //Dates
        const { firstDay, lastDay, monthName } = getDaysAndMonth(date, firstDateOfMonth)

        let tweetText = `📊 Variación de precios de la canasta básica entre el ${firstDay} y el ${lastDay} de ${monthName}:\n\n`
        const percentEmoticon = variations.totalPercentDifference >= 0 ? "📈" : "📉"

        const totalPercent = variations.totalPercentDifference
        const totalProducts = variations.totalProducts
        const totalDrop = formatter.format(variations.totalPriceDifference)
        const dolarEmoticon = totalDrop >= 0 ? "📈" : "💸"
        tweetText += `• Cambió un ${totalPercent.toFixed(2)}% ${percentEmoticon}\n`
        tweetText += `• De un total de ${totalProducts} productos, la caída fue de ${totalDrop} pesos ${dolarEmoticon}`

        const tweet = await twitterClient.v2.tweet(tweetText)
        return tweet
    } catch (err) {
        console.error("Error al enviar tweetVariations:", err)
    }
}

export const tweetCategoryDecrease = async(variations, date, firstDateOfMonth) => {
    try {
        const { firstDay, lastDay, monthName } = getDaysAndMonth(date, firstDateOfMonth)

        let tweetText = `📉 Las categorías con mayor caída de precios entre el ${firstDay} y el ${lastDay} de ${monthName}:\n\n`
        
        variations.forEach(category => {
            tweetText += `• ${getEmojiForCategory(category.category)} ${category.category}: ${category.categoryPercentDifference}%\n`
        })
        const tweet = await twitterClient.v2.tweet(tweetText)
        return tweet
    } catch(err) {
        console.error("Error al enviar tweetCategoryDecrease:", err)
    }
}

export const tweetCategoryIncrease = async(variations, date, firstDateOfMonth) => {
    try {
        const { firstDay, lastDay, monthName } = getDaysAndMonth(date, firstDateOfMonth)

        let tweetText = `📈 Las categorías con mayor aumento de precios entre el ${firstDay} y el ${lastDay} de ${monthName}:\n\n`
        
        console.log(variations)
        variations.forEach(category => {
            tweetText += `• ${getEmojiForCategory(category.category)} ${category.category}: +${category.categoryPercentDifference}%\n`
        })

        const tweet = await twitterClient.v2.tweet(tweetText)
        return tweet
    } catch(err) {
        console.error("Error al enviar tweetCategoryIncrease:", err)
    }
}

