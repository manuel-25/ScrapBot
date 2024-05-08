import connectDB from '../config/mongoose-config.js'
import RecordManager from "../Mongo/recordManager.js"
import VariationManager from '../Mongo/variationManager.js'
import logger from "../config/winston.js"
import { tweetVariations, tweetCategoryDecrease, tweetCategoryIncrease, tweetStartOfMonth } from './twitterService.js'
export const today = new Date(new Date().getTime() - (3 * 60 * 60 * 1000))

//Record daily variation (only 1 time per day after scrapping is done)
export async function recordVariation(today) {
    try {
        const validToday = createValidDate(today)

        const firstDateOfMonth = await getFirstDateOfMonth(validToday)
        if(!firstDateOfMonth) throw new Error('recordVariation error: No se encontro el primer registro del mes')

        const historicData = await RecordManager.getByDateRecord(firstDateOfMonth)
        const currentData = await RecordManager.getByDateRecord(validToday)

        const historicMap = createHistoricMap(historicData)
        const comparedPrices = compareCategoryPrices(currentData, historicMap, validToday)
        if(comparedPrices) { 
            await VariationManager.create(comparedPrices) 
            logger.info('Variation recorded succesfully')
            return true
        }
        return false
    } catch (err) {
        logger.error("recordVariation error:", err)
        return false
    }
}

// Asegurar la creación de fechas válidas
function createValidDate(value) {
    const date = new Date(value)
    if (isNaN(date.getTime())) {
        throw new Error("Fecha no válida: " + value)
    }
    return date
}

//Return the date of the first price records of the actual month.
async function getFirstDateOfMonth(today) {
    try {
        const validToday = createValidDate(today) // Validar la fecha antes de usarla
        
        const month = validToday.getMonth()
        const year = validToday.getFullYear()

        const firstDateOfMonth = await RecordManager.getFirstDayOfMonth(month, year)
        
        if (!firstDateOfMonth || isNaN(new Date(firstDateOfMonth).getTime())) {
            throw new Error(`No se encontró el primer día del mes ${month + 1} en el año ${year}`)
        }

        return new Date(firstDateOfMonth) // Devolver la primera fecha del mes
    } catch (err) {
        logger.error("getFirstDateOfMonth error:", err)
        throw err
    }
}

function createHistoricMap(historicData) {
    const historicMap = {}
    historicData.forEach(category => {
      category.data.forEach(product => {
        historicMap[product.nombre] = product
      })
    })
    return historicMap
}

function compareCategoryPrices(currentData, historicMap, date) {
    const comparedResults = {
        date: date,
        totalPriceDifference: 0,
        totalPercentDifference: 0,
        totalProducts: 0,
        results: []
    }

    let totalHistoricPrice = 0
    let totalCurrentPrice = 0
    let totalProducts = 0
    let products = 0

    currentData.forEach(category => {
        //Categories data
        const categoryResults = {
            category: category.category,
            categoryPriceDifference: 0,
            categoryPercentDifference: 0,
            products,
            data: []
        }

        let categoryHistoricPrice = 0
        let categoryCurrentPrice = 0

        category.data.forEach(product => {
            const productName = product.nombre
            const currentPrice = product.precio

            const historicProduct = historicMap[productName]
            if (historicProduct) {
                const historicPrice = historicProduct.precio
                const priceDifference = parseFloat((currentPrice - historicPrice).toFixed(3))
                const percentDifference = parseFloat(((priceDifference / historicPrice) * 100).toFixed(3))

                categoryResults.data.push({
                    productName,
                    currentPrice,
                    historicPrice,
                    priceDifference,
                    percentDifference
                })

                // Sumar al total para la categoría y el global
                categoryResults.categoryPriceDifference += priceDifference
                categoryResults.categoryPriceDifference =  parseFloat(categoryResults.categoryPriceDifference.toFixed(3))
                categoryResults.products = categoryResults.data.length
                categoryHistoricPrice += historicPrice
                categoryCurrentPrice += currentPrice

                // Acumular para el total
                totalHistoricPrice += historicPrice
                totalCurrentPrice += currentPrice
                totalProducts ++
            }
        })

        // Calcular el cambio porcentual total para la categoría
        if (categoryHistoricPrice > 0) {
            categoryResults.categoryPercentDifference = parseFloat(((categoryCurrentPrice - categoryHistoricPrice) / categoryHistoricPrice * 100).toFixed(3))
        }

        comparedResults.results.push(categoryResults)
    })

    // Calcular el cambio porcentual total para todos los productos
    comparedResults.totalProducts = totalProducts
    if (totalHistoricPrice > 0) {
        comparedResults.totalPriceDifference = parseFloat((totalCurrentPrice - totalHistoricPrice).toFixed(3))
        comparedResults.totalPercentDifference = parseFloat(((comparedResults.totalPriceDifference / totalHistoricPrice) * 100).toFixed(3))
    }

    return comparedResults
}

