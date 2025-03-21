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

// Obtener el historial de pedidos del usuario autenticado
router.get('/', verificarToken, async (req, res) => {
    try {
        const usuario_id = req.usuario.id;

        // Obtener los pedidos del usuario
        const [pedidos] = await db.promise().query(
            `SELECT id, total, fecha, estado FROM pedidos WHERE usuario_id = ? ORDER BY fecha DESC`,
            [usuario_id]
        );

        // Para cada pedido, obtener los productos
        for (let pedido of pedidos) {
            const [detalles] = await db.promise().query(
                `SELECT p.nombre, dp.cantidad, dp.subtotal
                 FROM detalles_pedido dp
                 JOIN productos p ON dp.producto_id = p.id
                 WHERE dp.pedido_id = ?`,
                [pedido.id]
            );
            pedido.productos = detalles;
        }

        res.json(pedidos);
    } catch (error) {
        console.error("❌ Error al obtener historial de pedidos:", error);
        res.status(500).json({ error: "Error al obtener historial de pedidos" });
    }
});

// Cambiar el estado de un pedido (solo admin)
router.put('/:id/estado', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        // Solo los administradores pueden cambiar el estado
        if (req.usuario.rol !== 'admin') {
            return res.status(403).json({ error: "Acceso denegado. Solo los administradores pueden cambiar el estado del pedido." });
        }

        // Validar estado permitido
        const estadosPermitidos = ['pendiente', 'enviado', 'entregado'];
        if (!estadosPermitidos.includes(estado)) {
            return res.status(400).json({ error: "Estado inválido. Debe ser: pendiente, enviado o entregado." });
        }

        // Verificar que el pedido existe
        const [pedidoExistente] = await db.promise().query(
            "SELECT * FROM pedidos WHERE id = ?", 
            [id]
        );

        if (pedidoExistente.length === 0) {
            return res.status(404).json({ error: "Pedido no encontrado" });
        }

        // Actualizar el estado
        await db.promise().query(
            "UPDATE pedidos SET estado = ? WHERE id = ?", 
            [estado, id]
        );

        res.json({ message: `Estado del pedido actualizado a "${estado}" correctamente.` });
    } catch (error) {
        console.error("❌ Error al actualizar el estado del pedido:", error);
        res.status(500).json({ error: "Error al actualizar el estado del pedido" });
    }
});


module.exports = router;
