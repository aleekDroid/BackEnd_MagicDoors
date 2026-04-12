// src/controllers/aulasController.js
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

/**
 * POST /aulas/:id/validar-acceso
 * Body: { usuario_id: number }
 *
 * Máquina de estados:
 *
 *   disponible  + profesor con clase ahora  → ocupada    → OPEN_DOOR  ✅
 *   ocupada     + profesor dueño de sesión  → disponible → CLOSE_DOOR (delay 60s) ✅
 *   cualquier   + sin clase / tarde         → sin cambio             ❌ 403
 *   mantenimiento                           → sin cambio             ❌ 403
 *
 * Tolerancia de entrada: desde hora_inicio hasta hora_inicio + 5 min.
 * Tolerancia de salida:  cualquier momento entre hora_inicio y hora_fin.
 * Llegada tarde (> 10 min después de hora_inicio): DENEGADO, registra anomalía.
 */
exports.validarAccesoQR = async (req, res) => {
    const aulaId    = parseInt(req.params.id, 10);
    const usuarioId = parseInt(req.body?.usuario_id, 10);

    if (!usuarioId || isNaN(usuarioId)) {
        return res.status(400).json({ error: 'usuario_id requerido en el body' });
    }

    let client;

    try {
        const client = await pool.connect();    
        await client.query('BEGIN');

        // ── 1. Leer estado actual del aula (FOR UPDATE para evitar race conditions) ──
        const aulaRes = await client.query(
            `SELECT id, nombre, estado FROM aulas WHERE id = $1 FOR UPDATE`,
            [aulaId]
        );

        if (aulaRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Aula no encontrada' });
        }

        const aula = aulaRes.rows[0];

        // ── 1.5 LLAVE MAESTRA (Administradores) ───────────────────────────────────────
        if (req.usuario && req.usuario.rol_id === 1) {
            // Alternamos el estado: si está ocupada la liberamos, de lo contrario la ocupamos
            const nuevoEstado = aula.estado === 'ocupada' ? 'disponible' : 'ocupada';
            const comando = aula.estado === 'ocupada' ? 'CLOSE_DOOR' : 'OPEN_DOOR';

            await client.query(`UPDATE aulas SET estado = $1 WHERE id = $2`, [nuevoEstado, aulaId]);
            
            if (nuevoEstado === 'disponible') {
                await client.query(
                    `UPDATE sesiones_aula SET activa = false WHERE aula_id = $1 AND activa = true`, 
                    [aulaId]
                );
            }
            
            await client.query('COMMIT');

            await _registrarAcceso(pool, {
                aulaId, 
                usuarioId,
                accion: comando === 'OPEN_DOOR' ? 'entrada' : 'salida',
                motivo: 'llave_maestra_admin',
                aulaEstado: nuevoEstado,
            });

            return res.json({
                acceso: comando === 'OPEN_DOOR' ? 'entrada' : 'salida',
                comando: comando,
                delayMs: comando === 'CLOSE_DOOR' ? 60_000 : 0,
                aula: aula.nombre,
                mensaje: `Llave maestra utilizada. Aula forzada a estado: ${nuevoEstado}.`,
            });
        }
        // ─────────────────────────────────────────────────────────────────────────────

        // Mantenimiento: bloqueo total, ni admin docente pasa por esta ruta
        if (aula.estado === 'mantenimiento') {
            await client.query('ROLLBACK');
            await _registrarAcceso(pool, {
                aulaId, usuarioId,
                accion: 'denegado',
                motivo: 'aula_en_mantenimiento',
                aulaEstado: aula.estado,
            });
            return res.status(403).json({
                acceso: 'denegado',
                motivo: 'El aula está en mantenimiento',
            });
        }

        // ── 2. Hora actual en zona local del servidor (TIME en PG es naive) ──────────
        //    Comparamos con los TIME de la BD usando CURRENT_TIME de PostgreSQL
        //    para evitar desfases JS ↔ PG cuando el servidor corre en UTC.
        const tiempoRes = await client.query(`SELECT CURRENT_TIME AS ahora`);
        // ahora es un string 'HH:MM:SS.ffffff+TZ' — extraemos solo HH:MM:SS
        const ahora = tiempoRes.rows[0].ahora; // pg lo devuelve como string

        // ── 3. Buscar sesión programada para este profesor en esta aula ───────────────
        //    Condiciones:
        //      - sesión activa = true  (fue activada desde el panel web por admin)
        //      - profesor_id coincide
        //      - aula_id coincide
        const sesionRes = await client.query(
            `SELECT id, hora_inicio, hora_fin, materia_nombre, grupo_nombre, profesor_nombre
             FROM sesiones_aula
             WHERE aula_id     = $1
               AND profesor_id = $2
               AND activa      = true`,
            [aulaId, usuarioId]
        );

        // ── 4. RAMA: aula OCUPADA ─────────────────────────────────────────────────────
        if (aula.estado === 'ocupada') {

            if (sesionRes.rows.length === 0) {
                // Hay otra sesión activa de otro profesor → acceso denegado
                await client.query('ROLLBACK');
                await _registrarAcceso(pool, {
                    aulaId, usuarioId,
                    accion: 'denegado',
                    motivo: 'aula_ocupada_otro_profesor',
                    aulaEstado: aula.estado,
                });
                return res.status(403).json({
                    acceso: 'denegado',
                    motivo: 'El aula está ocupada por otra clase',
                });
            }

            // Es el mismo profesor → está saliendo
            const sesion = sesionRes.rows[0];

            // Verificar que aún no terminó su horario (no debería pasar, pero validamos)
            const dentroDeHorario = await client.query(
                `SELECT ($1::time BETWEEN $2::time AND $3::time) AS valido`,
                [ahora, sesion.hora_inicio, sesion.hora_fin]
            );

            // Aunque esté fuera del horario, si él es el dueño, lo dejamos salir
            // (podría salir tarde — eso es legítimo)

            // Liberar aula
            await client.query(
                `UPDATE aulas SET estado = 'disponible' WHERE id = $1`,
                [aulaId]
            );

            // Desactivar sesión
            await client.query(
                `UPDATE sesiones_aula SET activa = false WHERE id = $1`,
                [sesion.id]
            );

            await client.query('COMMIT');

            // Registrar salida
            await _registrarAcceso(pool, {
                aulaId, usuarioId,
                accion: 'salida',
                motivo: 'fin_clase_voluntario',
                aulaEstado: 'disponible',
                sesionId: sesion.id,
            });

            // Instrucción al servicio IoT: CLOSE_DOOR con 60 s de delay
            return res.json({
                acceso:    'salida',
                comando:   'CLOSE_DOOR',
                delayMs:   60_000,   // el servicio IoT mantiene abierta 60s antes de cerrar
                aula:      aula.nombre,
                profesor:  sesion.profesor_nombre,
                materia:   sesion.materia_nombre,
                grupo:     sesion.grupo_nombre,
                mensaje:   'Clase finalizada. La puerta cerrará en 60 segundos.',
            });
        }

        // ── 5. RAMA: aula DISPONIBLE ──────────────────────────────────────────────────
        if (sesionRes.rows.length === 0) {
            // No tiene clase programada en este aula ahora
            await client.query('ROLLBACK');
            await _registrarAcceso(pool, {
                aulaId, usuarioId,
                accion: 'denegado',
                motivo: 'sin_sesion_programada',
                aulaEstado: aula.estado,
            });
            return res.status(403).json({
                acceso: 'denegado',
                motivo: 'No tienes clase programada en este aula',
            });
        }

        const sesion = sesionRes.rows[0];

        // ── 6. Validar ventana de tiempo de entrada ───────────────────────────────────
        //
        //    hora_inicio              +5 min          +10 min       hora_fin
        //        |─────── ENTRADA OK ──────|─── TARDE / DENEGADO ───|── fuera ──|
        //
        //    Usamos aritmética de intervalos directamente en PG para evitar
        //    conversiones de zona horaria en JS.

        const ventanaRes = await client.query(`
            SELECT
                -- ¿Estamos ANTES de hora_inicio? (llegó muy temprano)
                ($1::time < $2::time) AS muy_temprano,

                -- ¿Estamos dentro de los primeros 10 minutos? (entrada OK)
                ($1::time BETWEEN $2::time AND ($2::time + interval '10 minutes')) AS en_ventana_entrada,

                -- ¿Entre 10 y 15 minutos? (tarde — denegado, registra anomalía)
                ($1::time BETWEEN ($2::time + interval '10 minutes')
                               AND ($2::time + interval '15 minutes')) AS llegada_tarde,

                -- ¿Pasaron más de 15 minutos? (fuera de ventana completamente)
                ($1::time > ($2::time + interval '15 minutes')) AS fuera_de_ventana,

                -- ¿Pasó la hora de fin? (llegó después de que terminó su clase)
                ($1::time > $3::time) AS clase_terminada
        `, [ahora, sesion.hora_inicio, sesion.hora_fin]);

        const v = ventanaRes.rows[0];

        // Caso: llegó antes de hora_inicio
        if (v.muy_temprano) {
            await client.query('ROLLBACK');
            await _registrarAcceso(pool, {
                aulaId, usuarioId,
                accion: 'denegado',
                motivo: 'llegada_anticipada',
                aulaEstado: aula.estado,
                sesionId: sesion.id,
            });
            return res.status(403).json({
                acceso:  'denegado',
                motivo:  `Aún no es hora. Tu clase inicia a las ${sesion.hora_inicio.substring(0, 5)}`,
            });
        }

        // Caso: llegó tarde (entre 5 y 10 min después de hora_inicio) — anomalía
        if (v.llegada_tarde) {
            await client.query('ROLLBACK');
            await _registrarAcceso(pool, {
                aulaId, usuarioId,
                accion:  'denegado',
                motivo:  'llegada_tarde',      
                aulaEstado: aula.estado,
                sesionId: sesion.id,
            });
            return res.status(403).json({
                acceso:   'denegado',
                motivo:   'Acceso denegado: llegada fuera del rango permitido (máx. 10 min)',
                anomalia: true, 
            });
        }

        // Caso: pasó más de 15 min O la clase ya terminó
        if (v.fuera_de_ventana || v.clase_terminada) {
            await client.query('ROLLBACK');
            await _registrarAcceso(pool, {
                aulaId, usuarioId,
                accion:  'denegado',
                motivo:  v.clase_terminada ? 'clase_ya_terminada' : 'fuera_de_ventana',
                aulaEstado: aula.estado,
                sesionId: sesion.id,
            });
            return res.status(403).json({
                acceso: 'denegado',
                motivo: v.clase_terminada
                    ? 'Tu clase ya terminó'
                    : 'Fuera del horario permitido de entrada',
            });
        }

        // ── 7. ENTRADA VÁLIDA ─────────────────────────────────────────────────────────
        //    en_ventana_entrada === true → abrir aula
        await client.query(
            `UPDATE aulas SET estado = 'ocupada' WHERE id = $1`,
            [aulaId]
        );

        await client.query('COMMIT');

        await _registrarAcceso(pool, {
            aulaId, usuarioId,
            accion:  'entrada',
            motivo:  'acceso_autorizado',
            aulaEstado: 'ocupada',
            sesionId: sesion.id,
        });

        return res.json({
            acceso:   'entrada',
            comando:  'OPEN_DOOR',
            aula:     aula.nombre,
            profesor: sesion.profesor_nombre,
            materia:  sesion.materia_nombre,
            grupo:    sesion.grupo_nombre,
            horario:  `${sesion.hora_inicio.substring(0, 5)} – ${sesion.hora_fin.substring(0, 5)}`,
            mensaje:  'Acceso autorizado. ¡Buen inicio de clase!',
        });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('❌ validarAccesoQR error:', error);
        res.status(500).json({ error: error.message });
    } finally {
        if (client) client.release();
    }
};

