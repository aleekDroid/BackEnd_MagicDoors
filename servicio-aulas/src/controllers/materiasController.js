const pool = require('../config/db');

exports.listar = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM materias ORDER BY nombre ASC');
        // Map to frontend shape
        const materias = result.rows.map(m => ({
            id:           String(m.id),
            name:         m.nombre,
            code:         m.codigo,
            area:         m.area,
            credits:      m.creditos,
            hoursPerWeek: m.horas_semana,
            status:       m.estado === 'activa' ? 'active' : 'inactive',
        }));
        res.json(materias);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.crear = async (req, res) => {
    const { name, code, area, credits, hoursPerWeek, status } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO materias(nombre, codigo, area, creditos, horas_semana, estado)
             VALUES($1,$2,$3,$4,$5,$6)
             RETURNING *`,
            [name, code, area, credits || 6, hoursPerWeek || 4, status === 'active' ? 'activa' : 'inactiva']
        );
        const m = result.rows[0];
        res.status(201).json({
            id: String(m.id), name: m.nombre, code: m.codigo,
            area: m.area, credits: m.creditos, hoursPerWeek: m.horas_semana,
            status: m.estado === 'activa' ? 'active' : 'inactive',
        });
    } catch (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'Código de materia ya existe' });
        res.status(500).json({ error: error.message });
    }
};

exports.actualizar = async (req, res) => {
    const { name, code, area, credits, hoursPerWeek, status } = req.body;
    try {
        const result = await pool.query(
            `UPDATE materias
             SET nombre       = COALESCE($1, nombre),
                 codigo       = COALESCE($2, codigo),
                 area         = COALESCE($3, area),
                 creditos     = COALESCE($4, creditos),
                 horas_semana = COALESCE($5, horas_semana),
                 estado       = COALESCE($6, estado)
             WHERE id = $7
             RETURNING *`,
            [name, code, area, credits, hoursPerWeek,
             status ? (status === 'active' ? 'activa' : 'inactiva') : null,
             req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Materia no encontrada' });
        const m = result.rows[0];
        res.json({
            id: String(m.id), name: m.nombre, code: m.codigo,
            area: m.area, credits: m.creditos, hoursPerWeek: m.horas_semana,
            status: m.estado === 'activa' ? 'active' : 'inactive',
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.eliminar = async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE materias SET estado = 'inactiva' WHERE id = $1 RETURNING id`,
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Materia no encontrada' });
        res.json({ mensaje: 'Materia desactivada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
