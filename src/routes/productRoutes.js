const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Obtener todos los productos
// Obtener productos con paginación
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // página actual
        const limit = parseInt(req.query.limit) || 10; // cantidad por página
        const offset = (page - 1) * limit;

        // Obtener total de productos
        const [countResult] = await db.promise().query("SELECT COUNT(*) AS total FROM productos");
        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        // Obtener los productos paginados
        const [productos] = await db.promise().query("SELECT * FROM productos LIMIT ? OFFSET ?", [limit, offset]);

        res.json({
            page,
            limit,
            total,
            totalPages,
            productos
        });
    }
    catch (error) {
        console.error("❌ Error al obtener productos paginados:", error);
        res.status(500).json({
            ok: false,
            error: { message: "Error interno al realizar la operación." }
        });
    }
    
});


// Obtener un producto por ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [producto] = await db.promise().query("SELECT * FROM productos WHERE id = ?", [id]);

        if (producto.length === 0) {
            return res.status(404).json({ 
                ok: false,
                error: {message:"Producto no encontrado" }
            });
        }

        res.json(producto[0]);  // Enviamos el primer elemento del array
    }
    catch (error) {
        console.error("❌ Error al obtener el producto:", error);
        res.status(500).json({
            ok: false,
            error: { message: "Error interno al realizar la operación." }
        });
    }
    
});

// Agregar un nuevo producto
router.post('/', async (req, res) => {
    try {
        const { nombre, descripcion, precio, stock, imagen, categoria } = req.body;

        // Verificar que todos los campos requeridos estén presentes
        if (!nombre || !precio || !stock || !categoria) {
            return res.status(400).json({ 
                ok: false,
                error: {message: "Faltan datos obligatorios" }
            });
        }

        const sql = `INSERT INTO productos (nombre, descripcion, precio, stock, imagen, categoria) VALUES (?, ?, ?, ?, ?, ?)`;
        const [result] = await db.promise().query(sql, [nombre, descripcion, precio, stock, imagen, categoria]);

        res.status(201).json({ message: "Producto agregado con éxito", id: result.insertId });
    }
    catch (error) {
        console.error("❌ Error al agregar producto:", error);
        res.status(500).json({
            ok: false,
            error: { message: "Error interno al realizar la operación." }
        });
    }
    
});

// Actualizar un producto por ID
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, precio, stock, imagen, categoria } = req.body;

        // Verificar que el producto existe
        const [productoExistente] = await db.promise().query("SELECT * FROM productos WHERE id = ?", [id]);
        if (productoExistente.length === 0) {
            return res.status(404).json({ 
                ok: false,
                error: {message:"Producto no encontrado" }
            });
        }

        // Actualizar el producto
        const sql = `UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, stock = ?, imagen = ?, categoria = ? WHERE id = ?`;
        await db.promise().query(sql, [nombre, descripcion, precio, stock, imagen, categoria, id]);

        res.json({ message: "Producto actualizado con éxito" });
    }
    catch (error) {
        console.error("❌ Error al actualizar producto:", error);
        res.status(500).json({
            ok: false,
            error: { message: "Error interno al realizar la operación." }
        });
    }
    
});

// Eliminar un producto por ID
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar si el producto existe antes de eliminarlo
        const [productoExistente] = await db.promise().query("SELECT * FROM productos WHERE id = ?", [id]);
        if (productoExistente.length === 0) {
            return res.status(404).json({ 
                ok: false,
                error: {message: "Producto no encontrado" }});
        }

        // Eliminar el producto
        await db.promise().query("DELETE FROM productos WHERE id = ?", [id]);

        res.json({ message: "Producto eliminado con éxito" });
    }
    catch (error) {
        console.error("❌ Error al eliminar producto:", error);
        res.status(500).json({
            ok: false,
            error: { message: "Error interno al realizar la operación." }
        });
    }
    
});


module.exports = router;