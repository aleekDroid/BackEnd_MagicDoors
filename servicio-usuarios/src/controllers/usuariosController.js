// src/controllers/usuariosController.js
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secreto';


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

        const token = jwt.sign(
            { id: usuario.id, rol_id: usuario.rol_id },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        // Map rol_id → 'admin' | 'user' for the Angular frontend
        const role = usuario.rol_id === 1 ? 'admin' : 'user';
        const initials = usuario.nombre
            .split(' ')
            .slice(0, 2)
            .map(n => n[0])
            .join('')
            .toUpperCase();

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
