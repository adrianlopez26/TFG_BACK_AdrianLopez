const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verificarToken = require('../middleware/authMiddleware');

// Obtener reseñas de un producto
router.get('/:productoId', async (req, res) => {
  const { productoId } = req.params;

  try {
    const [resenas] = await db.promise().query(
      'SELECT r.id, r.usuario_id, r.producto_id, r.comentario, r.valoracion, u.nombre AS nombre_usuario, r.fecha_creacion FROM reseñas r JOIN usuarios u ON r.usuario_id = u.id WHERE producto_id = ? ORDER BY r.fecha_creacion DESC',
      [productoId]
    );

    res.json(resenas);
  } catch (error) {
    console.error('❌ Error al obtener reseñas:', error);
    res.status(500).json({ error: 'Error interno al obtener reseñas' });
  }
});

// Añadir una nueva reseña
router.post('/', verificarToken, async (req, res) => {
  const { producto_id, comentario, valoracion } = req.body;
  const usuario_id = req.usuario.id;

  if (!comentario || !valoracion || !producto_id) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    await db.promise().query(
      'INSERT INTO reseñas (usuario_id, producto_id, comentario, valoracion) VALUES (?, ?, ?, ?)',
      [usuario_id, producto_id, comentario, valoracion]
    );

    res.status(201).json({ message: 'Reseña añadida correctamente' });
  } catch (error) {
    console.error('❌ Error al guardar reseña:', error);
    res.status(500).json({ error: 'Error al guardar la reseña' });
  }
});

module.exports = router;