function sortVariations(variations, category) {
    let results = variations.results
    results = results.find(product => product.category === category)
    if(results == null) throw new Error(`La categoría "${category}" no existe en las variaciones`)
    const sortByPercent = results.data.sort((a, b) => b.percentDifference - a.percentDifference)
    return sortByPercent
}

async function getIncreaseAndDecrease(date, category, topCount) {
    try {
        if(!category) throw new Error('No se ha especificado una categoría')

        const variations = await VariationManager.getByDate(date)
        if(!variations) throw new Error('No se encontraron variaciones de la fecha: ', date)

        const sortByPercent = sortVariations(variations, category)

        const topIncreases = sortByPercent.slice(0, topCount)
        const topDecreases = sortByPercent.slice(-topCount)
        
        return { topIncreases, topDecreases }
    } catch(err) {
        console.error('Unexpected error: ', err)
    }
}

async function getCategoryVariations(date, topCount) {
    try {
        const variations = await VariationManager.getByDate(date)
        if (!variations) throw new Error("No se encontraron variaciones para la fecha:", date)

        const categoriesSortedByPercent = variations.results.sort((a, b) => b.categoryPercentDifference - a.categoryPercentDifference)

        const topIncreases = categoriesSortedByPercent.slice(0, topCount)
        const topDecreases = categoriesSortedByPercent.slice(-topCount)
        return { topIncreases, topDecreases }
    } catch(err) {
        console.error(err)
    }
}

export async function tweetDateVariation(date) {
    try {
        const firstDateOfMonth = await getFirstDateOfMonth(date)
        if(!firstDateOfMonth) {
            logger.error('No se encontraron variaciones para la fecha: ', date)
            return false
        }

        //First day of month
        const dayNumber = today.getDay()
        const firstDateDay = firstDateOfMonth.getDay()
        if(dayNumber === firstDateDay){
            const tweet = await tweetStartOfMonth(today, firstDateOfMonth)
            return false
        }
    
        const variations = await VariationManager.getByDate(date)
        if (!variations) { 
            logger.error('No se encontraron variaciones para la fecha: ', date)
            return false
        }
    
        const tweet = await tweetVariations(variations, date, firstDateOfMonth)
        return tweet
    } catch(err) {
        logger.error('tweetDateVariation error', err)
    }
}

export async function categoryDecreases(date) {
    try {
        const firstDateOfMonth = await getFirstDateOfMonth(date)
        if(!firstDateOfMonth) {
            logger.error('No se ah encontrado el primer registro del mes')
            return false
        }
    
        const { topDecreases } = await getCategoryVariations(today, 5)
        if (!topDecreases) {
            logger.error('No se encontraron variaciones negativas de categoria para la fecha: ', date)
            return false
        }
    
        const negativePercentCategories = topDecreases.filter(category => category.categoryPercentDifference < 0)

        const tweet = await tweetCategoryDecrease(negativePercentCategories, date, firstDateOfMonth)
        return tweet
    } catch(err) {
        console.error('Error al generar el Tweet', err)
    }
}

export async function categoryIncreases(date) {
    try {
        const firstDateOfMonth = await getFirstDateOfMonth(date)
        if(!firstDateOfMonth) {
            logger.error('No se ah encontrado el primer registro del mes')
            return false
        }
    
        const { topIncreases } = await getCategoryVariations(today, 5)
        if (!topIncreases) {
            logger.error("No se encontraron variaciones positivas de categoria para la fecha:", date)
            return false
        }
    
        const positivePercentCategories = topIncreases.filter(category => category.categoryPercentDifference > 0)

        const tweet = await tweetCategoryIncrease(positivePercentCategories, date, firstDateOfMonth)
        return tweet
    } catch(err) {
        logger.error('categoryIncreases error', err)
    }
}

//let yesterday = new Date(today)
//yesterday.setDate(yesterday.getDate() - 1)


/*await connectDB()
await recordVariation(today)
await tweetDateVariation(today)
await categoryIncreases(today)
await categoryDecreases(today)*/


//await connectDB()
//const { topIncreases, topDecreases } = await getIncreaseAndDecrease(today, 'Carne Cerdo', 5)
//const { topIncreases, topDecreases } = await getCategoryVariations(yesterday, 10)
//console.log('topIncreases: ', topIncreases)
//console.log('topDecreases: ', topDecreases)