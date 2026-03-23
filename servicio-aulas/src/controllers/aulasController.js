const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Maps DB aula + optional sesion → frontend Classroom shape
function mapAula(row, sesion) {
    // Determine row/col from nombre (A-101 → top row, col 1; B-104 → bottom row, col 4)
    const match = row.nombre.match(/^([AB])-\d(\d\d)$/);
    const rowLetter = match ? match[1] : 'A';
    const col = match ? parseInt(match[2]) : 1;

    const statusMap = { disponible: 'inactive', ocupada: 'active', mantenimiento: 'maintenance' };
    const status = statusMap[row.estado] || 'inactive';

    const classroom = {
        id:       String(row.id),
        name:     row.nombre,
        label:    `Aula ${row.nombre}`,
        status,
        row:      rowLetter === 'A' ? 'top' : 'bottom',
        col,
        capacity: row.capacidad || 30,
    };

    if (sesion && sesion.activa) {
        classroom.currentSession = {
            teacherId:    String(sesion.profesor_id || ''),
            teacherName:  sesion.profesor_nombre,
            subject:      sesion.materia_nombre,
            subjectCode:  sesion.materia_codigo,
            group:        sesion.grupo_nombre,
            startTime:    sesion.hora_inicio ? sesion.hora_inicio.substring(0, 5) : '',
            endTime:      sesion.hora_fin    ? sesion.hora_fin.substring(0, 5)    : '',
            schedule:     sesion.dias_semana || '',
        };
    }

    return classroom;
}

// ─── AULAS ────────────────────────────────────────────────────────────────────

exports.listarAulas = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT a.*,
                   s.id            AS sesion_id,
                   s.profesor_id,   s.profesor_nombre,
                   s.materia_id,    s.materia_nombre, s.materia_codigo,
                   s.grupo_id,      s.grupo_nombre,
                   s.hora_inicio,   s.hora_fin,       s.dias_semana,
                   s.activa
            FROM aulas a
            LEFT JOIN sesiones_aula s ON s.aula_id = a.id AND s.activa = true
            ORDER BY a.nombre ASC
        `);

        const classrooms = result.rows.map(row => mapAula(row, row.activa ? row : null));
        res.json(classrooms);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.obtenerAula = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT a.*,
                   s.id AS sesion_id, s.profesor_id, s.profesor_nombre,
                   s.materia_id, s.materia_nombre, s.materia_codigo,
                   s.grupo_id, s.grupo_nombre,
                   s.hora_inicio, s.hora_fin, s.dias_semana, s.activa
            FROM aulas a
            LEFT JOIN sesiones_aula s ON s.aula_id = a.id AND s.activa = true
            WHERE a.id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Aula no encontrada' });
        res.json(mapAula(result.rows[0], result.rows[0].activa ? result.rows[0] : null));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.crearAula = async (req, res) => {
    const { nombre, edificio, piso, capacidad } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO aulas(nombre, edificio, piso, capacidad, estado)
             VALUES($1, $2, $3, $4, 'disponible')
             RETURNING *`,
            [nombre, edificio || 'Edificio K', piso || 1, capacidad || 30]
        );
        res.status(201).json(mapAula(result.rows[0], null));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.actualizarAula = async (req, res) => {
    const { nombre, edificio, piso, capacidad } = req.body;
    try {
        const result = await pool.query(
            `UPDATE aulas
             SET nombre    = COALESCE($1, nombre),
                 edificio  = COALESCE($2, edificio),
                 piso      = COALESCE($3, piso),
                 capacidad = COALESCE($4, capacidad)
             WHERE id = $5
             RETURNING *`,
            [nombre, edificio, piso, capacidad, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Aula no encontrada' });
        res.json(mapAula(result.rows[0], null));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ── Status update (open/close force) ─────────────────────────────────────────
exports.actualizarEstado = async (req, res) => {
    const { status } = req.body; // 'active' | 'inactive' | 'maintenance'
    const dbStatusMap = { active: 'ocupada', inactive: 'disponible', maintenance: 'mantenimiento' };
    const dbStatus = dbStatusMap[status];

    if (!dbStatus) return res.status(400).json({ error: 'Estado inválido' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Update aula estado
        const aulaResult = await client.query(
            `UPDATE aulas SET estado = $1 WHERE id = $2 RETURNING *`,
            [dbStatus, req.params.id]
        );
        if (aulaResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Aula no encontrada' });
        }

        // If closing: deactivate any active session
        if (status === 'inactive' || status === 'maintenance') {
            await client.query(
                `UPDATE sesiones_aula SET activa = false WHERE aula_id = $1 AND activa = true`,
                [req.params.id]
            );
        }

        await client.query('COMMIT');

        // Fetch the full classroom to return
        const full = await pool.query(`
            SELECT a.*,
                   s.profesor_id, s.profesor_nombre,
                   s.materia_nombre, s.materia_codigo,
                   s.grupo_nombre, s.hora_inicio, s.hora_fin, s.dias_semana, s.activa
            FROM aulas a
            LEFT JOIN sesiones_aula s ON s.aula_id = a.id AND s.activa = true
            WHERE a.id = $1
        `, [req.params.id]);

        res.json(mapAula(full.rows[0], full.rows[0].activa ? full.rows[0] : null));
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
};

// ── QR Generation ──────────────────────────────────────────────────────────────
exports.generarQR = async (req, res) => {
    const aulaId = req.params.id;
    try {
        const aula = await pool.query('SELECT * FROM aulas WHERE id = $1', [aulaId]);
        if (aula.rows.length === 0) return res.status(404).json({ error: 'Aula no encontrada' });

        const sessionId = `session-${uuidv4()}`;
        const qrData = JSON.stringify({
            classroomId: aulaId,
            name: aula.rows[0].nombre,
            sessionId,
            timestamp: new Date().toISOString(),
        });

        res.json({ qrData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ── Sesiones ────────────────────────────────────────────────────────────────
exports.activarSesion = async (req, res) => {
    const { profesor_id, profesor_nombre, materia_id, materia_nombre, materia_codigo,
            grupo_id, grupo_nombre, hora_inicio, hora_fin, dias_semana } = req.body;
    const aulaId = req.params.id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Deactivate any existing active session for this aula
        await client.query(
            `UPDATE sesiones_aula SET activa = false WHERE aula_id = $1 AND activa = true`,
            [aulaId]
        );

        // Create new active session
        await client.query(
            `INSERT INTO sesiones_aula
             (aula_id, profesor_id, profesor_nombre, materia_id, materia_nombre, materia_codigo,
              grupo_id, grupo_nombre, hora_inicio, hora_fin, dias_semana, activa)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)`,
            [aulaId, profesor_id, profesor_nombre, materia_id, materia_nombre, materia_codigo,
             grupo_id, grupo_nombre, hora_inicio, hora_fin, dias_semana]
        );

        // Update aula estado to ocupada
        await client.query(`UPDATE aulas SET estado = 'ocupada' WHERE id = $1`, [aulaId]);

        await client.query('COMMIT');
        res.json({ mensaje: 'Sesión activada correctamente' });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
};
