// src/controllers/gruposController.js
const pool = require('../config/db');

const SHIFT_MAP = { morning: 'matutino', afternoon: 'vespertino', evening: 'nocturno' };
const SHIFT_REVERSE = { matutino: 'morning', vespertino: 'afternoon', nocturno: 'evening' };

function mapGrupo(g) {
    return {
        id:           String(g.id),
        name:         g.nombre,
        grade:        g.grado,
        shift:        SHIFT_REVERSE[g.turno] || 'morning',
        studentCount: g.num_alumnos,
        tutorName:    g.tutor_nombre,
        status:       g.estado === 'activo' ? 'active' : 'inactive',
    };
}

exports.listar = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM grupos ORDER BY nombre ASC');
        res.json(result.rows.map(mapGrupo));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.crear = async (req, res) => {
    const { name, grade, shift, studentCount, tutorName, status } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO grupos(nombre, grado, turno, num_alumnos, tutor_nombre, estado)
             VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
            [name, grade, SHIFT_MAP[shift] || 'matutino', studentCount || 30,
             tutorName, status === 'active' ? 'activo' : 'inactivo']
        );
        res.status(201).json(mapGrupo(result.rows[0]));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.actualizar = async (req, res) => {
    const { name, grade, shift, studentCount, tutorName, status } = req.body;
    try {
        const result = await pool.query(
            `UPDATE grupos
             SET nombre       = COALESCE($1, nombre),
                 grado        = COALESCE($2, grado),
                 turno        = COALESCE($3, turno),
                 num_alumnos  = COALESCE($4, num_alumnos),
                 tutor_nombre = COALESCE($5, tutor_nombre),
                 estado       = COALESCE($6, estado)
             WHERE id = $7
             RETURNING *`,
            [name, grade, shift ? SHIFT_MAP[shift] : null, studentCount, tutorName,
             status ? (status === 'active' ? 'activo' : 'inactivo') : null,
             req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Grupo no encontrado' });
        res.json(mapGrupo(result.rows[0]));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.eliminar = async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE grupos SET estado = 'inactivo' WHERE id = $1 RETURNING id`,
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Grupo no encontrado' });
        res.json({ mensaje: 'Grupo desactivado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
