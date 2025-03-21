const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verificarToken = require('../middleware/authMiddleware');

// Crear un nuevo pedido desde el carrito
router.post('/', verificarToken, async (req, res) => {
    try {
        const usuario_id = req.usuario.id;

        // Obtener los productos del carrito del usuario
        const [carrito] = await db.promise().query(
            `SELECT c.id, c.producto_id, c.cantidad, p.precio 
            FROM carrito c 
            JOIN productos p ON c.producto_id = p.id 
            WHERE c.usuario_id = ?`, 
            [usuario_id]
        );

        if (carrito.length === 0) {
            return res.status(400).json({ error: "El carrito está vacío" });
        }

        // Calcular el total del pedido
        const total = carrito.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);

        // Insertar el pedido en la base de datos
        const [pedido] = await db.promise().query(
            "INSERT INTO pedidos (usuario_id, total) VALUES (?, ?)", 
            [usuario_id, total]
        );
        const pedido_id = pedido.insertId;

        // Insertar detalles del pedido
        for (const item of carrito) {
            await db.promise().query(
                "INSERT INTO detalles_pedido (pedido_id, producto_id, cantidad, subtotal) VALUES (?, ?, ?, ?)", 
                [pedido_id, item.producto_id, item.cantidad, item.cantidad * item.precio]
            );
        }

        // Vaciar el carrito después de generar el pedido
        await db.promise().query("DELETE FROM carrito WHERE usuario_id = ?", [usuario_id]);

        res.json({ message: "Pedido creado con éxito", pedido_id, total });
    } catch (error) {
        console.error("❌ Error al crear el pedido:", error);
        res.status(500).json({ error: "Error al crear el pedido" });
    }
});

module.exports = router;
