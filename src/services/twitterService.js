import { twitterClient } from "../config/twitterClient.js"


// Función para tuitear información sobre variaciones de precios
const tweetVariations = async (variations, date, firstDateOfMonth) => {
    //Mover a otro lado
    const formatter = new Intl.NumberFormat('es-ES', {
        style: 'decimal', // Estilo decimal
        minimumFractionDigits: 2, // Mínimo de dígitos decimales
        maximumFractionDigits: 2, // Máximo de dígitos decimales
    })
    try {
        //Dates
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
        const firstDay = firstDateOfMonth.getDate()
        const month = firstDateOfMonth.getMonth()
        const monthName = monthNames[month]
        const lastDay = date.getDate()

        let tweetText = `📊 Variación de precios de la canasta básica entre el ${firstDay} y el ${lastDay} de ${monthName}:\n\n`
        const percentEmoticon = variations.totalPercentDifference >= 0 ? "📈" : "📉"

        const totalPercent = variations.totalPercentDifference
        const totalProducts = variations.totalProducts
        const totalDrop = formatter.format(variations.totalPriceDifference)
        const dolarEmoticon = totalDrop >= 0 ? "📈" : "💸"
        tweetText += `• Cambió un ${totalPercent.toFixed(2)}% ${percentEmoticon}\n`
        tweetText += `• De un total de ${totalProducts} productos, la caída fue de ${totalDrop} pesos ${dolarEmoticon}`

        const tweet = await twitterClient.v2.tweet(tweetText)
        return tweet
    } catch (err) {
        console.error("Error al enviar el tweetVariations:", err)
    }
}

export { tweetVariations }
