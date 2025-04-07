const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verificarToken = require('../middleware/authMiddleware');

router.post('/', verificarToken, async (req, res) => {
  try {
    const usuario_id = req.usuario.id;
    const { producto_id } = req.body;

    const sql = `INSERT INTO favoritos (usuario_id, producto_id) VALUES (?, ?)`;
    await db.promise().query(sql, [usuario_id, producto_id]);

    res.status(201).json({ message: 'Añadido a favoritos' });
  } catch (error) {
    console.error("❌ Error al añadir a favoritos:", error);
    res.status(500).json({ error: 'Error al guardar favorito' });
  }
});

module.exports = router;
