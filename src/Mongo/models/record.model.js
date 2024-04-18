import { Schema, model} from 'mongoose'

const productSchema = new Schema({
    nombre: { type: String },
    marca: { type: String },
    precio: { type: Number },
    precioRegular: { type: String }
})

const collection = 'registro_precios'
const recordSchema = new Schema({
    category: {type: String },
    date: {type: Date, default:  Date.now()},
    total_products: { type: Number, index: true},
    time_spent: { type: String},
    url: { type: String },  
    data: [productSchema]
})

const recordModel = model(collection, recordSchema)
export default recordModel