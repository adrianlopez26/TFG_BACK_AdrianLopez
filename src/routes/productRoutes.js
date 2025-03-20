const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Obtener todos los productos
router.get('/', async (req, res) => {
    try {
        const [productos] = await db.promise().query("SELECT * FROM productos");
        res.json(productos);
    } catch (error) {
        console.error("❌ Error al obtener productos:", error);
        res.status(500).json({ error: "Error al obtener productos" });
    }
});

// Obtener un producto por ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [producto] = await db.promise().query("SELECT * FROM productos WHERE id = ?", [id]);

        if (producto.length === 0) {
            return res.status(404).json({ error: "Producto no encontrado" });
        }

        res.json(producto[0]);  // Enviamos el primer elemento del array
    } catch (error) {
        console.error("❌ Error al obtener el producto:", error);
        res.status(500).json({ error: "Error al obtener el producto" });
    }
});

// Agregar un nuevo producto
router.post('/', async (req, res) => {
    try {
        const { nombre, descripcion, precio, stock, imagen, categoria } = req.body;

        // Verificar que todos los campos requeridos estén presentes
        if (!nombre || !precio || !stock || !categoria) {
            return res.status(400).json({ error: "Faltan datos obligatorios" });
        }

        const sql = `INSERT INTO productos (nombre, descripcion, precio, stock, imagen, categoria) VALUES (?, ?, ?, ?, ?, ?)`;
        const [result] = await db.promise().query(sql, [nombre, descripcion, precio, stock, imagen, categoria]);

        res.status(201).json({ message: "Producto agregado con éxito", id: result.insertId });
    } catch (error) {
        console.error("❌ Error al agregar producto:", error);
        res.status(500).json({ error: "Error al agregar producto" });
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
            return res.status(404).json({ error: "Producto no encontrado" });
        }

        // Actualizar el producto
        const sql = `UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, stock = ?, imagen = ?, categoria = ? WHERE id = ?`;
        await db.promise().query(sql, [nombre, descripcion, precio, stock, imagen, categoria, id]);

        res.json({ message: "Producto actualizado con éxito" });
    } catch (error) {
        console.error("❌ Error al actualizar producto:", error);
        res.status(500).json({ error: "Error al actualizar producto" });
    }
});

// Eliminar un producto por ID
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar si el producto existe antes de eliminarlo
        const [productoExistente] = await db.promise().query("SELECT * FROM productos WHERE id = ?", [id]);
        if (productoExistente.length === 0) {
            return res.status(404).json({ error: "Producto no encontrado" });
        }

        // Eliminar el producto
        await db.promise().query("DELETE FROM productos WHERE id = ?", [id]);

        res.json({ message: "Producto eliminado con éxito" });
    } catch (error) {
        console.error("❌ Error al eliminar producto:", error);
        res.status(500).json({ error: "Error al eliminar producto" });
    }
});


module.exports = router;