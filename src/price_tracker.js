import connectDB from './config/mongoose-config.js'
import RecordManager from "./Mongo/recordManager.js"
import logger from "./config/winston.js"

async function main() {
    try {
        await connectDB();
        const today = new Date(new Date().getTime() - (3 * 60 * 60 * 1000)) // Ajustar a la hora de Argentina (GTM - 3)
        const currentDateISO = today.toISOString()
        const month = today.getMonth()
        const year = today.getFullYear()
        const firstDateOfMonth = await  RecordManager.getFirstDayOfMonth(month, year)
        if(!firstDateOfMonth) throw new Error(`No se encontró el primer día del mes ${month + 1} en el año ${year}.`)
        
        const historicData = await RecordManager.getByDateRecord(firstDateOfMonth)
        console.log('historicData: ', historicData.length)
        const currentData = await RecordManager.getByDateRecord(today)
        console.log('currentData: ', currentData.length)

        const historicMap = createHistoricMap(historicData)
        //console.log(historicMap)

    } catch (err) {
        console.error("Unexpected error:", err)
    }
}

function createHistoricMap(historicData) {
    const historicMap = {}
    historicData.forEach(category => {
      category.data.forEach(product => {
        historicMap[product.nombre] = product // Asocia el nombre del producto como clave con el producto como valor
      })
    })
    return historicMap
}

function compareCategoryPrices(currentData, historicData) {
    const comparedResults = []

}

main()
