import puppeteer from "puppeteer";
import { writeFile } from 'fs/promises';

const staticURL = 'https://www.jumbo.com.ar/almacen'

async function scrapeJumboProduct(page) {
    const productsContainerSelector = '.vtex-search-result-3-x-gallery';
    const productSelector = '.vtex-search-result-3-x-galleryItem';
    await page.waitForSelector(productSelector, productsContainerSelector);

    console.log('Scrapping...');
    const articlesData = await page.evaluate(async (productsContainerSelector, productSelector) => {
        const productsContainer = document.querySelector(productsContainerSelector);
        if (!productsContainer) return null; // No container found

        const productNodes = productsContainer.querySelectorAll(productSelector);
        if (!productNodes.length) return null; // No products found

        const productsData = [];

        for (const product of productNodes) {
            const nombre = product.querySelector('.vtex-product-summary-2-x-productNameContainer')?.textContent.trim();
            const marca = product.querySelector('.vtex-product-summary-2-x-productBrandName')?.textContent.trim();

            await new Promise(resolve => setTimeout(resolve, 10));
            const precio = product.querySelector('.jumboargentinaio-store-theme-1dCOMij_MzTzZOCohX1K7w')?.textContent.trim();
            const precioRegular = product.querySelector('.jumboargentinaio-store-theme-1QiyQadHj-1_x9js9EXUYK')?.textContent.trim();

            productsData.push({
                nombre,
                marca,
                precio,
                precioRegular
            });
        }

        return productsData;
    }, productsContainerSelector, productSelector);

    return articlesData;
}


async function scrollDown(page) {
    //console.log('Scrolling down...');
    try {
        const initialHeight = await page.evaluate(() => document.body.scrollHeight);
        await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight);
        });
        await page.waitForFunction(`document.body.scrollHeight > ${initialHeight}`, { timeout: 1000 });
        await delay(500);
        return true;
    } catch (error) {
        console.error('Error al hacer scroll:', error);
        return false;
    }
}

async function getTotalPages(page) {
    try {
        await page.waitForSelector('.discoargentina-search-result-custom-1-x-span-selector-pages');
        const pagesText = await page.$eval('.discoargentina-search-result-custom-1-x-span-selector-pages', el => el.textContent.trim());
        const wordsArray  = pagesText.split(" ");
        const totalPages = wordsArray[wordsArray.length - 1]
        return totalPages;
    } catch (error) {
        console.error('Error al obtener el número total de páginas: ', error);
        return 1;
    }
}


function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
}

async function goToPage(page, pageNumber) {
    const url = `${staticURL}?page=${pageNumber}`;
    await page.goto(url);
}

// MAIN FUNCTION
async function main() {
    const startTime = new Date()
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    // Establecer el tamaño de la pantalla
    await page.setViewport({ width: 1280, height: 1000 });
    await page.goto(staticURL);

    let dataScrapped = [];
    let previousProductCount = 0;
    let pageNumber = 1
    let totalPages = 1;
    
    while (pageNumber <= totalPages) {
        let currentProducts = await scrapeJumboProduct(page);

        if (!currentProducts || currentProducts.length === previousProductCount && pageNumber === totalPages) {
            console.log("No se encontraron nuevos productos o se alcanzó el final de la página. Deteniendo la extracción.");
            break;
        }

        currentProducts.forEach(product => {
            if (!dataScrapped.some(existingProduct => existingProduct.nombre === product.nombre)) {
                dataScrapped.push(product);
            }
        })

        previousProductCount = currentProducts.length;
        console.log(`${dataScrapped.length} productos extraídos...`);

        // Scroll down
        await scrollDown(page);

        currentProducts = await scrapeJumboProduct(page);
        //console.log('Current products:', currentProducts.length, 'Previous products:', previousProductCount);

        //Next page
        if(currentProducts.length === previousProductCount) {
            totalPages = await getTotalPages(page)
            console.log(`Current page: ${pageNumber}/${totalPages}`);
            pageNumber++;
            await goToPage(page, pageNumber);
            await delay(1000);
        }
    }
    await browser.close();

    //Tiempo de extraccion de recursos
    const endTime = new Date();
    const elapsedTime = endTime - startTime;
    const formattedTime = formatTime(elapsedTime);
    console.log(`Tiempo total empleado: ${formattedTime}`);

    //Data extraida
    console.log('Data scrapped:', dataScrapped);
    const dataToSave = {
        time_spent: formattedTime,
        date: new Date().toLocaleString(),
        url: staticURL,
        totalProducts: dataScrapped.length,
        data: dataScrapped
    }

    const formattedDate = new Date().toLocaleString().replace(/[^\w]/g, '_');
    const fileName = `jumboData_${formattedDate}.json`;
    saveDataToFile(dataToSave, fileName)
}

function formatTime(milliseconds) {
    const totalSeconds = milliseconds / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes} minutos y ${seconds} segundos`;
}

async function saveDataToFile(data, fileName) {
    try {
        await writeFile(fileName, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error al guardar los datos:', error);
    }
}

main();
