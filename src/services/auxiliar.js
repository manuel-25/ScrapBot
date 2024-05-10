function compareCategoryPrices(currentData, historicMap, date) {
    const comparedResults = {
        date: date,
        totalPriceDifference: 0,
        totalPercentDifference: 0,
        totalWeightedPercent: 0,
        totalProducts: 0,
        results: []
    };

    let totalHistoricPrice = 0;
    let totalCurrentPrice = 0;
    let totalProducts = 0;

    currentData.forEach((category) => {
        const categoryResults = {
            category: category.category,
            categoryPriceDifference: 0,
            categoryPercentDifference: 0,
            categoryWeightedPercent: 0,
            products: 0,
            data: []
        };

        let categoryHistoricPrice = 0;
        let categoryCurrentPrice = 0;

        category.data.forEach((product) => {
            const productName = product.nombre;
            const currentPrice = product.precio;

            const historicProduct = historicMap[productName];
            if (historicProduct) {
                const historicPrice = historicProduct.precio;
                const priceDifference = parseFloat((currentPrice - historicPrice).toFixed(3));
                const percentDifference = parseFloat(((priceDifference / historicPrice) * 100).toFixed(3));

                categoryResults.data.push({
                    productName,
                    currentPrice,
                    historicPrice,
                    priceDifference,
                    percentDifference
                });

                // **Agregar dos decimales**
                categoryResults.categoryPriceDifference += priceDifference;
                categoryResults.categoryPriceDifference = parseFloat((categoryResults.categoryPriceDifference).toFixed(2)); // Dos decimales
                categoryResults.products++; 

                categoryHistoricPrice += historicPrice;
                categoryCurrentPrice += currentPrice;
                totalHistoricPrice += historicPrice;
                totalCurrentPrice += currentPrice;
                totalProducts++;
            }
        });

        if (categoryHistoricPrice > 0) {
            categoryResults.categoryPercentDifference = parseFloat(((categoryCurrentPrice - categoryHistoricPrice) / categoryHistoricPrice * 100).toFixed(2)); // Dos decimales
        }

        const weightRelative = categoryWeight[category.category] / weightTotal;
        categoryResults.categoryWeightedPercent = parseFloat((categoryResults.categoryPercentDifference * weightRelative).toFixed(2)); // Dos decimales

        comparedResults.totalWeightedPercent += parseFloat((categoryResults.categoryWeightedPercent).toFixed(2)); // Dos decimales

        comparedResults.results.push(categoryResults);
    });

    if (totalHistoricPrice > 0) {
        comparedResults.totalProducts = totalProducts;
        comparedResults.totalPriceDifference = parseFloat((totalCurrentPrice - totalHistoricPrice).toFixed(2)); // Dos decimales
        comparedResults.totalPercentDifference = parseFloat(((comparedResults.totalPriceDifference / totalHistoricPrice) * 100).toFixed(2)); // Dos decimales
    }

    return comparedResults;
}
