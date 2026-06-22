// src/controllers/usuariosController.js
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secreto';

const nodemailer = require('nodemailer');

// ─── CONFIGURACIÓN DE BREVO ───────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.BREVO_USER, 
        pass: process.env.BREVO_PASSWORD 
    }
});

// ─── AUTH ─────────────────────────────────────────────────────────────────────
exports.registrar = async (req, res) => {
    // ✅ FIX 1: Evitamos el undefined asignando null por defecto
    const { 
        nombre = null, email = null, password = null, 
        rol_id = null, telefono = null, departamento = null 
    } = req.body ?? {};    
    
    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO usuarios(nombre, email, password, rol_id, telefono, departamento)
             VALUES($1, $2, $3, $4, $5, $6)
             RETURNING id, nombre, email, rol_id, activo, creado_en, telefono, departamento`,
            [nombre, email, hash, rol_id || 2, telefono, departamento]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'El correo ya está registrado' });
        }
        res.status(500).json({ error: error.message });
    }
};

// ─── CRUD USUARIOS ────────────────────────────────────────────────────────────

exports.listar = async (req, res) => {
    try {
        // ✅ FIX 2: Agregamos u.telefono y u.departamento al SELECT
        const result = await pool.query(
            `SELECT u.id, u.nombre, u.email, u.rol_id, r.nombre AS rol_nombre,
                    u.activo, u.creado_en, u.telefono, u.departamento
             FROM usuarios u
             LEFT JOIN roles r ON u.rol_id = r.id
             ORDER BY u.creado_en DESC`
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.obtener = async (req, res) => {
    try {
        // ✅ FIX 2: Agregamos u.telefono y u.departamento al SELECT
        const result = await pool.query(
            `SELECT u.id, u.nombre, u.email, u.rol_id, r.nombre AS rol_nombre,
                    u.activo, u.creado_en, u.telefono, u.departamento
             FROM usuarios u
             LEFT JOIN roles r ON u.rol_id = r.id
             WHERE u.id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.actualizar = async (req, res) => {
    // ✅ FIX 1: Evitamos el undefined asignando null por defecto
    const { 
        nombre = null, email = null, rol_id = null, 
        activo = null, telefono = null, departamento = null 
    } = req.body ?? {};    
    
    try {
        const result = await pool.query(
            `UPDATE usuarios
             SET nombre = COALESCE($1, nombre),
                 email  = COALESCE($2, email),
                 rol_id = COALESCE($3, rol_id),
                 activo = COALESCE($4, activo),
                 telefono = COALESCE($5, telefono),
                 departamento = COALESCE($6, departamento)
             WHERE id = $7
             RETURNING id, nombre, email, rol_id, activo, creado_en, telefono, departamento`,
            [nombre, email, rol_id, activo, telefono, departamento, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'El correo ya está en uso' });
        }
        res.status(500).json({ error: error.message });
    }
};


exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query(
            `SELECT u.*, r.nombre AS rol_nombre
                FROM usuarios u
                LEFT JOIN roles r ON u.rol_id = r.id
                WHERE u.email = $1 AND u.activo = true`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ mensaje: 'Usuario no encontrado o inactivo' });
        }

        const usuario = result.rows[0];
        const valido = await bcrypt.compare(password, usuario.password);

        if (!valido) {
            return res.status(401).json({ mensaje: 'Contraseña incorrecta' });
        }

        // 1. Generar código de 6 dígitos aleatorio
        const codigo2FA = Math.floor(100000 + Math.random() * 900000).toString();

        // 2. Guardar el código en la base de datos (expira en 10 minutos)
        await pool.query(
            `UPDATE usuarios SET codigo_2fa = $1, expiracion_2fa = NOW() + INTERVAL '10 minutes' WHERE id = $2`,
            [codigo2FA, usuario.id]
        );

        console.log("🔍 Intentando enviar correo a:", usuario.email);
        console.log("🔑 Usuario Brevo detectado:", process.env.BREVO_USER ? "SÍ HAY CORREO" : "VACÍO/UNDEFINED");
        console.log("🔑 Password Brevo detectado:", process.env.BREVO_PASSWORD ? "SÍ HAY PASS" : "VACÍO/UNDEFINED");

        try {
            await transporter.sendMail({
                from: '"Magic Doors" <sxrgiiovilchis@gmail.com>',
                to: usuario.email,
                subject: 'Tu código de acceso a Magic Doors 🔐',
                html: `
                    <h2>¡Hola ${usuario.nombre}!</h2>
                    <p>Alguien intentó iniciar sesión en tu cuenta. Usa el siguiente código para confirmar que eres tú:</p>
                    <h1 style="color: #27548a; letter-spacing: 5px;">${codigo2FA}</h1>
                    <p>Este código expira en 10 minutos.</p>
                `
            });
            console.log("¡Correo enviado a Brevo con éxito!");
        } catch (mailError) {
            console.error("ERROR CRÍTICO DE NODEMAILER:", mailError);
            return res.status(500).json({ 
                error: 'Fallo al enviar el correo de 2FA', 
                detalle: mailError.message 
            });
        }

        res.json({ 
            requires2FA: true, 
            email: usuario.email, 
            mensaje: 'Código enviado a tu correo electrónico' 
        });

    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ error: error.message });
    }
};

