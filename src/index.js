import puppeteer from "puppeteer"
import connectDB from './config/mongoose-config.js'
import RecordManager from "./Mongo/recordManager.js"
import logger from "./config/winston.js"
import cron from  "node-cron"
import { jumboURLs } from "./config/utils.js"
import { recordVariation, tweetDateVariation, categoryIncreases, categoryDecreases } from "./services/price_tracker.js"

//CANASTA BASICA https://chequeado.com/el-explicador/que-es-la-canasta-basica-alimentaria-del-indec-y-como-se-compone/
const MAX_BOT_RETRIES = 3
const MAX_SCRAPING_PAGES = 10
const MAX_SCRAPING_RETRIES = 6
const CONTAINER_RETRY = 4

function elapsedTime(startTime) {
    const endTime = new Date()
    const elapsedTime = endTime - startTime
    return formatTime(elapsedTime)
}

//Code Starts here! 
/*cron.schedule('51 19 * * *', () => {
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
        await analyzeDataAndTweet(getDate())
        return
      }
    } catch (err) {
      logger.error("runFullTask error:", err)
    }
}

//runFullTask()
runScrapingBot()

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
        let { storedData, storedfailedURLs } = await scrapeDataFromURLs(jumboURLs, page)

        // Guardar los datos que se han scrapeado
        if (storedData && storedData.length > 0) {
            const result = await validateAndSaveData(storedData)
            if(!result) return logger.warning("Los datos no se pudieron almacenar correctamente.")
            logger.info(`Datos almacenados exitosamente (${storedData.length} registros).`)
        } else {
            logger.error("No se encontraron datos para almacenar.")
        }

        // Manejo de URLs fallidas
        if (!storedfailedURLs || storedfailedURLs.length === 0) {
            logger.info("No hubo URLs fallidas durante el scraping.")
            browser.close()
            return true
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
        logger.error("Error general en runScrapingBot:", err)
        return false
    }
}

async function retryFailedURLs(failedURLs, page) {
    if (!failedURLs || failedURLs.length === 0) return

    const returnedData = await scrapeDataFromURLs(failedURLs, page)
    const { storedData, storedfailedURLs } = returnedData
    if (storedData) { await validateAndSaveData(storedData) }

    if (storedfailedURLs.length > 0) {
        logger.warning('Algunas URLs fallaron incluso después de reintentar.', storedfailedURLs)
        return storedfailedURLs
    }
    return storedfailedURLs
}

async function analyzeDataAndTweet(date) {
    try {
        const variation = await recordVariation(date)
        if(!variation)  {
            logger.error('No se pudo obtener la variación de la fecha: ', date)
            return
        }

        const tweetVariation = await tweetDateVariation(date)
        if(!tweetVariation) return

        const tweetcategoryIncreases = await categoryIncreases(date)
        const tweetcategoryDecreases = await categoryDecreases(date)

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
        } else {
            throw new Error('scrapeAllURLs returned no dataToSave -- aborting')
        }
        storedfailedURLs.push(...failedURLs)
    
        const elapsedTimer = elapsedTime(startTime)
        logger.info(`Tiempo total: ${elapsedTimer}`)
        return { storedData, storedfailedURLs }
    } catch(err) {
        logger.error('scrapeDataFromURLs error', err)
    }
}

async function scrapeAllURLs(urls, page) {
    let failedURLs = []
    let dataToSave = []

    for (const url of urls) {
        let retryCount = 0
        let successUrl = false
        let startPage = 1
        let dataFromUrl = []

        const startTime = new Date()
        while (retryCount < MAX_SCRAPING_RETRIES && !successUrl) {
            try {
                const scrapeResult = await scrapeURL(url, page, startPage)

                if (scrapeResult.success) {
                    const newData = scrapeResult.data
                    dataFromUrl = avoidDuplicateData(newData, dataFromUrl)
                    successUrl = true
                    logger.info(`${dataToSave.length + 1}/${urls.length} URLs scraped.`)
                    break
                }

                if(!scrapeResult.success && scrapeResult.data > 0) {
                    const newData = scrapeResult.data
                    dataFromUrl = avoidDuplicateData(newData, dataFromUrl)
                    startPage = scrapeResult.page
                } else {
                    throw new Error('No se pudieron obtener datos válidos.')
                }

            } catch (error) {
                retryCount++
                logger.warning(`Error al extraer datos de ${url}. Intentando nuevamente (${retryCount}/${MAX_SCRAPING_RETRIES})...`, error )
                await delay(6000)
            }
        }

        if (!successUrl) {
            logger.error(`Falló el scraping para la URL: ${url} después de ${MAX_SCRAPING_RETRIES} reintentos.`)
            failedURLs.push(url)
        } else {
            const formattedTime = elapsedTime(startTime)
            const currentDate = getDate()
        
            const urlData = {
                category: getCategoryNameFromUrl(url),
                date: currentDate,
                totalProducts: dataFromUrl.length,
                time_spent: formattedTime,
                url,
                data: dataFromUrl,
            }
            dataToSave.push(urlData)
            logger.info(`Se tardó ${formattedTime} en scrapear ${url}`)
        }
    }
    return { dataToSave, failedURLs }
}

// Receives a URL tu search through pages and return the scrapped data.
async function scrapeURL(dinamicUrl, page, startPage) {
    try {
        await delay(1000) // Pequeña espera antes de comenzar evita errores

        //const startTime = new Date()
        await page.goto(`${dinamicUrl}&page=${startPage}`, { waitUntil: 'domcontentloaded', timeout: 40000 })

        let dataScrapped = []
        let previousProductCount = 0
        let pageNumber = startPage
        console.log('pageNumber:', pageNumber)
        let totalPages = 1
        const containerSelector = '.vtex-search-result-3-x-gallery'
        let containerFound = false

        while (pageNumber <= totalPages && pageNumber <= MAX_SCRAPING_PAGES) {
            // Reintentos para encontrar el contenedor de productos
            let containerRetries = 0
            while (containerRetries < CONTAINER_RETRY && !containerFound) {
                try {
                    await page.waitForSelector(containerSelector, { timeout: 20000 })
                    containerFound = true
                } catch (error) {
                    logger.warning(`El contenedor no se encontró en ${dinamicUrl}. Reintentando...`)
                    await page.reload({ waitUntil: 'networkidle0', timeout: 40000 })
                    containerRetries++
                }
            }
            //Si no hay contenedor de productos => return
            if (!containerFound) {
                logger.error(`No se encontró el contenedor para ${dinamicUrl} después de varios intentos.`)
                return { success: false, page: pageNumber, data: dataScrapped }
            }

            // Desplazarse hacia abajo para obtener más productos
            await scrollDown(page)
            await delay(1000)

            const currentProducts = await scrapeProduct(page, containerSelector)

            if (!currentProducts || currentProducts.length === 0) {
                logger.warning(`No se encontraron productos en la página ${pageNumber} para ${dinamicUrl}.`)
                return { success: false, page: pageNumber, data: dataScrapped }
            }

            currentProducts.forEach((product) => {
                if ( !dataScrapped.some((existingProduct) => existingProduct.nombre === product.nombre) ) {
                    dataScrapped.push(product)
                }
            })

            previousProductCount = currentProducts.length
            // Ir a la siguiente pagina si hay mas paginas.
            if (currentProducts.length === previousProductCount) {
                totalPages = await getTotalPages(page)
                logger.info(`Página actual: ${pageNumber}/${totalPages}`)
                if (pageNumber < totalPages) {
                    pageNumber++
                    await goToPage(page, pageNumber, dinamicUrl)
                }
            }
        }
        return { success: true, data: dataScrapped }

    } catch (err) {
        logger.error(`Error al scrapear la URL ${dinamicUrl}:`, err)
        return { success: false, page: pageNumber }
    }
}

/* async function scrapeAllURLs(urls, page) {
    let failedURLs = []
    let dataToSave = []
    let scrapeResult = { success: false, page: 1 }

    for (const url of urls) {
        let retryCount = 0
        let success = false
        let startPage = 1

        while (retryCount < MAX_SCRAPING_RETRIES && !success) {
            try {
                scrapeResult = await scrapeURL(url, page, startPage)
                console.log('scrapeResult:', scrapeResult)

                // Si es exitoso y tiene datos
                if (scrapeResult.success && scrapeResult.data.length > 0) {
                    const newData = scrapeResult.data.data

                    // Evitar duplicados comparando por clave única (nombre o ID)
                    const uniqueData = newData.filter((item) => {
                        return !dataToSave.some((existingItem) => {
                            return existingItem.data.some((d) => d.nombre === item.nombre)
                        })
                    })

                    // Si hay datos únicos, agregarlos
                    if (uniqueData.length > 0) {
                        dataToSave.push({
                            ...scrapeResult.data,
                            data: uniqueData
                        })
                    }

                    logger.info(`${dataToSave.length}/${urls.length} URLs scraped.`)
                    success = true
                } else {
                    if (scrapeResult.data.length > 0) {
                        const newData = scrapeResult.data.data

                        dataToSave.push({
                            ...scrapeResult.data,
                            data: newData,
                        })
                        startPage = scrapeResult.page
                    } else {
                        throw new Error("No se pudieron obtener datos válidos.")
                    }
                }

            } catch (error) {
                retryCount++
                startPage = scrapeResult.page || 1 // Continuar desde la última página conocida

                logger.warning(`Error al extraer datos de ${url}. Intentando nuevamente (${retryCount}/${MAX_SCRAPING_RETRIES})...`, error)
                await delay(6000) // Esperar entre reintentos
            }
        }

        if (!success) {
            logger.error(`Falló el scraping para la URL: ${url} después de ${MAX_SCRAPING_RETRIES} reintentos.`)
            failedURLs.push(url) // Agregar a la lista de URLs fallidas
        }
    }

    return { dataToSave, failedURLs }
}

// Receives a url and it creates a .json with  the data scraped from that page 
async function scrapeURL(dinamicUrl, page, startPage) {
    try {
        await delay(1000) // Pequeña espera antes de comenzar

        const startTime = new Date()
        console.log('startPage', startPage)
        await page.goto(`${dinamicUrl}&page=${startPage}`, { waitUntil: 'domcontentloaded', timeout: 25000 })

        let dataScrapped = []
        let previousProductCount = 0
        let pageNumber = startPage
        let totalPages = 1
        const containerSelector = '.vtex-search-result-3-x-gallery'
        let containerFound = false

        while (pageNumber <= totalPages && pageNumber <= MAX_SCRAPING_PAGES) {
            // Reintentos para encontrar el contenedor
            let containerRetries = 0
            while (containerRetries < 3 && !containerFound) {
                try {
                    await page.waitForSelector(containerSelector, { timeout: 20000 })
                    containerFound = true
                } catch (error) {
                    logger.warning(`El contenedor no se encontró en ${dinamicUrl}. Reintentando...`)
                    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 })
                    containerRetries++
                }
            }

            if (!containerFound) {
                logger.error(`No se encontró el contenedor para ${dinamicUrl} después de varios intentos.`)
                return { success: false, page: pageNumber, data: urlData }
            }

            const currentProducts = await scrapeProduct(page, containerSelector)

            if (!currentProducts) {
                logger.warning(`No se encontraron productos en la página ${pageNumber} para ${dinamicUrl}.`)
                return { success: false, page: pageNumber, data: urlData }
            }

            currentProducts.forEach((product) => {
                if (
                    !dataScrapped.some((existingProduct) => existingProduct.nombre === product.nombre)
                ) {
                    dataScrapped.push(product)
                }
            })

            previousProductCount = currentProducts.length

            // Desplazarse hacia abajo para obtener más productos
            await scrollDown(page)
            await delay(1000)

            // Ir a la siguiente página si hay más productos
            if (currentProducts.length === previousProductCount) {
                totalPages = await getTotalPages(page)
                logger.info(`Página actual: ${pageNumber}/${totalPages}`)
                pageNumber++
                await goToPage(page, pageNumber, dinamicUrl)
            }
        }

        const formattedTime = elapsedTime(startTime)
        const currentDate = new Date(new Date().getTime() - (3 * 60 * 60 * 1000)).toISOString() // Hora Argentina GTM-3
    
        const urlData = {
            category: getCategoryNameFromUrl(dinamicUrl),
            date: currentDate,
            totalProducts: dataScrapped.length,
            time_spent: formattedTime,
            url: dinamicUrl,
            data: dataScrapped,
        }

        logger.info(`Se tardó ${formattedTime} en scrapear ${dinamicUrl}`)
        return { success: true, data: urlData }

    } catch (err) {
        logger.error(`Error al scrapear la URL ${dinamicUrl}:`, err)
        return { success: false, page: pageNumber, data: urlData }
    }
} */

