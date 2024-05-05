//SIGUIENTE MES AGREGAR: PESCADO, CARNE DE VACA Y CERDO. VERDURAS

export const jumboURLs = ['https://www.jumbo.com.ar/pan?_q=pan&map=ft', 'https://www.jumbo.com.ar/galletitas%20de%20agua?_q=galletitas%20de%20agua&map=ft',
 'https://www.jumbo.com.ar/galletitas%20dulces?_q=galletitas%20dulces&map=ft', 'https://www.jumbo.com.ar/arroz?_q=arroz&map=ft',
 'https://www.jumbo.com.ar/harinas?_q=harinas&map=ft', 'https://www.jumbo.com.ar/fideos?_q=fideos&map=ft', 'https://www.jumbo.com.ar/papa?_q=papa&map=ft',
 'https://www.jumbo.com.ar/batata?_q=batata&layout=grid&map=ft', 'https://www.jumbo.com.ar/azucar?_q=azucar&map=ft', 'https://www.jumbo.com.ar/dulce%20de%20leche?_q=dulce%20de%20leche&map=ft',
'https://www.jumbo.com.ar/legumbres%20secas?_q=legumbres%20secas&map=ft', 'https://www.jumbo.com.ar/verduras?_q=verduras&map=ft', 'https://www.jumbo.com.ar/frutas?_q=frutas&map=ft',
'https://www.jumbo.com.ar/carnes?initialMap=c&initialQuery=carnes&map=category-1,category-2&query=/carnes/carne-vacuna&searchState','https://www.jumbo.com.ar/carne%20cerdo?_q=carne%20cerdo&map=ft', 'https://www.jumbo.com.ar/pescado?_q=pescado&map=ft',
 'https://www.jumbo.com.ar/fiambres?_q=fiambres&map=ft', 'https://www.jumbo.com.ar/huevos?_q=huevos&map=ft', 'https://www.jumbo.com.ar/pollo?_q=pollo&map=ft',
'https://www.jumbo.com.ar/leche?_q=leche&map=ft', 'https://www.jumbo.com.ar/yogur?_q=yogur&map=ft', 'https://www.jumbo.com.ar/manteca?_q=manteca&map=ft', 
'https://www.jumbo.com.ar/aceite?_q=aceite&map=ft', 'https://www.jumbo.com.ar/cerveza?_q=cerveza&map=ft', 'https://www.jumbo.com.ar/vino?_q=vino&map=ft',
'https://www.jumbo.com.ar/cafe?_q=cafe&map=ft', 'https://www.jumbo.com.ar/yerba?_q=yerba&map=ft', 'https://www.jumbo.com.ar/te?_q=te&map=ft',
 'https://www.jumbo.com.ar/queso%20crema?_q=queso%20crema&map=ft']

export const staticURL = 'https://www.jumbo.com.ar/'

export const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

export const categoryEmoticons = [
    { category: 'Pan', emoji: '🍞' },
    { category: 'Galletitas De Agua', emoji: '🍪' },
    { category: 'Galletitas Dulces', emoji: '🍪' },
    { category: 'Arroz', emoji: '🍚' },
    { category: 'Harinas', emoji: '🌾' },
    { category: 'Fideos', emoji: '🍝' },
    { category: 'Papa', emoji: '🥔' },
    { category: 'Batata', emoji: '🍠' },
    { category: 'Azucar', emoji: '🍭' },
    { category: 'Dulce De Leche', emoji: '🍯' },
    { category: 'Verduras', emoji: '🥦' },
    { category: 'Frutas', emoji: '🍎' },
    { category: 'Carne Vacuna', emoji: '🥩' },
    { category: 'Carne Cerdo', emoji: '🐷' },
    { category: 'Pescado', emoji: '🐟' },
    { category: 'Fiambres', emoji: '🍖' },
    { category: 'Huevos', emoji: '🥚' },
    { category: 'Pollo', emoji: '🍗' },
    { category: 'Leche', emoji: '🥛' },
    { category: 'Legumbres Secas', emoji: '🌱' },
    { category: 'Yogur', emoji: '🍦' },
    { category: 'Manteca', emoji: '🧈' },
    { category: 'Aceite', emoji: '🛢️' },
    { category: 'Cerveza', emoji: '🍺' },
    { category: 'Vino', emoji: '🍷' },
    { category: 'Cafe', emoji: '☕' },
    { category: 'Yerba', emoji: '🍵' },
    { category: 'Te', emoji: '🍵' },
    { category: 'Queso Crema', emoji: '🧀' },
]

export function getEmojiForCategory(categoryName) {
    const category = categoryEmoticons.find(item => item.category === categoryName)
    return category ? category.emoji : ''
}

export const formatter = new Intl.NumberFormat('es-ES', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})

export function getDaysAndMonth(date, firstDateOfMonth) {
    const firstDay = firstDateOfMonth.getDate()
    const month = firstDateOfMonth.getMonth()
    const monthName = monthNames[month]
    const lastDay = date.getDate()
    return {firstDay, lastDay, monthName}
}