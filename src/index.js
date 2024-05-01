import puppeteer from "puppeteer"
import { writeFile } from 'fs/promises'
import connectDB from './config/mongoose-config.js'
import RecordManager from "./Mongo/recordManager.js"
import logger from "./config/winston.js"
import cron from  "node-cron";
import { jumboURLs, staticURL } from "./config/utils.js"
import { recordVariation, tweetDateVariation, categoryIncreases, categoryDecreases } from "./services/price_tracker.js"

//CANASTA BASICA https://chequeado.com/el-explicador/que-es-la-canasta-basica-alimentaria-del-indec-y-como-se-compone/
const today = new Date(new Date().getTime() - (3 * 60 * 60 * 1000)) // Ajusta a la hora de Argentina (GTM - 3)
const MAX_BOT_RETRIES = 3
const MAX_SCRAPING_PAGES = 30
const MAX_SCRAPING_RETRIES = 6
const SCRAP_RETRY = 3

function elapsedTime(startTime) {
    const endTime = new Date()
    const elapsedTime = endTime - startTime
    return formatTime(elapsedTime)
}

cron.schedule('30 8 * * *', () => {
    logger.info('Se ejecutó la tarea a las 8:30 a.m.')
})

//Code Starts here! 
//runScrapingBot()
//deleteTodayRecords()      //Borrar todos los registros de hoy 


async function runScrapingBot() {
    await connectDB()
    let attempt = 0

    while (attempt < MAX_BOT_RETRIES) {
      try {
        const { storedData, storedfailedURLs } = await scrapeDataFromURLs(jumboURLs)
        console.log('storedfailedURLs: ', storedfailedURLs)

        if(!storedData) { 
            logger.warning(`Scrapping data not recovered, trying... ${attempt}/${MAX_BOT_RETRIES}`)
            attempt++
        }

        //Scrap failed urls
        if(storedData && storedfailedURLs.length > 0) {
            logger.warning(`Scrapping successfull ${storedfailedURLs.length} URLs failed. Retrying...`)
            const failed = retryFailedURLs(storedfailedURLs)
            logger.warning(`URLS failed again: ${failed}`)
            attempt++
        }

        //Store data
        if(storedData.length === jumboURLs.length && storedfailedURLs.length < 1) {
            const result = await validateAndSaveData(storedData)
            logger.info('Data stored. fium')
            break
        }

      } catch (err) {
        attempt++
        logger.error(`Error en intento ${attempt}/${MAX_BOT_RETRIES}:`, err)

        if (attempt === MAX_BOT_RETRIES) {
            logger.fatal('El scraping falló después de varios intentos.')
        }
      }
    }
}

async function retryFailedURLs(failedURLs) {
    if (failedURLs.length === 0) return

    const { storedData, storedFailedURLs } = await scrapeDataFromURLs(failedURLs)
    if (storedData.length > 0) {
        await validateAndSaveData(storedData)
    }

    if (storedFailedURLs.length > 0) {
        logger.warning('Algunas URLs fallaron incluso después de reintentar.', storedFailedURLs)
        return storedFailedURLs
    }
    return storedFailedURLs
}

async function analyzeDataAndTweet(today) {
    const variation = await recordVariation()
    if(variation) {
        await tweetDateVariation(today)
        await categoryIncreases(today)
        await categoryDecreases(today)
    }
}

// Configuración para iniciar el navegador y la página
async function startBrowser() {
    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Ayuda a evitar problemas de permisos
        })
        const page = await browser.newPage()
        await page.setViewport({ width: 1400, height: 4800 })
        logger.info('Navegador iniciado.')
        return { page, browser }
    } catch (error) {
        logger.error('Error initializing browser:', error)
        throw error
    }
}

