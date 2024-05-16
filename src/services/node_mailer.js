import nodemailer from 'nodemailer'
import { google } from 'googleapis'

// Configurar el transporte de correo electrónico
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type: 'OAuth2',
        user: 'manuelotamendi97@gmail.com',
        clientId: 'TU_CLIENT_ID',
        clientSecret: 'TU_CLIENT_SECRET',
        refreshToken: 'TU_REFRESH_TOKEN',
        accessToken: 'TU_ACCESS_TOKEN', // No siempre necesario
    },
})

// Obtener un cliente OAuth2
const oAuth2Client = new google.auth.OAuth2(
    'TU_CLIENT_ID',
    'TU_CLIENT_SECRET',
    'TU_REDIRECT_URL' // Por ejemplo, 'https://developers.google.com/oauthplayground'
)

// Generar un enlace de autorización
const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://mail.google.com/'],
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

async function scrapeAndNotify() {
    // Imagina que aquí haces todo el scraping y tienes el resultado
    const scrapingResult = "El scraping se completó con éxito. Resultado: XYZ"

    // Llamar a la función para enviar el correo electrónico
    await sendEmail("Resultado del Scraping", scrapingResult)
}

// Llamar a la función para enviar el correo electrónico
scrapeAndNotify()
