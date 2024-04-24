import connectDB from './config/mongoose-config.js'
import RecordManager from "./Mongo/recordManager.js"
import VariationManager from './Mongo/variationManager.js'
import logger from "./config/winston.js"

async function main() {
    try {
        await connectDB();
        const today = new Date(new Date().getTime() - (3 * 60 * 60 * 1000)) // Ajustar a la hora de Argentina (GTM - 3)
        const currentDateISO = today.toISOString()

        //TESTING ONLY
        /*const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 2)*/

        const month = today.getMonth()
        const year = today.getFullYear()
        const firstDateOfMonth = await  RecordManager.getFirstDayOfMonth(month, year)
        if(!firstDateOfMonth) throw new Error(`No se encontró el primer día del mes ${month + 1} en el año ${year}.`)
        
        const historicData = await RecordManager.getByDateRecord(firstDateOfMonth)
        //console.log('historicData: ', historicData.length)
        const currentData = await RecordManager.getByDateRecord(today)
        //console.log('currentData: ', currentData.length)

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

    currentData.forEach(category => {
        const categoryResults = {
            category: category.category,
            categoryPriceDifference: 0,
            categoryPercentDifference: 0,
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

main()
