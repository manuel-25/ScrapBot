import recordModel from "./models/record.model.js";

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

    async getByDate(date) {
        return await this.recordModel.find({ date: { $gte: new Date(date) } })
    }
}

const RecordManager = new RecordManagerDao()
export default RecordManager