//Receives the page & container selector (unique to the website may change values)  and returns an array of products
async function scrapeProduct(page, containerSelector) {
    try {
        await new Promise(resolve => setTimeout(resolve, 2000))             //TIMEOUTE 1500 OR ERROR

        const articlesData = await page.evaluate(async (containerSelector) => {
            const container = document.querySelector(containerSelector)
            if (!container) {
                console.log("El contenedor principal no se encontró en la página.")
                return null
            }
    
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
    } catch(err) {
        logger.error("scrapeProduct error:", err)
        return null
    }
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

//async function goToPage(page, pageNumber, dinamicUrl) { await page.goto(`${dinamicUrl}&page=${pageNumber}`) }

async function goToPage(page, pageNumber, dinamicUrl) {
    try {
        await page.goto(`${dinamicUrl}&page=${pageNumber}`, { waitUntil: 'networkidle0', timeout: 25000 })
    } catch (error) {
        logger.error(`Error al cambiar a la página ${pageNumber} de ${dinamicUrl}:`, error)
    }
}

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

function getDate() {
    return new Date(new Date().getTime() - (3 * 60 * 60 * 1000))
}

// Filtrar datos para evitar duplicados
function avoidDuplicateData(newData, dataFromUrl) {
    const uniqueData = newData.filter((item) => {
        return !dataFromUrl.some((existingItem) => existingItem.nombre === item.nombre) 
    })

    uniqueData.forEach((item) => {
        dataFromUrl.push(item)
    })

    return dataFromUrl
}