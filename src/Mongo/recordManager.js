import recordModel from "./models/record.model.js"

class RecordManagerDao {
    constructor() {
        this.recordModel = recordModel
    }

    async getAll() {
        return await recordModel.find({})
    }

    async getById(recordId) {
        return await recordModel.findById(recordId)
    }

    async create(data) {
        return await recordModel.create(data)
    }

    async update(recordId, data, config) {
        return await recordModel.findByIdAndUpdate(recordId, data, config)
    }

    async delete(recordId) {
        return await recordModel.findByIdAndDelete(recordId)
    }

    // Obtiene el primer registro del mes específico
    async getFirstDayOfMonth(month, year) {
        const startOfMonth = new Date(year, month, 1)
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999)

        const earliestRecord = await this.recordModel
            .find({ date: { $gte: startOfMonth, $lte: endOfMonth } }) // Filtrar por el mes
            .sort({ date: 1 }) // Ordenar por fecha ascendente
            .limit(1) // Limitar a un resultado
            .exec() // Ejecutar la consulta

        return earliestRecord[0].date
    }

    // Obtiene el último registro del mes específico
    async getLastDayOfMonth(month, year) {
        const startOfMonth = new Date(year, month, 1)
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999)

        const latestRecord = await this.recordModel
            .find({ date: { $gte: startOfMonth, $lte: endOfMonth } })
            .sort({ date: -1 })
            .limit(1)

        return latestRecord[0]
    }

    //Returns all the records from the date parameter.
    async getByDateRecord(date) {
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)
      
        const endOfDay = new Date(date)
        endOfDay.setDate(endOfDay.getDate() + 1)
        endOfDay.setHours(0, 0, 0, 0)
      
        return await this.recordModel.find({
            date: {
                $gte: startOfDay,
                $lt: endOfDay,
            },
        })
    }

    async getRecordByCategoryAndDate(category, date) {
        return await this.recordModel.findOne({ category, date })
    }
    
    async deleteRecordsOfToday() {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        return await this.recordModel.deleteMany({
            date: {
                $gte: today,
                $lt: tomorrow,
            },
        })
    }

    // Elimina todos los registros de un mes excepto el primero y el último
    async deleteRecordsExceptFirstAndLast(month, year) {
        const firstRecord = await this.getFirstDayOfMonth(month, year)
        const lastRecord = await this.getLastDayOfMonth(month, year)

        if (!firstRecord || !lastRecord) {
            throw new Error(`No se encontraron registros para el mes ${month + 1} del año ${year}.`)
        }

        // Elimina todos los registros entre el primero y el último
        return await this.recordModel.deleteMany({
            date: {
                $gt: firstRecord.date,
                $lt: lastRecord.date,
            },
        })
    }

}

const RecordManager = new RecordManagerDao()
export default RecordManager