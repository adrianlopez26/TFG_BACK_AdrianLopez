const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verificarToken = require('../middleware/authMiddleware');

// Obtener el carrito del usuario autenticado
router.get('/', verificarToken, async (req, res) => {
    try {
        const usuario_id = req.usuario.id;

        const [carrito] = await db.promise().query(
            `SELECT 
                c.id,
                p.nombre,
                p.precio,
                p.descuento,
                p.imagen,
                c.cantidad,
                ROUND(
                    (p.precio * (1 - (p.descuento / 100))) * c.cantidad,
                    2
                ) AS total
                FROM carrito c
                JOIN productos p ON c.producto_id = p.id
                WHERE c.usuario_id = ?`, 
            [usuario_id]
        );

        res.json(carrito);
    }
    catch (error) {
        console.error("❌ Error al obtener el carrito:", error);
        res.status(500).json({
            ok: false,
            error: { message: "Error interno al realizar la operación." }
        });
    }
});

// Agregar producto al carrito
router.post('/', verificarToken, async (req, res) => {
    try {
        const { producto_id, cantidad } = req.body;
        const usuario_id = req.usuario.id;

        // Verificar que el producto existe
        const [producto] = await db.promise().query("SELECT * FROM productos WHERE id = ?", [producto_id]);
        if (producto.length === 0) {
            return res.status(404).json({ 
                ok: false,
                error: {message: "Producto no encontrado" }
            });
        }

        // Verificar si el producto ya está en el carrito
        const [carritoExistente] = await db.promise().query(
            "SELECT * FROM carrito WHERE usuario_id = ? AND producto_id = ?", 
            [usuario_id, producto_id]
        );

        if (carritoExistente.length > 0) {
            // Si ya está en el carrito, actualizar la cantidad
            await db.promise().query(
                "UPDATE carrito SET cantidad = cantidad + ? WHERE usuario_id = ? AND producto_id = ?", 
                [cantidad, usuario_id, producto_id]
            );
            return res.json({ message: "Cantidad actualizada en el carrito" });
        } 

        // Si no está en el carrito, agregarlo
        await db.promise().query(
            "INSERT INTO carrito (usuario_id, producto_id, cantidad) VALUES (?, ?, ?)", 
            [usuario_id, producto_id, cantidad]
        );

        res.json({ message: "Producto agregado al carrito" });
    }
    catch (error) {
        console.error("❌ Error al agregar producto al carrito:", error);
        res.status(500).json({
            ok: false,
            error: { message: "Error interno al realizar la operación." }
        });
    }
    
});

// Actualizar la cantidad de un producto en el carrito
router.put('/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;  // ID del producto en el carrito
        const { cantidad } = req.body;
        const usuario_id = req.usuario.id;

        // Verificar que el producto en el carrito pertenece al usuario autenticado
        const [productoEnCarrito] = await db.promise().query(
            "SELECT * FROM carrito WHERE id = ? AND usuario_id = ?", 
            [id, usuario_id]
        );

        if (productoEnCarrito.length === 0) {
            return res.status(404).json({ 
                ok: false,
                error: {message: "Producto no encontrado en tu carrito" }
            });
        }

        // Si la cantidad es 0, eliminar el producto del carrito
        if (cantidad <= 0) {
            await db.promise().query("DELETE FROM carrito WHERE id = ?", [id]);
            return res.json({ message: "Producto eliminado del carrito" });
        }

        // Actualizar la cantidad en el carrito
        await db.promise().query("UPDATE carrito SET cantidad = ? WHERE id = ?", [cantidad, id]);

        res.json({ message: "Cantidad actualizada correctamente" });
    }
    catch (error) {
        console.error("❌ Error al actualizar el carrito:", error);
        res.status(500).json({
            ok: false,
            error: { message: "Error interno al realizar la operación." }
        });
    }
    
});

// Eliminar un producto del carrito
router.delete('/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;  // ID del producto en el carrito
        const usuario_id = req.usuario.id;

        // Verificar que el producto en el carrito pertenece al usuario autenticado
        const [productoEnCarrito] = await db.promise().query(
            "SELECT * FROM carrito WHERE id = ? AND usuario_id = ?", 
            [id, usuario_id]
        );

        if (productoEnCarrito.length === 0) {
            return res.status(404).json({ 
                ok: false,
                error: {message:"Producto no encontrado en tu carrito" }
            });
        }

        // Eliminar el producto del carrito
        await db.promise().query("DELETE FROM carrito WHERE id = ?", [id]);

        res.json({ message: "Producto eliminado del carrito correctamente" });
    }
    catch (error) {
        console.error("❌ Error al eliminar producto del carrito:", error);
        res.status(500).json({
            ok: false,
            error: { message: "Error interno al realizar la operación." }
        });
    }
    
});


// Eliminar producto del carrito usando producto_id (útil desde la vista de productos)
router.delete('/producto/:productoId', verificarToken, async (req, res) => {
    try {
      const { productoId } = req.params;
      const usuario_id = req.usuario.id;
  
      const [existente] = await db.promise().query(
        "SELECT * FROM carrito WHERE usuario_id = ? AND producto_id = ?",
        [usuario_id, productoId]
      );
  
      if (existente.length === 0) {
        return res.status(404).json({
          ok: false,
          error: { message: "Producto no encontrado en tu carrito" }
        });
      }
  
      await db.promise().query(
        "DELETE FROM carrito WHERE usuario_id = ? AND producto_id = ?",
        [usuario_id, productoId]
      );
  
      res.json({ message: "Producto eliminado del carrito correctamente" });
    } catch (error) {
      console.error("❌ Error al eliminar producto del carrito:", error);
      res.status(500).json({
        ok: false,
        error: { message: "Error interno al realizar la operación." }
      });
    }
  });
  
module.exports = router;
