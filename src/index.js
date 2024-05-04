import puppeteer from "puppeteer"
import connectDB from './config/mongoose-config.js'
import RecordManager from "./Mongo/recordManager.js"
import logger from "./config/winston.js"
import cron from  "node-cron"
import { jumboURLs, staticURL } from "./config/utils.js"
import { recordVariation, tweetDateVariation, categoryIncreases, categoryDecreases } from "./services/price_tracker.js"
const today = new Date(new Date().getTime() - (3 * 60 * 60 * 1000))

//CANASTA BASICA https://chequeado.com/el-explicador/que-es-la-canasta-basica-alimentaria-del-indec-y-como-se-compone/
const MAX_BOT_RETRIES = 3
const MAX_SCRAPING_PAGES = 20
const MAX_SCRAPING_RETRIES = 6
const SCRAP_RETRY = 3

function elapsedTime(startTime) {
    const endTime = new Date()
    const elapsedTime = endTime - startTime
    return formatTime(elapsedTime)
}

//Code Starts here! 
/*cron.schedule('04 18 * * *', () => {
    logger.info(`Scrapbot se ejecuto a: ${new Date()}`)
    runFullTask()
})*/

const runFullTask = async () => {
    try {
      logger.info("Iniciando el proceso de scraping.")
      const scrap = await runScrapingBot()
      await delay(10000)
      if(scrap) {
        logger.info("Iniciando proceso de analisis.")
        await analyzeDataAndTweet(today)
        return
      }
    } catch (err) {
      logger.error("runFullTask error:", err)
    }
}

async function runScrapingBot() {
    try {
        // Conexión a la base de datos y al navegador
        await connectDB()
        const { page, browser } = await startBrowser()
        if (!page || !browser) {
            throw new Error("El navegador no se inició correctamente.")
        }

        // Scraping inicial
        logger.info(`Iniciando scraping de ${jumboURLs.length} URLs.`)
        const { storedData, storedfailedURLs } = await scrapeDataFromURLs(jumboURLs, page)

        // Guardar los datos que se han scrapeado
        if (storedData && storedData.length > 0) {
            const result = await validateAndSaveData(storedData)
            if(!result) return logger.warning("Los datos no se pudieron almacenar correctamente.")
            logger.info(`Datos almacenados exitosamente (${storedData.length} registros).`)
        } else {
            logger.warning("No se encontraron datos para almacenar.")
        }

        // Manejo de URLs fallidas
        if (!storedfailedURLs || storedfailedURLs.length === 0) {
            logger.info("No hubo URLs fallidas durante el scraping.")
            browser.close()
            return true // Todo fue exitoso
        }

        // Si hay URLs fallidas, reintentarlo
        let attempt = 0
        while (storedfailedURLs.length > 0 && attempt < MAX_BOT_RETRIES) {
            attempt++
            logger.info(`Reintentando URLs fallidas. Intento: ${attempt}/${MAX_BOT_RETRIES}.`)

            const failed = await retryFailedURLs(storedfailedURLs, page)
            storedfailedURLs = failed

            if (storedfailedURLs.length === 0) {
                logger.info("Todas las URLs fueron scrapeadas con éxito después de reintentar.")
                break
            }

            logger.warning(`Quedan ${storedfailedURLs.length} URLs fallidas después del intento ${attempt}.`)
        }

        // Si se alcanzó el límite de reintentos y todavía hay URLs fallidas
        if (attempt >= MAX_BOT_RETRIES && storedfailedURLs.length > 0) {
            logger.error("No se pudieron scrappear las siguientes URLs después de varios intentos:", storedfailedURLs.join(", "))
            browser.close()
            return false // No se puede continuar
        }

        browser.close()
        return true // Todo salió bien y se puede continuar
    } catch (err) {
        logger.error("Error general en runScrapingBot:", err.message)
        return false
    }
}



async function retryFailedURLs(failedURLs, page) {
    if (!failedURLs || failedURLs.length === 0) return

    const returnedData = await scrapeDataFromURLs(failedURLs, page)
    const { storedData, storedfailedURLs } = returnedData
    if (storedData) { await validateAndSaveData(storedData) }

    console.log('failed', storedfailedURLs)
    if (storedfailedURLs.length > 0) {
        logger.warning('Algunas URLs fallaron incluso después de reintentar.', storedfailedURLs)
        return storedfailedURLs
    }
    return storedfailedURLs
}

