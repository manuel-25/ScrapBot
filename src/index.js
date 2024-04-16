import puppeteer from "puppeteer"
import { writeFile } from 'fs/promises'

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


main(jumboURLs)

//MAIN FUNCTION LOOP
async function main(urls) {
    const failedURLs = []
    let counter = 0

    console.log('Iniciando loop')
    for (const url of urls) {
        let retryCount = 0

        while (retryCount < 3) {
            try {
                await scrapeURL(url)
                counter++
                console.log(`${counter}/${urls.length} urls scrapped.`)
                break
            } catch (error) {
                console.error(`Error al extraer datos de ${url}. Intentando nuevamente...`)
                retryCount++
                await delay(1000)
            }
        }

        // Si se agotaron los intentos y la extracción sigue fallando, guardamos la URL
        if (retryCount === 3) {
            failedURLs.push(url)
        }
    }

    console.log(`Extracción de ${counter}/${urls.length} URLs completada.`)
    if (failedURLs.length > 0) {
        console.log("Las siguientes URLs no se pudieron extraer:", failedURLs)
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
        //console.log(`${dataScrapped.length} productos extraídos...`)

        // Scroll down
        await scrollDown(page)
        currentProducts = await scrapeProduct(page);

        //Next page
        if(currentProducts.length === previousProductCount) {
            totalPages = await getTotalPages(page)
            console.log(`Current page: ${pageNumber}/${totalPages}`)
            pageNumber++
            await goToPage(page, pageNumber, dinamicUrl)
            await delay(2000)
        }
    }
    await browser.close()

    //Tiempo de extraccion de recursos
    const endTime = new Date()
    const elapsedTime = endTime - startTime
    const formattedTime = formatTime(elapsedTime)
    console.log(`Tiempo total empleado: ${formattedTime}`)
    const currentDate = new Date(new Date().getTime() - (3 * 60 * 60 * 1000)).toISOString();

    //Data extraida
    //console.log('Data scrapped successfully')
    const dataToSave = {
        time_spent: formattedTime,
        date: currentDate ,
        url: dinamicUrl,
        totalProducts: dataScrapped.length,
        data: dataScrapped
    }

    const formattedDate = new Date().toLocaleString().replace(/[^\w]/g, '_')
    const fileName = `jumboData_${formattedDate}.json`
    saveDataToFile(dataToSave, fileName)
}

async function scrapeProduct(page) {
    await new Promise(resolve => setTimeout(resolve, 1000))

    const containerSelector = '.vtex-search-result-3-x-gallery'
    const containerExists = await page.$(containerSelector)
    if (!containerExists) {
        console.log('El contenedor principal no se encontró en la página.')
        return null
    }

    //console.log('Scrapping...')
    const articlesData = await page.evaluate(async (containerSelector) => {
        const container = document.querySelector(containerSelector)
        if (!container) return null // No container found

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
                const precio = precioElement.textContent.trim()
                const precioRegular = precioRegularElement.textContent.trim()

                productsData.push({
                    nombre,
                    marca,
                    precio,
                    precioRegular
                });
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
        console.error('Error al hacer scroll:', error)
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
        console.error('Error al obtener el número total de páginas: ', error)
        return 1
    }
}


function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    })
}

async function goToPage(page, pageNumber, dinamicUrl) {
    const newUrl = `${dinamicUrl}&page=${pageNumber}`
    await page.goto(newUrl)
}

//Data  to JSON
function formatTime(milliseconds) {
    const totalSeconds = milliseconds / 1000;
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = Math.floor(totalSeconds % 60)
    return `${minutes} minutos y ${seconds} segundos`
}

//Store json file
async function saveDataToFile(data, fileName) {
    try {
        await writeFile(`../data/${fileName}`, JSON.stringify(data, null, 2))
    } catch (error) {
        console.error('Error al guardar los datos:', error)
    }
}
