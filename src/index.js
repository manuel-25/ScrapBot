import puppeteer from "puppeteer"
import { writeFile } from 'fs/promises'
import connectDB from './config/mongoose-config.js'
import RecordManager from "./Mongo/recordManager.js"
import logger from "./config/winston.js"

const staticURL = 'https://www.jumbo.com.ar/'
//CANASTA BASICA https://chequeado.com/el-explicador/que-es-la-canasta-basica-alimentaria-del-indec-y-como-se-compone/
const jumboURLs = ['https://www.jumbo.com.ar/pan?_q=pan&map=ft', 'https://www.jumbo.com.ar/galletitas%20de%20agua?_q=galletitas%20de%20agua&map=ft',
 'https://www.jumbo.com.ar/galletitas%20dulces?_q=galletitas%20dulces&map=ft', 'https://www.jumbo.com.ar/arroz?_q=arroz&map=ft',
 'https://www.jumbo.com.ar/harinas?_q=harinas&map=ft', 'https://www.jumbo.com.ar/fideos?_q=fideos&map=ft', 'https://www.jumbo.com.ar/papa?_q=papa&map=ft',
 'https://www.jumbo.com.ar/batata?_q=batata&layout=grid&map=ft', 'https://www.jumbo.com.ar/azucar?_q=azucar&map=ft', 'https://www.jumbo.com.ar/dulce%20de%20leche?_q=dulce%20de%20leche&map=ft',
'https://www.jumbo.com.ar/legumbres%20secas?_q=legumbres%20secas&map=ft', 'https://www.jumbo.com.ar/hortalizas?_q=hortalizas&map=ft', 'https://www.jumbo.com.ar/frutas?_q=frutas&map=ft',
'https://www.jumbo.com.ar/carnes?_q=carnes&map=ft', 'https://www.jumbo.com.ar/fiambres?_q=fiambres&map=ft', 'https://www.jumbo.com.ar/huevos?_q=huevos&map=ft',
'https://www.jumbo.com.ar/leche?_q=leche&map=ft', 'https://www.jumbo.com.ar/yogur?_q=yogur&map=ft', 'https://www.jumbo.com.ar/manteca?_q=manteca&map=ft', 
'https://www.jumbo.com.ar/aceite?_q=aceite&map=ft', 'https://www.jumbo.com.ar/cerveza?_q=cerveza&map=ft', 'https://www.jumbo.com.ar/vino?_q=vino&map=ft',
'https://www.jumbo.com.ar/cafe?_q=cafe&map=ft', 'https://www.jumbo.com.ar/yerba?_q=yerba&map=ft']

const maxRetry = 6

 function elapsedTime(startTime) {
    const endTime = new Date()
    const elapsedTime = endTime - startTime
    return formatTime(elapsedTime)
}

//Code Starts here! 
try {
    const startTime = new Date()
    await connectDB()
    const failedFailedURLs = await main(jumboURLs)
    if(!failedFailedURLs) {
        logger.success('Finished scraping Jumbo successfully.')
    }
    const elapsedTimer = elapsedTime(startTime)
    logger.info(`Tiempo total del proceso fue ${elapsedTimer}`)
} catch(err) {
    logger.fatal('Exit due to fatal error: ', err)
}

//MAIN FUNCTION LOOP
async function main(urls) {
    let failedURLs = []
    let failedFailedURLs = [] 
    let counter = 1

    logger.info('Iniciando proceso...')
    for (const url of urls) {
        let retryCount = 0
        while (retryCount < maxRetry) {
            try {
                await scrapeURL(url)
                counter++
                logger.info(`${counter - 1}/${urls.length} Jumbo URLs scrapped.`)
                break
            } catch (error) {
                logger.warning(`Error al extraer datos de ${url}. Intentando nuevamente(${retryCount}/${maxRetry})...`, error)
                retryCount++
                await delay(1000)
            }
        }
        if (retryCount === maxRetry) failedURLs.push(url)
    }
    counter--
    logger.info(`Extracción de ${counter}/${urls.length} URLs completada.`)

    //Si quedaron URLS sin scrappear se volvera a intentar sino se retornan.
    if (failedURLs.length > 0) {
        logger.warning("Las siguientes URLs no se pudieron extraer:", failedURLs)
        logger.info('Reiniciando proceso para las URL fallidas...')
        for (const url of failedURLs) {
            let retryCount = 0
            while (retryCount < maxRetry) {
                try {
                    await scrapeURL(url)
                    counter++
                    logger.info(`${counter}/${urls.length} failed URLs scrapped.`)
                    break
                } catch (error) {
                    logger.error(`Error al extraer datos de ${url}. Intentando nuevamente...`, error)
                    retryCount++
                    await delay(1000)
                }
            }
            if (retryCount === maxRetry) failedFailedURLs.push(url)
        }
        if(failedFailedURLs > 0) logger.warning("No se lograron agregar las URLS a 'failedURLs': ", failedFailedURLs)
        return failedFailedURLs
    }
}