async function analyzeDataAndTweet(today) {
    try {
        const variation = await recordVariation()
        if(!variation)  {
            logger.error('No se pudo obtener la variación de la fecha: ', today)
            return
        }

        const tweetVariation = await tweetDateVariation(today)
        if(!tweetVariation) return

        const tweetcategoryIncreases = await categoryIncreases(today)
        const tweetcategoryDecreases = await categoryDecreases(today)

        if(!tweetVariation) logger.error('No se ah tuiteado la variation')
        if(!tweetcategoryIncreases) logger.error('No se ah tuiteado la categoryIncrease')
        if(!tweetcategoryDecreases) logger.error('No se ah tuiteado la categoryDecrease')

        if(tweetVariation && tweetcategoryIncreases && tweetcategoryDecreases) {
            logger.success('Todos los tweets publicados con éxito.')
        }
        return false
    } catch (err) {
        logger.error("analyzeDataAndTweet error:", err)
    }
}

runFullTask()

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
async function scrapeDataFromURLs(urls, page) {
    try {
        const startTime = new Date()
        let storedfailedURLs = []
        let storedData = []
    
        const { dataToSave, failedURLs } = await scrapeAllURLs(urls, page)
        if (dataToSave) {
            for (const data of dataToSave) {
                storedData.push(data)
            }
        }
        storedfailedURLs.push(...failedURLs)
    
        const elapsedTimer = elapsedTime(startTime)
        logger.info(`Tiempo total: ${elapsedTimer}`)
        return { storedData, storedfailedURLs }
    } catch(err) {
        logger.error('scrapeDataFromURLs error', err)
    }
}

// Función principal de scraping
async function scrapeAllURLs(urls, page) {
    let failedURLs = []
    let dataToSave = []

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
                await delay(6000)
            }
        }
        if (retryCount === MAX_SCRAPING_RETRIES) failedURLs.push(url)
    }
    return { dataToSave, failedURLs }
}

// Receives a url and it creates a .json with  the data scraped from that page 
async function scrapeURL(dinamicUrl, page) {
    await delay(1000)
    //Set website parameters
    const startTime = new Date()
    await page.goto(dinamicUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })

    let dataScrapped = []
    let previousProductCount = 0
    let pageNumber = 1
    let totalPages = 1
    let containerSelector = '.vtex-search-result-3-x-gallery'

    await delay(1000)
    while (pageNumber <= totalPages && pageNumber <= MAX_SCRAPING_PAGES) {
        let currentProducts = await scrapeProduct(page, containerSelector)
        if (!currentProducts || currentProducts.length === previousProductCount && pageNumber === totalPages) {                 //hace falta
            logger.warning("No se encontraron nuevos productos o se alcanzó el final de la página.")
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
}

//Receives the page & container selector (unique to the website may change values)  and returns an array of products
async function scrapeProduct(page, containerSelector) {
    await new Promise(resolve => setTimeout(resolve, 2000))             //TIMEOUTE 1500 OR ERRORS

    const containerExists = await page.$(containerSelector)
    if (!containerExists) logger.warning('El contenedor principal no se encontró en la página.')

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
        logger.warning('Scroll error', error.message)
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
    const totalSeconds = milliseconds / 1000
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = Math.floor(totalSeconds % 60)
    const millisecondsRemaining = milliseconds % 1000
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
    return true
}

//Receives data from scrapping and stores it in Mongo DB
async function saveDataToMongo(data) {
    try {
      const existingRecord = await RecordManager.getRecordByCategoryAndDate(
        data.category,
        data.date
      )
  
      if (existingRecord) {
        logger.warning(`El registro ya existe para la categoría "${data.category}" y la fecha "${data.date}".`)
        return existingRecord
      }
  
      const newRecord = await RecordManager.create(data)
      if (!newRecord._id) {
        logger.warning('No se ha podido crear el registro en MongoDB', data)
      }
  
      return newRecord
    } catch (err) {
      logger.error('Error al guardar datos en MongoDB:', err)
      throw err
    }
}

function getCategoryNameFromUrl(url) {
    // Extraer la parte del dominio en adelante
    const startIndex = url.indexOf("/", url.indexOf("//") + 2)
    const urlSegment = url.substring(startIndex + 1)

    // Dividir por '/' y obtener el último segmento
    const segments = urlSegment.split("/")
    let lastSegment = segments.pop()

    // Limpiar cualquier parte después de caracteres especiales como '?' o '&'
    if (lastSegment.includes("&")) {
        lastSegment = lastSegment.split("&")[0]
    }
    if (lastSegment.includes("?")) {
        lastSegment = lastSegment.split("?")[0]
    }

    // Reemplazar '%20' por espacios y '-' por espacios
    lastSegment = lastSegment.replace(/%20/g, " ").replace(/-/g, " ")

    // Capitalizar la primera letra de cada palabra
    const categoryNameCapitalized = lastSegment
        .split(" ")
        .map(word => capitalizeFirstLetter(word))
        .join(" ")

    console.log(categoryNameCapitalized)
    return categoryNameCapitalized
}

// Función para capitalizar la primera letra de cada palabra
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1)
}


async function deleteTodayRecords() {
    await connectDB()
    logger.info('Deleting all records from today...')
    const deletes = await RecordManager.deleteRecordsOfToday()
    logger.info(deletes)
} 