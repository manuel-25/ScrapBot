import { twitterClient } from "../config/twitterClient.js"
import { formatter, getEmojiForCategory, getDaysAndMonth } from "../config/utils.js"
//AGREGAR VALIDACIONES SI NO ESTA TODO NO SE TUITEA

// Función para tuitear información sobre variaciones de precios
export const tweetVariations = async (variations, date, firstDateOfMonth) => {
    try {
        //Dates
        const { firstDay, lastDay, monthName } = getDaysAndMonth(date, firstDateOfMonth)

        let tweetText = `📊 Variación de precios de la canasta básica de ${monthName} al dia ${lastDay}:\n\n`
        const percentEmoticon = variations.totalPercentDifference >= 0 ? "📈" : "📉"

        const totalPercent = variations.totalPercentDifference
        const totalProducts = variations.totalProducts
        const totalDrop = formatter.format(variations.totalPriceDifference)
        const dolarEmoticon = totalDrop >= 0 ? "📈" : "💸"
        tweetText += `• Cambió un ${totalPercent.toFixed(2)}% ${percentEmoticon}\n`
        tweetText += `• De un total de ${totalProducts} productos, la caída fue de ${totalDrop} pesos ${dolarEmoticon}`

        const tweet = tweetText
        console.log('tweet: ', tweet)
        //const tweet = await twitterClient.v2.tweet(tweetText)
        return tweet
    } catch (err) {
        console.error("Error al enviar tweetVariations:", err)
    }
}

export const tweetCategoryDecrease = async(variations, date, firstDateOfMonth) => {
    try {
        const { firstDay, lastDay, monthName } = getDaysAndMonth(date, firstDateOfMonth)

        let tweetText = `📉 Las categorías con mayor caída de precios de ${monthName} al dia ${lastDay}:\n\n`
        
        variations.forEach(category => {
            tweetText += ` ${getEmojiForCategory(category.category)} ${category.category}: ${category.categoryPercentDifference.toFixed(2)}%\n`
        })

        //const tweet = await twitterClient.v2.tweet(tweetText)
        const tweet = tweetText
        console.log('tweet: ', tweet)
        return tweet
    } catch(err) {
        console.error("Error al enviar tweetCategoryDecrease:", err)
    }
}

export const tweetCategoryIncrease = async(variations, date, firstDateOfMonth) => {
    try {
        const { firstDay, lastDay, monthName } = getDaysAndMonth(date, firstDateOfMonth)

        let tweetText = `📈 Las categorías con mayor aumento de precios de ${monthName} al dia ${lastDay}:\n\n`
        
        variations.forEach(category => {
            tweetText += ` ${getEmojiForCategory(category.category)} ${category.category}: +${category.categoryPercentDifference.toFixed(2)}%\n`
        })

        //const tweet = await twitterClient.v2.tweet(tweetText)
        const tweet = tweetText
        console.log('tweet: ', tweet)
        return tweet
    } catch(err) {
        console.error("Error al enviar tweetCategoryIncrease:", err)
    }
}

// Función para tuitear el comienzo del mes
export const tweetStartOfMonth = async (today, firstDateOfMonth) => {
    try {
        const date = new Date(today.getFullYear(), today.getMonth(), 1)
        const { monthName } = getDaysAndMonth(date, firstDateOfMonth)

        const tweetText = `Arranca ${monthName}! Mañana empezamos con nuevas variaciones de precios 🌟`

        const tweet = await twitterClient.v2.tweet(tweetText)
        return tweet
    } catch (err) {
        console.error("Error al enviar el tuit del inicio del mes:", err)
    }
}

// A implementar...
export const tweetCategoryList = async (categories) => {
    try {
        let tweetText = "🔍 Se analizarán las siguientes categorías:\n\n";

        categories.forEach((categoryName) => {
            const emoji = getEmojiForCategory(categoryName);
            tweetText += `${emoji} ${categoryName}\n`;
        });

        console.log("Tweet:", tweetText);
        // const tweet = await twitterClient.v2.tweet(tweetText); // Descomentar para enviar el tweet
        return tweetText;
    } catch (err) {
        console.error("Error al enviar el tweet de la lista de categorías:", err);
    }
}