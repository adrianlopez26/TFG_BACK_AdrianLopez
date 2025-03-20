const db = require('./db');

const insertData = async () => {
    // Insertar Usuarios
    const usuarios = [
        ["Admin", "admin@email.com", "123456", "admin"],
        ["Usuario1", "usuario1@email.com", "123456", "cliente"]
    ];

    const productos = [
        ["Camiseta Negra", "Camiseta de algodón 100%", 19.99, 50, "camiseta.jpg", "Ropa"],
        ["Portátil HP", "Laptop con procesador Intel i5", 699.99, 10, "laptop.jpg", "Electrónica"],
        ["Silla Gamer", "Silla ergonómica para gaming", 129.99, 15, "silla.jpg", "Muebles"]
    ];

    try {
        // Insertar usuarios
        for (const usuario of usuarios) {
            const sql = `INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)`;
            await db.promise().query(sql, usuario);
        }

        // Insertar productos
        for (const producto of productos) {
            const sql = `INSERT INTO productos (nombre, descripcion, precio, stock, imagen, categoria) VALUES (?, ?, ?, ?, ?, ?)`;
            await db.promise().query(sql, producto);
        }

        console.log("✅ Datos de prueba insertados correctamente.");
    } catch (error) {
        console.error("❌ Error al insertar datos:", error);
    } finally {
        db.end();
    }
};

insertData();
