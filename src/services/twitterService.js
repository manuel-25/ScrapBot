import { twitterClient } from "../config/twitterClient.js"
import { formatter, getEmojiForCategory, getDaysAndMonth } from "../config/utils.js"
import logger from "../config/winston.js"
//AGREGAR VALIDACIONES SI NO ESTA TODO NO SE TUITEA

// Función para tuitear información sobre variaciones de precios
export const tweetVariations = async (variations, date, firstDateOfMonth) => {
    try {
        if(!variations) {
            throw new Error('La lista de categorias no ha sido proporcionada')
        }

        if(!date) {
            throw new Error('La fecha no ha sido proporcionada')
        }

        if(!firstDateOfMonth) {
            throw new Error('La fecha historica no ha sido proporcionada')
        }

        //Dates
        const { lastDay, monthName } = getDaysAndMonth(date, firstDateOfMonth)

        let tweetText = `📊 Variación de precios de la canasta básica de ${monthName} al dia ${lastDay}:\n\n`
        const percentEmoticon = variations.totalPercentDifference >= 0 ? "📈" : "📉"

        const totalPercent = variations.totalWeightedPercent
        const totalProducts = variations.totalProducts
        const totalDrop = formatter.format(variations.totalPriceDifference)
        const dolarEmoticon = totalDrop >= 0 ? "📈" : "💸"
        tweetText += `• Cambió un ${totalPercent.toFixed(2)}% ${percentEmoticon}\n`
        tweetText += `• De un total de ${totalProducts} productos, la ${totalDrop >= 0 ? 'subida' : 'caída'} fue de ${totalDrop} pesos ${dolarEmoticon}`

        const tweet = await twitterClient.v2.tweet(tweetText)
        logger.info('tweetVariations: ', tweet)
        /*const tweet = tweetText
        console.log('tweet: ', tweet)*/
        return tweet
    } catch (err) {
        logger.error("tweetVariations error:", err)
    }
}

export const tweetCategoryDecrease = async(variations, date, firstDateOfMonth) => {
    try {
        if(!variations) {
            throw new Error('La lista de categorias no ha sido proporcionada')
        }

        if(!date) {
            throw new Error('La fecha no ha sido proporcionada')
        }

        if(!firstDateOfMonth) {
            throw new Error('La fecha historica no ha sido proporcionada')
        }

        const { lastDay, monthName } = getDaysAndMonth(date, firstDateOfMonth)

        let tweetText = `📉 Las categorías con mayor caída de precios de ${monthName} al dia ${lastDay}:\n\n`
        
        if(variations.length < 1) {
            tweetText += 'No hay categorias con variaciones negativas.'
        } else {
            variations.forEach(category => {
                tweetText += ` ${getEmojiForCategory(category.category)} ${category.category}: ${category.categoryPercentDifference.toFixed(2)}%\n`
            })
        }

        const tweet = await twitterClient.v2.tweet(tweetText)
        logger.info('tweetCategoryDecrease: ', tweet)
        /*const tweet = tweetText
        console.log('tweet: ', tweet)*/
        return tweet
    } catch(err) {
        logger.error("tweetCategoryDecrease error:", err)
    }
}

export const tweetCategoryIncrease = async(variations, date, firstDateOfMonth) => {
    try {
        if(!variations) {
            throw new Error('La lista de categorias no ha sido proporcionada')
        }

        if(!date) {
            throw new Error('La fecha no ha sido proporcionada')
        }

        if(!firstDateOfMonth) {
            throw new Error('La fecha historica no ha sido proporcionada')
        }

        const { lastDay, monthName } = getDaysAndMonth(date, firstDateOfMonth)

        let tweetText = `📈 Las categorías con mayor aumento de precios de ${monthName} al dia ${lastDay}:\n\n`
        
        if(variations.length < 1) {
            tweetText += 'No hay categorias con variaciones positivas.'
        } else {
            variations.forEach(category => {
                tweetText += ` ${getEmojiForCategory(category.category)} ${category.category}: +${category.categoryPercentDifference.toFixed(2)}%\n`
            })
        }

        /*const tweet = await twitterClient.v2.tweet(tweetText)
        logger.info('tweetCategoryIncrease: ', tweet)*/
        const tweet = tweetText
        console.log('tweet: ', tweet)
        return tweet
    } catch(err) {
        logger.error("tweetCategoryIncrease error:", err)
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
        logger.error("Error al enviar el tuit del inicio del mes:", err)
    }
}

// A implementar...
export const tweetCategoryList = async (categories) => {
    try {
        let tweetText = "🔍 Se analizarán las siguientes categorías:\n\n"

        categories.forEach((categoryName) => {
            const emoji = getEmojiForCategory(categoryName)
            tweetText += `${emoji} ${categoryName}\n`
        })

        console.log("Tweet:", tweetText)
        // const tweet = await twitterClient.v2.tweet(tweetText)
        return tweetText
    } catch (err) {
        logger.error("tweetCategoryList error:", err)
    }
}

export async function tweetProductDecrease(topDecrease, category) {
    try {
        if (!topDecrease || topDecrease.length === 0) {
            throw new Error("No hay productos con mayores caídas para tuitear")
        }

        const emoji = getEmojiForCategory(category)
        let tweetText = `📉 Productos de ${category} con mayores caídas de precios:\n`

        topDecrease.sort((a, b) => a.percentDifference - b.percentDifference)
        // Validación para mantener el texto dentro del límite de caracteres
        topDecrease.forEach((product) => {
            const productText = `${emoji} ${product.productName}: ${product.percentDifference.toFixed(2)}% ($${
                formatter.format(product.currentPrice)
            })\n`

            if (tweetText.length + productText.length < 279) {
                tweetText += productText
            }
        })

        const tweet = await twitterClient.v2.tweet(tweetText)
        logger.info("tweetProductDecrease:", tweet)
        return tweet
    } catch (err) {
        logger.error("tweetProductDecrease error:", err)
    }
}

export async function tweetProductIncrease(topIncrease, category) {
    try {
        if (!topIncrease || topIncrease.length === 0) {
            throw new Error("No hay productos con mayores subidas para tuitear")
        }

        const emoji = getEmojiForCategory(category)
        let tweetText = "📈 Productos con mayores subidas de precios:\n"

        // Validación para mantener el texto dentro del límite de caracteres
        topIncrease.forEach((product) => {
            const productText = `${emoji} ${product.productName}: ${product.percentDifference.toFixed(2)}% ($${
                formatter.format(product.currentPrice)
            })\n`

            if (tweetText.length + productText.length < 279) {
                tweetText += productText
            }
        })

        const tweet = await twitterClient.v2.tweet(tweetText)
        logger.info("tweetProductIncrease:", tweet)
        return tweet
    } catch (err) {
        logger.error("tweetProductIncrease error:", err)
    }
}