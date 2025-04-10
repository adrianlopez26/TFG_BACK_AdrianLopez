const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verificarToken = require('../middleware/authMiddleware');

// Añadir a favoritos
router.post('/', verificarToken, async (req, res) => {
  const { producto_id } = req.body;
  const usuario_id = req.usuario.id;

  try {
    const [existente] = await db.promise().query(
      'SELECT * FROM favoritos WHERE usuario_id = ? AND producto_id = ?',
      [usuario_id, producto_id]
    );

    if (existente.length > 0) {
      return res.status(409).json({ error: { message: 'Producto ya en favoritos' } });
    }

    await db.promise().query(
      'INSERT INTO favoritos (usuario_id, producto_id) VALUES (?, ?)',
      [usuario_id, producto_id]
    );

    res.status(201).json({ message: 'Producto añadido a favoritos' });
  } catch (error) {
    console.error('Error al añadir a favoritos:', error);
    res.status(500).json({ error: { message: 'Error al añadir a favoritos' } });
  }
});

// Obtener favoritos del usuario
router.get('/', verificarToken, async (req, res) => {
  const usuario_id = req.usuario.id;

  try {
    const [favoritos] = await db.promise().query(
      `SELECT p.* FROM favoritos f
       JOIN productos p ON f.producto_id = p.id
       WHERE f.usuario_id = ?`,
      [usuario_id]
    );

    res.json(favoritos);
  } catch (error) {
    console.error('Error al obtener favoritos:', error);
    res.status(500).json({ error: { message: 'Error al obtener favoritos' } });
  }
});

// Eliminar de favoritos
router.delete('/:id', verificarToken, async (req, res) => {
  const usuario_id = req.usuario.id;
  const producto_id = req.params.id;

  try {
    await db.promise().query(
      'DELETE FROM favoritos WHERE usuario_id = ? AND producto_id = ?',
      [usuario_id, producto_id]
    );

    res.json({ message: 'Producto eliminado de favoritos' });
  } catch (error) {
    console.error('Error al eliminar de favoritos:', error);
    res.status(500).json({ error: { message: 'Error al eliminar de favoritos' } });
  }
});

module.exports = router;