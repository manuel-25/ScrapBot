import connectDB from '../config/mongoose-config.js'
import RecordManager from "../Mongo/recordManager.js"
import VariationManager from '../Mongo/variationManager.js'
import logger from "../config/winston.js"
import { tweetVariations } from './twitterService.js'

const today = new Date(new Date().getTime() - (3 * 60 * 60 * 1000)) // Ajustar a la hora de Argentina (GTM - 3)

async function recordVariation() {
    try {
        //await connectDB()

        const firstDateOfMonth = await getFirstDateOfMonth(today)
        const historicData = await RecordManager.getByDateRecord(firstDateOfMonth)
        const currentData = await RecordManager.getByDateRecord(today)

        const historicMap = createHistoricMap(historicData)
        const comparedPrices = compareCategoryPrices(currentData, historicMap, today)
        if(comparedPrices) {
            const recordedVariation = await VariationManager.create(comparedPrices)
            console.log('recordedVariation: ', recordedVariation)
        }
    } catch (err) {
        console.error("Unexpected error:", err)
    }
}

async function getFirstDateOfMonth(today) {
    try {
        const month = today.getMonth()
        const year = today.getFullYear()
        const firstDateOfMonth = await  RecordManager.getFirstDayOfMonth(month, year)
        if(!firstDateOfMonth) throw new Error(`No se encontró el primer día del mes ${month + 1} en el año ${year}.`)
        return firstDateOfMonth
    } catch(err) {
        console.error(err)
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

async function tweetDateVariation(date) {
    const firstDateOfMonth = await getFirstDateOfMonth(date)
    if(!firstDateOfMonth) throw new Error('No se ah encontrado el primer registro del mes')

    const variations = await VariationManager.getByDate(date)
    if (!variations) throw new Error("No se encontraron variaciones para la fecha:", date)

    const tweet = await tweetVariations(variations, date, firstDateOfMonth)
    console.log('tweet: ', tweet)
}



await connectDB()
//await recordVariation()
const tweet = await tweetDateVariation(today)
console.log(tweet)

//const { topIncreases, topDecreases } = await getIncreaseAndDecrease(today, 'Vino', 20)
//const { topIncreases, topDecreases } = await getCategoryVariations(today, 10)
//console.log('topIncreases: ', topIncreases)
//console.log('topDecreases: ', topDecreases)