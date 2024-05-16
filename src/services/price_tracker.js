import connectDB from '../config/mongoose-config.js'
import RecordManager from "../Mongo/recordManager.js"
import VariationManager from '../Mongo/variationManager.js'
import logger from "../config/winston.js"
import { categoryWeight, weightTotal } from '../config/utils.js'
import { tweetVariations, tweetCategoryDecrease, tweetCategoryIncrease, tweetStartOfMonth, tweetProductDecrease, tweetProductIncrease } from './twitterService.js'
const today = new Date(new Date().getTime() - (3 * 60 * 60 * 1000))

//Record daily variation (only 1 time per day after scrapping is done)
export async function recordVariation(today) {
    try {
        const validToday = createValidDate(today)

        const firstDateOfMonth = await getFirstDateOfMonth(validToday)
        if(!firstDateOfMonth) throw new Error('No se encontro el primer registro del mes')

        const historicData = await RecordManager.getByDateRecord(firstDateOfMonth)
        const currentData = await RecordManager.getByDateRecord(validToday)

        const historicMap = createHistoricMap(historicData)
        const comparedPrices = compareCategoryPrices(currentData, historicMap, validToday)
        if(comparedPrices) {
            console.log(comparedPrices)
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
        if (!(today instanceof Date)) {
            throw new Error('La fecha proporcionada no es válida.')
        }
        
        const month = today.getMonth()
        const year = today.getFullYear()

        // Consulta el primer registro del mes actual en la base de datos
        const firstRecord = await RecordManager.getFirstDayOfMonth(month, year)
        if (!firstRecord) {
            throw new Error(`No se encontró el primer día del mes ${month + 1}.`)
        }

        const firstDateOfMonth = new Date(firstRecord)
        if (isNaN(firstDateOfMonth.getTime())) {
            throw new Error(`La fecha del primer registro del mes es inválida: ${firstRecord.date}`)
        }

        return firstDateOfMonth
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
        totalWeightedPercent: 0,
        totalProducts: 0,
        results: []
    }

    //Category Data
    let totalHistoricPrice = 0
    let totalCurrentPrice = 0
    let totalProducts = 0

    currentData.forEach(category => {
        //Categories data
        const categoryResults = {
            category: category.category,
            categoryPriceDifference: 0,
            categoryPercentDifference: 0,
            categoryWeightedPercent: 0,
            products: 0,
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
                categoryResults.products++

                // Acumular para el total
                categoryHistoricPrice += historicPrice
                categoryCurrentPrice += currentPrice
                totalHistoricPrice += historicPrice
                totalCurrentPrice += currentPrice
                totalProducts ++
            }
        })

        // Calcular el cambio porcentual total para la categoría
        if (categoryHistoricPrice > 0) {
            categoryResults.categoryPercentDifference = parseFloat(((categoryCurrentPrice - categoryHistoricPrice) / categoryHistoricPrice * 100).toFixed(3))
        }

        // Calcular ponderacion de la categoría
        const weightRelative = categoryWeight[category.category] / weightTotal
        categoryResults.categoryWeightedPercent = parseFloat((categoryResults.categoryPercentDifference * weightRelative).toFixed(3))
        comparedResults.totalWeightedPercent += parseFloat((categoryResults.categoryWeightedPercent).toFixed(3))

        comparedResults.results.push(categoryResults)
    })

    // Calcular el cambio porcentual total para todos los productos
    comparedResults.totalProducts = totalProducts
    if (totalHistoricPrice > 0) {
        comparedResults.totalPriceDifference = parseFloat((totalCurrentPrice - totalHistoricPrice).toFixed(3))
        comparedResults.totalPercentDifference = parseFloat(((comparedResults.totalPriceDifference / totalHistoricPrice) * 100).toFixed(3))
    }

    comparedResults.totalWeightedPercent = parseFloat((comparedResults.totalWeightedPercent).toFixed(3))

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
            logger.error('No se encontraron variaciones para la fecha: firstDateOfMonth ', date)
            return false
        }

        //First day of month
        const todayNumber = date.getDate()
        const firstDateDay = firstDateOfMonth.getDate()
        if(todayNumber === firstDateDay){
            const tweet = await tweetStartOfMonth(date, firstDateOfMonth)
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
    
        const { topDecreases } = await getCategoryVariations(date, 5)
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
    
        const { topIncreases } = await getCategoryVariations(date, 5)
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

await connectDB()
//const variation = await recordVariation(today)
//console.log('variation', variation)

await categoryIncreases(today)
//await categoryDecreases(today)


//const category = 'Azucar'
//const { topIncreases, topDecreases } = await getIncreaseAndDecrease(today, category, 10)
//console.log('topDecreases: ', topDecreases)
//console.log('topIncreases: ', topIncreases)

//tweetProductDecrease(topDecreases, category)
//tweetProductIncrease(topIncreases, category)