// Función principal para iniciar el scraping
async function scrapeDataFromURLs(urls) {
    const startTime = new Date()
    let attempt = 0
    let storedfailedURLs = []
    let storedData = []

    const { page, browser } = await startBrowser()          //Starts browser

    while (attempt <= SCRAP_RETRY) {
        try {
            if (attempt > 0) { 
                logger.info(`Reintentando... (Intento ${attempt}/${SCRAP_RETRY})`) 
                delay(10000)
            }

            const { dataToSave, failedURLs } = await scrapeAllURLs(urls, page)
            if (dataToSave) {
                for (const data of dataToSave) {
                    storedData.push(data)
                }
            }
            storedfailedURLs.push(...failedURLs)

            if (failedURLs.length === 0) {
                logger.success('Proceso de scraping completado con éxito.')
                break
            } else {
                logger.warning(`${failedURLs.length} URLs no se pudieron scrapear.`)
                attempt++
            }
        } catch (error) {
            logger.fatal('Fatal error:', error)
            return false
        } finally {
            if (browser) {
                await browser.close()
            }
        }
    }

    const elapsedTimer = elapsedTime(startTime)
    logger.info(`Tiempo total: ${elapsedTimer}`)
    //console.log('return storedData: ', storedData)
    return { storedData, storedfailedURLs }
}

// Función principal de scraping
async function scrapeAllURLs(urls, page) {
    let failedURLs = []
    let dataToSave = []

    logger.info('Iniciando proceso...')
    for (const url of urls) {
        let retryCount = 0

        while (retryCount < MAX_SCRAPING_RETRIES) {
            try {
                const data = await scrapeURL(url, page)
                dataToSave.push(data)
                logger.info(`${dataToSave.length}/${urls.length} URLs scraped.`)
                break
            } catch (error) {
                retryCount++
                logger.warning(`Error al extraer datos de ${url}. Intentando nuevamente (${retryCount}/${MAX_SCRAPING_RETRIES})...`, error)
                await delay(3000)
            }
        }
        if (retryCount === MAX_SCRAPING_RETRIES) failedURLs.push(url)
    }
    return { dataToSave, failedURLs }
}

// Receives a url and it creates a .json with  the data scraped from that page 
async function scrapeURL(dinamicUrl, page) {
    //Set website parameters
    const startTime = new Date()
    await page.goto(dinamicUrl, { waitUntil: 'domcontentloaded' })

    let dataScrapped = []
    let previousProductCount = 0
    let pageNumber = 1
    let totalPages = 1
    let containerSelector = '.vtex-search-result-3-x-gallery'

    await delay(1000)
    while (pageNumber <= totalPages && pageNumber <= MAX_SCRAPING_PAGES) {
        let currentProducts = await scrapeProduct(page, containerSelector)
        if (!currentProducts || currentProducts.length === previousProductCount && pageNumber === totalPages) {                 //hace falta? o mejor borrar?
            throw new Error("No se encontraron nuevos productos o se alcanzó el final de la página. Deteniendo la extracción.")
        }

        currentProducts.forEach(product => {
            if (!dataScrapped.some(existingProduct => existingProduct.nombre === product.nombre)) {
                dataScrapped.push(product)
            }
        })
        previousProductCount = currentProducts.length

        // Scroll down
        await scrollDown(page)
        currentProducts = await scrapeProduct(page, containerSelector)

        //Next page
        if(currentProducts.length === previousProductCount) {
            totalPages = await getTotalPages(page)
            logger.debug(`Current page: ${pageNumber}/${totalPages}`)
            pageNumber++
            await goToPage(page, pageNumber, dinamicUrl)
            await delay(1000)
        }
    }
    const formattedTime = elapsedTime(startTime)
    const currentDate = new Date(new Date().getTime() - (3 * 60 * 60 * 1000)).toISOString()         //Hora Argentina GTM-3  reemplazar por TODAY

    //Data extraida
    const urlData = {
        category: getCategoryNameFromUrl(dinamicUrl),
        date: currentDate,
        totalProducts: dataScrapped.length,
        time_spent: formattedTime,
        url: dinamicUrl,
        data: dataScrapped
    }
    logger.info(`Se tardo ${formattedTime} en scrappear ${dinamicUrl}`)
    return urlData
    //await saveDataToMongo(dataToSave)                                                                                                                     SAVEDATATOMONGO
    
}