// ─── CÓDIGO 2FA ──────────────────────────────────────
exports.verificar2FA = async (req, res) => {
    const { email, codigo } = req.body;

    try {
        const result = await pool.query(
            `SELECT u.*, r.nombre AS rol_nombre
             FROM usuarios u
             LEFT JOIN roles r ON u.rol_id = r.id
             WHERE u.email = $1 AND u.codigo_2fa = $2 AND u.expiracion_2fa > NOW() AND u.activo = true`,
            [email, codigo]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ mensaje: 'Código incorrecto o expirado' });
        }

        const usuario = result.rows[0];

        // Limpia el código para que no se pueda reusar.
        await pool.query(`UPDATE usuarios SET codigo_2fa = NULL, expiracion_2fa = NULL WHERE id = $1`, [usuario.id]);

        const token = jwt.sign(
            { id: usuario.id, rol_id: usuario.rol_id },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        const role = usuario.rol_id === 1 ? 'admin' : 'user';
        const initials = usuario.nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

        res.json({
            token,
            user: {
                id: String(usuario.id),
                name: usuario.nombre,
                email: usuario.email,
                role,
                avatarInitials: initials
            }
        });

    } catch (error) {
        console.error("Error al verificar 2FA:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.eliminar = async (req, res) => {
    try {
        // Soft delete — only deactivate
        const result = await pool.query(
            `UPDATE usuarios SET activo = false WHERE id = $1 RETURNING id`,
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ mensaje: 'Usuario desactivado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.cambiarPassword = async (req, res) => {
    const { password } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `UPDATE usuarios SET password = $1 WHERE id = $2 RETURNING id`,
            [hash, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ mensaje: 'Contraseña actualizada correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─── ROLES ────────────────────────────────────────────────────────────────────

exports.listarRoles = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM roles ORDER BY id');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─── PROFESORES (usuarios con rol docente) ────────────────────────────────────
// Using the usuarios table with a rol_id mapping: rol_id 2 = "docente" pattern
// Since the DB only has admin/usuario, we'll use a metadata approach via
// a separate "profesores" table pattern using usuarios table filtered by rol
// For simplicity we query usuarios but frontend maps them as "personal"

exports.listarProfesores = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.nombre, u.email, u.rol_id, r.nombre AS rol_nombre,
                        u.activo, u.creado_en
                FROM usuarios u
                LEFT JOIN roles r ON u.rol_id = r.id
                WHERE u.rol_id != 1  -- not admin
                ORDER BY u.nombre ASC`
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /usuarios/:id/qr
 * Genera un JWT de 24h con el id del profesor y un timestamp.
 * El frontend usa este string para renderizar el QR.
 */
exports.generarQRProfesor = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar que el usuario existe y es docente (rol_id = 2)
        const result = await pool.query(
            `SELECT id, nombre, email, rol_id FROM usuarios WHERE id = $1 AND activo = true`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const usuario = result.rows[0];

        // Solo docentes tienen QR de acceso
        if (usuario.rol_id !== 2) {
            return res.status(403).json({ error: 'Solo los docentes tienen QR de acceso' });
        }

        // Token con 24h de vida — el servicio IoT lo decodificará al escanear
        const qrToken = jwt.sign(
            {
                profesor_id: usuario.id,
                nombre:      usuario.nombre,
                timestamp:   new Date().toISOString(),
                tipo:        'acceso_aula',
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            qr_token:       qrToken,
            profesor_nombre: usuario.nombre,
            generado_en:    new Date().toISOString(),
            expira_en:      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });

    } catch (error) {
        console.error('❌ generarQRProfesor error:', error);
        res.status(500).json({ error: error.message });
    }
};