// ─── HISTORIAL DE ACCESOS ─────────────────────────────────────────────────────
exports.obtenerHistorial = async (req, res) => {
    try {
        // Traemos los últimos 50 registros, cruzando datos con la tabla aulas
        const result = await pool.query(`
            SELECT ra.id, ra.timestamp, a.nombre AS aula, ra.usuario_id,
                   ra.accion, ra.motivo, ra.estado_aula_snapshot
            FROM registro_accesos ra
            JOIN aulas a ON a.id = ra.aula_id
            ORDER BY ra.timestamp DESC
            LIMIT 50
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ─── Cierre Automático ──────────────────────────────────
exports.cierreAutomatico = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Buscamos y apagamos las sesiones que ya terminaron (hora_fin < hora actual)
        const result = await client.query(`
            UPDATE sesiones_aula
            SET activa = false
            WHERE activa = true AND hora_fin < CURRENT_TIME
            RETURNING id, aula_id, profesor_id
        `);

        if (result.rows.length > 0) {
            // 2. Extraemos los IDs de las aulas que se quedaron "abiertas"
            const aulasIds = result.rows.map(row => row.aula_id);
            
            // 3. Regresamos esas aulas a estado 'disponible'
            await client.query(`
                UPDATE aulas 
                SET estado = 'disponible' 
                WHERE id = ANY($1::int[])
            `, [aulasIds]);

            // 4. DSe guarda en el historial
            for (const row of result.rows) {
                await _registrarAcceso(pool, {
                    aulaId: row.aula_id,
                    usuarioId: row.profesor_id,
                    sesionId: row.id,
                    accion: 'salida',
                    motivo: 'cierre_automatico_sistema',
                    aulaEstado: 'disponible'
                });
            }
            console.log(`🧹 Barrendero ejecutado: Se liberaron automáticamente ${result.rows.length} aulas.`);
        }
        
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en el barrendero automático:', error.message);
    } finally {
        client.release();
    }
};

exports.listarAnomalias = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM v_anomalias ORDER BY timestamp DESC LIMIT 10`
        );
        let anomalias = result.rows;

        // ── MICROSERVICIOS: Obtenemos los nombres del puerto 3001 ──
        try {
            const response = await fetch('http://localhost:3001/usuarios', {
                headers: { 'Authorization': req.headers['authorization'] }
            });
            
            if (response.ok) {
                const usuarios = await response.json();
                anomalias = anomalias.map(a => {
                    const user = usuarios.find(u => String(u.id) === String(a.usuario_id));
                    return {
                        ...a,
                        usuario_nombre: user ? user.nombre : `Usuario ID: ${a.usuario_id}`
                    };
                });
            }
        } catch (err) {
            console.warn('⚠️ No se pudo conectar al ms-usuarios para traer nombres.');
        }

        res.json(anomalias);
    } catch (error) {
        console.error('❌ listarAnomalias error:', error);
        res.status(500).json({ error: error.message });
    }
};

// HELPER PRIVADO — registra cada intento en registro_accesos (fire-and-forget)
async function _registrarAcceso(pool, { aulaId, usuarioId, accion, motivo, aulaEstado, sesionId = null }) {
    try {
        await pool.query(
            `INSERT INTO registro_accesos
                (aula_id, usuario_id, sesion_id, accion, motivo, estado_aula_snapshot)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [aulaId, usuarioId, sesionId, accion, motivo, aulaEstado]
        );
    } catch (err) {
        // Log silencioso — nunca bloquea la respuesta principal
        console.error('⚠️  Error al registrar acceso (no crítico):', err.message);
    }
}
