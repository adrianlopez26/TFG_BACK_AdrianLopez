const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verificarToken = require('../middleware/authMiddleware');

// Crear un nuevo pedido desde el carrito
router.post('/', verificarToken, async (req, res) => {
    let connection;

    try {
        const usuario_id = req.usuario.id;

        // Obtener una conexión desde el pool
        connection = await db.promise().getConnection();

        // Obtener productos del carrito
        const [carrito] = await connection.query(
            `SELECT c.id, c.producto_id, c.cantidad, p.precio, p.stock 
             FROM carrito c 
             JOIN productos p ON c.producto_id = p.id 
             WHERE c.usuario_id = ?`,
            [usuario_id]
        );

        console.log(carrito);

        if (carrito.length === 0) {
            return res.status(400).json({
                ok: false,
                error: { message: "El carrito está vacío." }
            });
        }

        // Verificar stock
        for (const item of carrito) {
            if (item.cantidad > item.stock) {
                return res.status(400).json({
                    ok: false,
                    error: {
                        message: `Stock insuficiente para el producto ID ${item.producto_id}. Stock: ${item.stock}, solicitado: ${item.cantidad}`
                    }
                });
            }
        }

        // Iniciar transacción
        await connection.beginTransaction();

        // Calcular total del pedido
        let total = carrito.reduce((sum, item) => sum + item.cantidad * item.precio, 0);

        // Leer si el usuario quiere usar puntos
        const { usarPuntos } = req.body;

        // Obtener puntos del usuario
        const [userRows] = await connection.query("SELECT puntos FROM usuarios WHERE id = ?", [usuario_id]);
        let puntosUsuario = userRows[0].puntos || 0;

        let puntosUsados = 0;
        let descuento = 0;

        // Aplicar descuento si el usuario lo solicita
        if (usarPuntos && puntosUsuario >= 100) {
            puntosUsados = Math.floor(puntosUsuario / 100) * 100;
            descuento = puntosUsados / 100; // 100 puntos = 1€

            // El descuento no puede ser mayor al total del pedido
            if (descuento > total) {
                descuento = total;
                puntosUsados = Math.floor(total) * 100;
            }

            total -= descuento;
        }

        // Insertar pedido
        const [pedidoResult] = await connection.query(
            "INSERT INTO pedidos (usuario_id, total) VALUES (?, ?)",
            [usuario_id, total]
        );

        // Si se usaron puntos, descontarlos del usuario
        if (puntosUsados > 0) {
            await connection.query(
                "UPDATE usuarios SET puntos = puntos - ? WHERE id = ?",
                [puntosUsados, usuario_id]
            );
        }


        const pedido_id = pedidoResult.insertId;

        // Insertar detalles y actualizar stock
        for (const item of carrito) {
            const subtotal = item.cantidad * item.precio;

            await connection.query(
                "INSERT INTO detalles_pedido (pedido_id, producto_id, cantidad, subtotal) VALUES (?, ?, ?, ?)",
                [pedido_id, item.producto_id, item.cantidad, subtotal]
            );

            await connection.query(
                "UPDATE productos SET stock = stock - ? WHERE id = ?",
                [item.cantidad, item.producto_id]
            );
        }

        // Vaciar carrito
        await connection.query("DELETE FROM carrito WHERE usuario_id = ?", [usuario_id]);

        // Calcular puntos ganados (según total original antes de aplicar el descuento)
        const totalOriginal = carrito.reduce((sum, item) => sum + item.cantidad * item.precio, 0);

        let puntosGanados = 0;
        if (totalOriginal >= 150) {
            puntosGanados = 200;
        } else if (totalOriginal >= 50) {
            puntosGanados = 100;
        } else if (totalOriginal >= 20) {
            puntosGanados = 50;
        }

        if (puntosGanados > 0) {
            await connection.query(
                "UPDATE usuarios SET puntos = puntos + ? WHERE id = ?",
                [puntosGanados, usuario_id]
            );
        }

        // Confirmar transacción
        await connection.commit();

        res.status(201).json({
            ok: true,
            message: "Pedido creado con éxito",
            pedido_id,
            total,
            descuento_aplicado: descuento,
            puntos_usados: puntosUsados,
            puntos_ganados: puntosGanados
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("❌ Error al crear el pedido:", error);
        res.status(500).json({
            ok: false,
            error: { message: "Error interno al crear el pedido." }
        });
    } finally {
        if (connection) connection.release();
    }
    
});

// Obtener el historial de pedidos del usuario autenticado con paginación
router.get('/', verificarToken, async (req, res) => {
    try {
        const usuario_id = req.usuario.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const offset = (page - 1) * limit;

        // Obtener total de pedidos del usuario
        const [countResult] = await db.promise().query(
            "SELECT COUNT(*) AS total FROM pedidos WHERE usuario_id = ?", [usuario_id]
        );
        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        // Obtener los pedidos paginados
        const [pedidos] = await db.promise().query(
            `SELECT id, total, fecha, estado 
             FROM pedidos 
             WHERE usuario_id = ? 
             ORDER BY fecha DESC 
             LIMIT ? OFFSET ?`,
            [usuario_id, limit, offset]
        );

        // Obtener productos por pedido
        for (let pedido of pedidos) {
            const [productos] = await db.promise().query(
                `SELECT p.nombre, dp.cantidad, dp.subtotal
                 FROM detalles_pedido dp
                 JOIN productos p ON dp.producto_id = p.id
                 WHERE dp.pedido_id = ?`,
                [pedido.id]
            );
            pedido.productos = productos;
        }

        res.json({
            page,
            limit,
            total,
            totalPages,
            pedidos
        });

    }
    catch (error) {
        console.error("❌ Error al obtener historial de pedidos:", error);
        res.status(500).json({
            ok: false,
            error: { message: "Error interno al realizar la operación." }
        });
    }
    
});

// Cambiar el estado de un pedido (solo admin)
router.put('/:id/estado', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        // Solo los administradores pueden cambiar el estado
        if (req.usuario.rol !== 'admin') {
            return res.status(403).json({ 
                ok: false,
                error: {message:"Acceso denegado. Solo los administradores pueden cambiar el estado del pedido." }
            });
        }

        // Validar estado permitido
        const estadosPermitidos = ['pendiente', 'enviado', 'entregado'];
        if (!estadosPermitidos.includes(estado)) {
            return res.status(400).json({ 
                ok: false, 
                error: {message:"Estado inválido. Debe ser: pendiente, enviado o entregado." }
            });
        }

        // Verificar que el pedido existe
        const [pedidoExistente] = await db.promise().query(
            "SELECT * FROM pedidos WHERE id = ?", 
            [id]
        );

        if (pedidoExistente.length === 0) {
            return res.status(404).json({ 
                faslse: ok, 
                error: {message: "Pedido no encontrado" }});
        }

        // Actualizar el estado
        await db.promise().query(
            "UPDATE pedidos SET estado = ? WHERE id = ?", 
            [estado, id]
        );

        res.json({ message: `Estado del pedido actualizado a "${estado}" correctamente.` });
    }
    catch (error) {
        console.error("❌ Error al actualizar el estado del pedido:", error);
        res.status(500).json({
            ok: false,
            error: { message: "Error interno al realizar la operación." }
        });
    }
    
});

