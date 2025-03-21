const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const verificarToken = require('../middleware/authMiddleware');


// Obtener todos los usuarios
router.get('/', verificarToken, async (req, res) => {
    try {
        // Solo los administradores pueden ver todos los usuarios
        if (req.usuario.rol !== 'admin') {
            return res.status(403).json({ error: "Acceso denegado. No tienes permisos para ver esta información." });
        }

        const [usuarios] = await db.promise().query("SELECT id, nombre, email, rol, fecha_registro FROM usuarios");
        res.json(usuarios);
    } catch (error) {
        console.error("❌ Error al obtener usuarios:", error);
        res.status(500).json({ error: "Error al obtener usuarios" });
    }
});

// Obtener un usuario por ID
router.get('/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Si el usuario autenticado no es admin y su ID no coincide con el de la solicitud, denegamos el acceso
        if (req.usuario.rol !== 'admin' && req.usuario.id != id) {
            return res.status(403).json({ error: "Acceso denegado. No puedes ver información de otro usuario." });
        }

        const [usuario] = await db.promise().query("SELECT id, nombre, email, rol, fecha_registro FROM usuarios WHERE id = ?", [id]);

        if (usuario.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        res.json(usuario[0]);
    } catch (error) {
        console.error("❌ Error al obtener el usuario:", error);
        res.status(500).json({ error: "Error al obtener el usuario" });
    }
});

// Registrar un nuevo usuario
router.post('/', async (req, res) => {
    try {
        const { nombre, email, password, rol } = req.body;

        // Validaciones obligatorias
        if (!nombre || !email || !password) {
            return res.status(400).json({
                ok: false,
                error: { message: "Todos los campos son obligatorios." }
            });
        }

        // Validar formato de email con regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                ok: false,
                error: { message: "El formato del email no es válido." }
            });
        }

        // Validar longitud mínima de la contraseña
        if (password.length < 6) {
            return res.status(400).json({
                ok: false,
                error: { message: "La contraseña debe tener al menos 6 caracteres." }
            });
        }

        // Comprobar si ya existe un usuario con ese email
        const [usuariosExistentes] = await db.promise().query("SELECT * FROM usuarios WHERE email = ?", [email]);
        if (usuariosExistentes.length > 0) {
            return res.status(409).json({
                ok: false,
                error: { message: "Ya existe un usuario registrado con este email." }
            });
        }

        // Encriptar la contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insertar nuevo usuario
        const sql = `INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)`;
        const [result] = await db.promise().query(sql, [nombre, email, hashedPassword, rol || "cliente"]);

        res.status(201).json({ message: "Usuario registrado con éxito", id: result.insertId });
    } 
    catch (error) {
    console.error("❌ Error al registrar usuario:", error);
    res.status(500).json({
        ok: false,
        error: { message: "Error interno al registrar usuario." }});
    }
    
});

// Iniciar sesión
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Verificar que se envió email y password
        if (!email || !password) {
            return res.status(400).json({ error: "Email y contraseña son obligatorios" });
        }

        // Buscar al usuario en la base de datos
        const [usuarios] = await db.promise().query("SELECT * FROM usuarios WHERE email = ?", [email]);

        if (usuarios.length === 0) {
            return res.status(401).json({ error: "Credenciales incorrectas" });
        }

        const usuario = usuarios[0];

        // Comparar la contraseña ingresada con la encriptada en la base de datos
        const passwordMatch = await bcrypt.compare(password, usuario.password);

        if (!passwordMatch) {
            return res.status(401).json({ error: "Credenciales incorrectas" });
        }

        // Generar el token JWT
        const token = jwt.sign(
            { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES }
        );

        res.json({ message: "Login exitoso", token });
    } catch (error) {
        console.error("❌ Error al iniciar sesión:", error);
        res.status(500).json({ error: "Error al iniciar sesión" });
    }
});

// Actualizar un usuario por ID (solo el mismo usuario o un administrador)
router.put('/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, email, password, rol } = req.body;

        // Verificar si el usuario autenticado es el dueño del perfil o un admin
        if (req.usuario.rol !== 'admin' && req.usuario.id != id) {
            return res.status(403).json({ error: "Acceso denegado. No puedes modificar este usuario." });
        }

        // Verificar si el usuario existe en la base de datos
        const [usuarioExistente] = await db.promise().query("SELECT * FROM usuarios WHERE id = ?", [id]);
        if (usuarioExistente.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        let hashedPassword = usuarioExistente[0].password; // Mantener la contraseña original
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        // Si no es admin, no puede cambiar el rol
        const nuevoRol = req.usuario.rol === 'admin' && rol ? rol : usuarioExistente[0].rol;

        // Actualizar usuario en la base de datos
        const sql = `UPDATE usuarios SET nombre = ?, email = ?, password = ?, rol = ? WHERE id = ?`;
        await db.promise().query(sql, [nombre, email, hashedPassword, nuevoRol, id]);

        res.json({ message: "Usuario actualizado con éxito" });
    } catch (error) {
        console.error("❌ Error al actualizar usuario:", error);
        res.status(500).json({ error: "Error al actualizar usuario" });
    }
});

// Eliminar un usuario por ID (solo si es el mismo usuario o un administrador)
router.delete('/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Un usuario normal solo puede eliminarse a sí mismo
        if (req.usuario.rol !== 'admin' && req.usuario.id != id) {
            return res.status(403).json({ error: "Acceso denegado. No puedes eliminar este usuario." });
        }

        // Un administrador no puede eliminarse a sí mismo
        if (req.usuario.rol === 'admin' && req.usuario.id == id) {
            return res.status(403).json({ error: "Los administradores no pueden eliminarse a sí mismos." });
        }

        // Verificar si el usuario existe en la base de datos
        const [usuarioExistente] = await db.promise().query("SELECT * FROM usuarios WHERE id = ?", [id]);
        if (usuarioExistente.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // Eliminar usuario de la base de datos
        await db.promise().query("DELETE FROM usuarios WHERE id = ?", [id]);

        res.json({ message: "Usuario eliminado con éxito" });
    } catch (error) {
        console.error("❌ Error al eliminar usuario:", error);
        res.status(500).json({ error: "Error al eliminar usuario" });
    }
});


module.exports = router;
