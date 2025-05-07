const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verificarToken = require('../middleware/authMiddleware');

// Obtener reseñas de un producto
router.get('/:productoId', async (req, res) => {
  const { productoId } = req.params;
  try {
    const [reseñas] = await db.promise().query(
      `SELECT r.*, u.nombre 
       FROM reseñas r 
       JOIN usuarios u ON r.usuario_id = u.id 
       WHERE producto_id = ? 
       ORDER BY fecha DESC`,
      [productoId]
    );
    res.json(reseñas);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener reseñas' });
  }
});

// Crear reseña
router.post('/', verificarToken, async (req, res) => {
  const { producto_id, estrellas, comentario } = req.body;
  const usuario_id = req.usuario.id;

  if (!producto_id || !estrellas) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  try {
    await db.promise().query(
      `INSERT INTO reseñas (producto_id, usuario_id, estrellas, comentario) 
       VALUES (?, ?, ?, ?)`,
      [producto_id, usuario_id, estrellas, comentario]
    );
    res.status(201).json({ message: 'Reseña guardada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar reseña' });
  }
});

module.exports = router;