// Receives a url and it creates a .json with  the data scraped from that page 
async function scrapeURL(dinamicUrl) {
    //Set website parameters
    const startTime = new Date()
    const browser = await puppeteer.launch({ headless: true })
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 1000 })
    await page.goto(dinamicUrl)

    let dataScrapped = [];
    let previousProductCount = 0
    let pageNumber = 1
    let totalPages = 1

    while (pageNumber <= totalPages) {
        let currentProducts = await scrapeProduct(page)
        if (!currentProducts || currentProducts.length === previousProductCount && pageNumber === totalPages) {
            throw new Error("No se encontraron nuevos productos o se alcanzó el final de la página. Deteniendo la extracción.");
        }


        currentProducts.forEach(product => {
            if (!dataScrapped.some(existingProduct => existingProduct.nombre === product.nombre)) {
                dataScrapped.push(product)
            }
        })

        previousProductCount = currentProducts.length;

        // Scroll down
        await scrollDown(page)
        currentProducts = await scrapeProduct(page);

        //Next page
        if(currentProducts.length === previousProductCount) {
            totalPages = await getTotalPages(page)
            logger.debug(`Current page: ${pageNumber}/${totalPages}`)
            pageNumber++
            await goToPage(page, pageNumber, dinamicUrl)
            await delay(1500)
        }
    }
    await browser.close()

    const formattedTime = elapsedTime(startTime)
    const currentDate = new Date(new Date().getTime() - (3 * 60 * 60 * 1000)).toISOString()

    //Data extraida
    const dataToSave = {
        category: getCategoryNameFromUrl(dinamicUrl),
        date: currentDate,
        totalProducts: dataScrapped.length,
        time_spent: formattedTime,
        url: dinamicUrl,
        data: dataScrapped
    }

    await saveDataToMongo(dataToSave)
    logger.info(`Se tardo ${formattedTime} en scrappear ${dinamicUrl}`)
}

async function scrapeProduct(page) {
    await new Promise(resolve => setTimeout(resolve, 1500))

    const containerSelector = '.vtex-search-result-3-x-gallery'
    const containerExists = await page.$(containerSelector)
    if (!containerExists) throw new Error('El contenedor principal no se encontró en la página.')

    const articlesData = await page.evaluate(async (containerSelector) => {
        const container = document.querySelector(containerSelector)
        if (!container) return null // Se puede sacar?

        const productsData = []
        const productNodes = container.children;
        for (const product of productNodes) {
            const nombreElement = product.querySelector('.vtex-product-summary-2-x-productNameContainer')
            const marcaElement = product.querySelector('.vtex-product-summary-2-x-productBrandName')
            await new Promise(resolve => setTimeout(resolve, 10))
            const precioElement = product.querySelector('.jumboargentinaio-store-theme-1dCOMij_MzTzZOCohX1K7w')
            const precioRegularElement = product.querySelector('.jumboargentinaio-store-theme-1QiyQadHj-1_x9js9EXUYK')

            // Verificar que todos los elementos necesarios estén presentes
            if (nombreElement && marcaElement && precioElement && precioRegularElement) {
                const nombre = nombreElement.textContent.trim()
                const marca = marcaElement.textContent.trim()
                let precio = precioElement.textContent.trim()
                const precioRegular = precioRegularElement.textContent.trim()

                //String to number
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
        await page.waitForFunction(`document.body.scrollHeight > ${initialHeight}`, { timeout: 1000 })
        await delay(500)
        return true
    } catch (error) {
        logger.error('Error al hacer scroll:', error)
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

//Jumps to next page
async function goToPage(page, pageNumber, dinamicUrl) {
    const newUrl = `${dinamicUrl}&page=${pageNumber}`
    await page.goto(newUrl)
}

//Format Time
function formatTime(milliseconds) {
    const totalSeconds = milliseconds / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const millisecondsRemaining = milliseconds % 1000;
    return `${minutes} minutos, ${seconds} segundos y ${millisecondsRemaining} milisegundos`
}

//Store json file DEPRECATED
async function saveDataToFile(data, fileName) {
    try {
        await writeFile(`../data/${fileName}`, JSON.stringify(data, null, 2))
    } catch (error) {
        logger.error('Error al guardar los datos:', error)
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

//Receives "$4,250.5 and return 4250.5 in Number format"
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