//Receives the page & container selector (unique to the website may change values)  and returns an array of products
async function scrapeProduct(page, containerSelector) {
    await new Promise(resolve => setTimeout(resolve, 1500))             //TIMEOUTE 1500 OR ERRORS

    const containerExists = await page.$(containerSelector)
    if (!containerExists) throw new Error('El contenedor principal no se encontró en la página.')                           //se puede mejorar ?

    const articlesData = await page.evaluate(async (containerSelector) => {
        const container = document.querySelector(containerSelector)
        if (!container) return null

        const productsData = []
        const productNodes = container.children
        for (const product of productNodes) {
            const nombreElement = product.querySelector('.vtex-product-summary-2-x-productNameContainer')
            const marcaElement = product.querySelector('.vtex-product-summary-2-x-productBrandName')
            await new Promise(resolve => setTimeout(resolve, 10))       //ASSURES THE PRICE LOADS CORRECTLY
            const precioElement = product.querySelector('.jumboargentinaio-store-theme-1dCOMij_MzTzZOCohX1K7w')
            const precioRegularElement = product.querySelector('.jumboargentinaio-store-theme-1QiyQadHj-1_x9js9EXUYK')

            // Verificar que todos los elementos necesarios estén presentes
            if (nombreElement && marcaElement && precioElement && precioRegularElement) {
                const nombre = nombreElement.textContent.trim()
                const marca = marcaElement.textContent.trim()
                let precio = precioElement.textContent.trim()
                const precioRegular = precioRegularElement.textContent.trim()

                //Cleans price string
                let number = precio.replace(/\$/g, '')
                number = number.replace(/\./g, '')
                number = number.replace(/,/g, '.')
                precio = Number(number)

                productsData.push({
                    nombre,
                    marca,
                    precio,
                    precioRegular
                })
            }
        }
        return productsData
    }, containerSelector)
    return articlesData
}

async function scrollDown(page) {
    try {
        const initialHeight = await page.evaluate(() => document.body.scrollHeight)
        await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight)
        })
        await page.waitForFunction(`document.body.scrollHeight >= ${initialHeight}`, { timeout: 2500 })
        await delay(500)
        return true
    } catch (error) {
        logger.warning('Scroll error:', error)
        return false
    }
}

async function getTotalPages(page) {
    try {
        await page.waitForSelector('.discoargentina-search-result-custom-1-x-span-selector-pages')
        const pagesText = await page.$eval('.discoargentina-search-result-custom-1-x-span-selector-pages', el => el.textContent.trim())
        const wordsArray  = pagesText.split(" ")
        const totalPages = wordsArray[wordsArray.length - 1]
        return totalPages
    } catch (error) {
        logger.error('Error al obtener el número total de páginas: ', error)
        return 1
    }
}

//Delays the program for x time (ms)
function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    })
}

async function goToPage(page, pageNumber, dinamicUrl) { await page.goto(`${dinamicUrl}&page=${pageNumber}`) }

function formatTime(milliseconds) {
    const totalSeconds = milliseconds / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const millisecondsRemaining = milliseconds % 1000;
    return `${minutes} minutos, ${seconds} segundos y ${millisecondsRemaining} milisegundos`
}

//Agregar validacion si el archivo existe (evitar duplicados)
async function validateAndSaveData(storedData) {        
    for (const data of storedData) {
        if (!data.category || !Array.isArray(data.data)) {
            throw new Error('Datos no válidos para guardar en MongoDB')
        }

        try {
            await saveDataToMongo(data)
        } catch (err) {
            logger.error('Error al guardar datos en MongoDB:', err)
            throw err
        }
    }
}

//Receives data from scrapping and stores it in Mongo DB
async function saveDataToMongo(data) {
    try {
        const newRecord = await RecordManager.create(data)
        if (!newRecord._id) throw new Error("No se ha podido crear el registro en MongoDB")
        return newRecord
    } catch(err) {
        logger.error('Error al guardar datos en MongoDB', err)
    }
}

//Receives example: "$4,250.5" and return 4250.5 in Number format
function getCategoryNameFromUrl(url) {
    const startIndex = staticURL.length
    const endIndex = url.indexOf("?_q=")
    const categoryPart = url.substring(startIndex, endIndex)
    const categoryName = decodeURIComponent(categoryPart.replace(/%20/g, ' '))
    const categoryNameCapitalized = capitalizeFirstLetter(categoryName)
    return categoryNameCapitalized
}

//Just capitalizes First Letter
function capitalizeFirstLetter(string) {
    return string.replace(/^\w/, (c) => c.toUpperCase());
}

async function deleteTodayRecords() {
    await connectDB()
    logger.info('Deleting all records from today...')
    const deletes = await RecordManager.deleteRecordsOfToday()
    logger.info(deletes)
} 