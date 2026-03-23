-- ============================================================
-- Magic Doors — DB_Aulas Extended Schema
-- Run this AFTER the original DB_Aulas.sql is imported
-- ============================================================

-- The aulas table already exists from DB_Aulas.sql
-- Add initial aulas data if empty
INSERT INTO aulas (nombre, edificio, piso, estado)
SELECT * FROM (VALUES
    ('A-101', 'Edificio K', 1, 'disponible'),
    ('A-102', 'Edificio K', 1, 'disponible'),
    ('A-103', 'Edificio K', 1, 'disponible'),
    ('A-104', 'Edificio K', 1, 'disponible'),
    ('B-101', 'Edificio K', 1, 'disponible'),
    ('B-102', 'Edificio K', 1, 'disponible'),
    ('B-103', 'Edificio K', 1, 'disponible'),
    ('B-104', 'Edificio K', 1, 'disponible')
) AS data(nombre, edificio, piso, estado)
WHERE NOT EXISTS (SELECT 1 FROM aulas LIMIT 1);

-- Add capacity column if it doesn't exist
ALTER TABLE aulas ADD COLUMN IF NOT EXISTS capacidad INTEGER DEFAULT 30;

-- ── Materias ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS materias (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    codigo      VARCHAR(20)  NOT NULL UNIQUE,
    area        VARCHAR(80),
    creditos    INTEGER DEFAULT 6,
    horas_semana INTEGER DEFAULT 4,
    estado      VARCHAR(20) DEFAULT 'activa',
    creado_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Grupos ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grupos (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(20)  NOT NULL,
    grado           VARCHAR(50),
    turno           VARCHAR(20) DEFAULT 'matutino' CHECK (turno IN ('matutino','vespertino','nocturno')),
    num_alumnos     INTEGER DEFAULT 30,
    tutor_nombre    VARCHAR(100),
    estado          VARCHAR(20) DEFAULT 'activo',
    creado_en       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Sesiones de clase (activa | inactiva per aula) ────────────
CREATE TABLE IF NOT EXISTS sesiones_aula (
    id              SERIAL PRIMARY KEY,
    aula_id         INTEGER NOT NULL REFERENCES aulas(id),
    profesor_id     INTEGER,               -- FK to DB_Usuarios.usuarios
    profesor_nombre VARCHAR(100),          -- denormalized for quick read
    materia_id      INTEGER REFERENCES materias(id),
    materia_nombre  VARCHAR(100),
    materia_codigo  VARCHAR(20),
    grupo_id        INTEGER REFERENCES grupos(id),
    grupo_nombre    VARCHAR(20),
    hora_inicio     TIME,
    hora_fin        TIME,
    dias_semana     VARCHAR(100),          -- e.g. "Lun, Mié, Vie"
    activa          BOOLEAN DEFAULT false,
    creado_en       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure only one active session per aula
CREATE UNIQUE INDEX IF NOT EXISTS idx_sesion_aula_activa
    ON sesiones_aula (aula_id)
    WHERE activa = true;
