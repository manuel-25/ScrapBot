# ScrapBot

## Objetivo del Proyecto

El objetivo del proyecto es crear un bot automatizado que publique la variación mensual de la Canasta Básica Alimentaria (CBA).

## Funciones Principales

ScrapBot tiene dos funciones principales:

1. **Web Scraping:** Recorre la web de Jumbo y recopila y almacena en MongoDB los datos de los productos. Está diseñado para evitar errores y reintentar en caso de que falle, siendo un código robusto y complejo para garantizar la eficacia.

2. **Publicación de Variación Mensual:** Publica la variación mensual de la Canasta Básica Alimentaria utilizando los datos recopilados a través del web scraping. Esto se realiza de manera automatizada y programada, asegurando una actualización regular y precisa de la información.

## Tecnologías Usadas

- **dotenv:** ^16.4.5
- **mongoose:** ^8.3.1
- **node-cron:** ^3.0.3
- **node-fetch:** ^3.3.2
- **nodemailer:** ^6.9.13
- **puppeteer:** ^22.6.3
- **twitter-api-v2:** ^1.16.3
- **winston:** ^3.13.0

## Instalación y Configuración

1. Clona el proyecto desde [ScrapBot GitHub Repository](https://github.com/manuel-25/ScrapBot.git).
2. Ejecuta `npm install`.
3. Ejecuta `node src/index.js` para correr el bot.