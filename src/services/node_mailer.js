import nodemailer from 'nodemailer';

// Configurar el transporte de correo electrónico
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'manuelotamendi97@gmail.com',
        pass: 'tu-contraseña',
    },
})

// Función para enviar un correo electrónico
export async function sendEmail(subject, text) {
    const mailOptions = {
        from: 'manuelotamendi97@gmail.com',
        to: 'manuelotamendi97@gmail.com',
        subject: subject,
        text: text,
    }

    try {
        await transporter.sendMail(mailOptions)
        console.log("Correo electrónico enviado con éxito")
    } catch (error) {
        console.error("Error al enviar el correo electrónico:", error)
    }
}

// Ejemplo de uso para enviar un correo al finalizar el proceso de scraping
async function scrapeAndNotify() {
    // Imagina que aquí haces todo el scraping y tienes el resultado
    const scrapingResult = "El scraping se completó con éxito. Resultado: XYZ"

    // Llamar a la función para enviar el correo electrónico
    await sendEmail("Resultado del Scraping", scrapingResult)
}
