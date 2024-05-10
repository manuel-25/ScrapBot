# ScrapBot

## Objetivo del Proyecto

El objetivo del proyecto es crear un bot automatizado que publique la variación mensual de la Canasta Básica Alimentaria (CBA) de los productos de Jumbo.

## Funciones Principales

ScrapBot tiene dos funciones principales:

1. **Web Scraping:** Recorre la web de Jumbo y recopila y almacena en MongoDB los datos de los productos. Está diseñado para evitar errores y reintentar en caso de que falle, siendo un código robusto y complejo para garantizar la eficacia.

2. **Analisis de Variación Mensual:** Analiza los datos guardados del scrapping, los pondera y publica la variación mensual de la Canasta Básica Alimentaria utilizando los datos recopilados a través del web scraping. Esto se realiza de manera automatizada y programada, asegurando una actualización regular y precisa de la información.

## Tecnologías Usadas

- **MongoDB**
- **Node-cron**
- **Nodemailer**
- **Puppeteer**
- **Twitter-api-v2**
- **Winston**

## Instalación y Configuración

1. Clona el proyecto desde `https://github.com/manuel-25/ScrapBot.git`
2. Ejecuta `npm install`.
3. Ejecuta `node src/index.js` para correr el bot.