// Obtener todos los pedidos (solo admin) con paginación
router.get('/admin', verificarToken, async (req, res) => {
    try {
        // Solo administradores pueden acceder
        if (req.usuario.rol !== 'admin') {
            return res.status(403).json({
                ok: false,
                error: { message: "Acceso denegado. Solo administradores pueden ver todos los pedidos." }
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // Total de pedidos
        const [countResult] = await db.promise().query("SELECT COUNT(*) AS total FROM pedidos");
        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        // Obtener pedidos paginados con nombre del usuario
        const [pedidos] = await db.promise().query(
            `SELECT p.id, p.usuario_id, u.nombre AS usuario, p.total, p.fecha, p.estado
             FROM pedidos p
             JOIN usuarios u ON p.usuario_id = u.id
             ORDER BY p.fecha DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        // Añadir productos a cada pedido
        for (let pedido of pedidos) {
            const [productos] = await db.promise().query(
                `SELECT pr.nombre, dp.cantidad, dp.subtotal
                 FROM detalles_pedido dp
                 JOIN productos pr ON dp.producto_id = pr.id
                 WHERE dp.pedido_id = ?`,
                [pedido.id]
            );
            pedido.productos = productos;
        }

        res.json({
            ok: true,
            page,
            limit,
            total,
            totalPages,
            pedidos
        });

    } catch (error) {
        console.error("❌ Error al obtener pedidos (admin):", error);
        res.status(500).json({
            ok: false,
            error: { message: "Error al obtener pedidos para administradores." }
        });
    }
});


// Obtener pedidos del usuario autenticado
router.get('/user', verificarToken, async (req, res) => {
    try {
      const usuario_id = req.usuario.id;
  
      const [pedidos] = await db.promise().query(
        `SELECT p.id, p.fecha, p.estado, p.total
         FROM pedidos p
         WHERE p.usuario_id = ?
         ORDER BY p.fecha DESC`,
        [usuario_id]
      );
  
      res.json(pedidos);
    } catch (error) {
      console.error('❌ Error al obtener pedidos del usuario:', error);
      res.status(500).json({
        ok: false,
        error: { message: 'Error interno al obtener los pedidos.' },
      });
    }
});
  

// pedido específico por su ID incluyendo sus productos, cantidades y subtotales.
router.get('/:id', verificarToken, async (req, res) => {
    try {
      const pedidoId = req.params.id;
      const usuarioId = req.usuario.id;
      const rolUsuario = req.usuario.rol;
  
      // Comprobar que el pedido existe y pertenece al usuario (a menos que sea admin)
      const [pedidos] = await db.promise().query(
        "SELECT * FROM pedidos WHERE id = ?",
        [pedidoId]
      );
  
      if (pedidos.length === 0) {
        return res.status(404).json({ ok: false, error: { message: "Pedido no encontrado" } });
      }
  
      const pedido = pedidos[0];
  
      if (rolUsuario !== 'admin' && pedido.usuario_id !== usuarioId) {
        return res.status(403).json({ ok: false, error: { message: "No tienes acceso a este pedido" } });
      }
  
      // Obtener los productos del pedido
      const [productos] = await db.promise().query(
        `SELECT dp.producto_id, p.nombre, dp.cantidad, dp.subtotal
         FROM detalles_pedido dp
         JOIN productos p ON dp.producto_id = p.id
         WHERE dp.pedido_id = ?`,
        [pedidoId]
      );
  
      res.json({
        id: pedido.id,
        fecha: pedido.fecha,
        estado: pedido.estado,
        total: pedido.total,
        productos
      });
    } catch (error) {
      console.error("❌ Error al obtener detalle del pedido:", error);
      res.status(500).json({ ok: false, error: { message: "Error interno al obtener detalle del pedido" } });
    }
});


// Obtener todos los pedidos (solo admin)
router.get('/admin', verificarToken, async (req, res) => {
    let connection;
  
    try {
      // Solo los admins pueden acceder
      if (req.usuario.rol !== 'admin') {
        return res.status(403).json({
          ok: false,
          error: { message: 'Acceso denegado. Solo administradores.' }
        });
      }
  
      connection = await db.promise().getConnection();
  
      // Obtener todos los pedidos
      const [pedidos] = await connection.query("SELECT * FROM pedidos");
  
      // Por cada pedido, obtener los productos
      for (const pedido of pedidos) {
        const [productos] = await connection.query(
          `SELECT dp.cantidad, dp.subtotal, p.nombre
           FROM detalles_pedido dp
           JOIN productos p ON dp.producto_id = p.id
           WHERE dp.pedido_id = ?`,
          [pedido.id]
        );
  
        pedido.productos = productos;
      }
  
      res.json(pedidos);
    } catch (error) {
      console.error('❌ Error al obtener pedidos admin:', error);
      res.status(500).json({
        ok: false,
        error: { message: 'Error al obtener los pedidos' }
      });
    } finally {
      if (connection) connection.release();
    }
});
  
// Actualizar estado de un pedido (solo admin)
router.put('/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
  
    // Solo los administradores pueden modificar pedidos
    if (req.usuario.rol !== 'admin') {
      return res.status(403).json({
        ok: false,
        error: { message: 'Acceso denegado. Solo administradores pueden modificar pedidos.' }
      });
    }
  
    try {
      // Validar que el estado sea uno de los permitidos
      const estadosPermitidos = ['pendiente', 'enviado', 'entregado'];
      if (!estadosPermitidos.includes(estado)) {
        return res.status(400).json({
          ok: false,
          error: { message: 'Estado no válido.' }
        });
      }
  
      // Actualizar el estado del pedido
      await db.promise().query("UPDATE pedidos SET estado = ? WHERE id = ?", [estado, id]);
  
      res.json({
        ok: true,
        message: `Estado del pedido actualizado a '${estado}'`
      });
    } catch (error) {
      console.error('❌ Error al actualizar estado del pedido:', error);
      res.status(500).json({
        ok: false,
        error: { message: 'Error al actualizar el pedido' }
      });
    }
});
  

module.exports = router;
