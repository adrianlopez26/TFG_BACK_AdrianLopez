const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization']; // más seguro y compatible

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Acceso denegado. Token faltante o mal formado." });
  }

  const token = authHeader.split(' ')[1]; // "Bearer <token>" → nos quedamos con el token

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido o expirado." });
  }
};

module.exports = verificarToken;
