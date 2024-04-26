import priceVariation from './models/variation.model.js'

class VariationManagerDao {
    constructor() {
        this.priceVariationModel = priceVariation
    }

    // Obtener todas las variaciones de precios
    async getAll() {
        return await this.priceVariationModel.find({})
    }

    // Obtener variación de precios por ID
    async getById(variationId) {
        return await this.priceVariationModel.findById(variationId)
    }

    // Crear una nueva variación de precios
    async create(data) {
        return await this.priceVariationModel.create(data)
    }

    // Actualizar una variación de precios existente
    async update(variationId, data, config) {
        return await this.priceVariationModel.findByIdAndUpdate(variationId, data, config)
    }

    // Eliminar una variación de precios por ID
    async delete(variationId) {
        return await this.priceVariationModel.findByIdAndDelete(variationId)
    }

    // Obtener variación de precios por fecha
    async getByDate(date) {
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)

        const endOfDay = new Date(date)
        endOfDay.setDate(endOfDay.getDate() + 1)
        endOfDay.setHours(0, 0, 0, 0) 

        return await this.priceVariationModel.findOne({
            date: {
                $gte: startOfDay,
                $lt: endOfDay,
            }
        })
    }
}

const VariationManager = new VariationManagerDao()
export default VariationManager
