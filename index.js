const express = require('express');
const app = express();

// Middleware para procesar JSON
app.use(express.json());

// Importar rutas
const productRoutes = require('./src/routes/productRoutes');

// Usar las rutas
app.use('/api/products', productRoutes);

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

const db = require('./src/config/db');