import { Schema, model } from "mongoose";

// Schema para cada producto dentro de la categoría
const productSchema = new Schema({
    productName: { type: String, required: true, index: true },
    currentPrice: { type: Number },
    historicPrice: { type: Number, required: true },
    priceDifference: { type: Number, required: true },
    percentDifference: { type: Number, required: true },
})

// Schema para cada categoría
const categorySchema = new Schema({
    category: { type: String, required: true, index: true },
    categoryPriceDifference: { type: Number, required: true },
    categoryPercentDifference: { type: Number, required: true },
    data: [productSchema],
})

// Schema para los resultados completos
const comparisonResultSchema = new Schema({
    date: { type: Date, required: true, index: true},
    totalPriceDifference: { type: Number, required: true },
    totalPercentDifference: { type: Number, required: true },
    totalProducts: { type: Number, required: true},
    results: [categorySchema],
})

const priceVariation = model("price_variation", comparisonResultSchema)

export default priceVariation
