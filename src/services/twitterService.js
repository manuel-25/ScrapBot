import client from "../config/twitter.js";

const searchResults = await client.v2.search('nodejs') // Buscar tuits con la palabra 'nodejs'
console.log('Resultados de búsqueda:', searchResults.data)