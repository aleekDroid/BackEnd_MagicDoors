# MG Magic Doors — Backend

Arquitectura de microservicios en Node.js + Express + PostgreSQL.

> **⚠️ ESTADO: 11 abril 2026 — HAY BUGS ACTIVOS.**
> El login devuelve HTTP 500 y el servicio-aulas no conecta a la BD. Ver sección "Bugs" al final.



## Estructura

```
mg-backend/
├── api-gateway/          → Puerto 3000 (proxy a todos los servicios)
├── servicio-usuarios/    → Puerto 3001 (auth + CRUD usuarios)
└── servicio-aulas/       → Puerto 3002 (aulas + materias + grupos)
```

## Requisitos

- Node.js 18+
- PostgreSQL 14+ corriendo localmente
- Usuario `postgres` con password `123` (o ajusta los `.env`)

## Bases de datos

Debes crear y poblar las BDs en este orden:

```bash
# 1. Crear las bases de datos
psql -U postgres -c "CREATE DATABASE \"DB_Usuarios\";"
psql -U postgres -c "CREATE DATABASE \"DB_Aulas\";"

# 2. Importar esquemas
psql -U postgres -d "DB_Usuarios" -f DB_Usuarios.sql
psql -U postgres -d "DB_Aulas"    -f DB_Aulas.sql

# 3. Ejecutar migración extendida de aulas (tablas materias, grupos, sesiones)
psql -U postgres -d "DB_Aulas" -f servicio-aulas/src/config/migration.sql
```

## Levantar los servicios

Abre **3 terminales** y ejecuta en cada una:

```bash
# Terminal 1 — Usuarios
cd servicio-usuarios
npm install
npm run dev          # nodemon → reinicia al guardar cambios

# Terminal 2 — Aulas
cd servicio-aulas
npm install
npm run dev

# Terminal 3 — Gateway
cd api-gateway
npm install
npm run dev
```

## Variables de entorno

Cada servicio tiene su `.env`. Los valores por defecto:

| Variable     | Valor           |
|-------------|-----------------|
| DB_USER     | postgres        |
| DB_PASSWORD | 123             |
| DB_HOST     | localhost       |
| DB_PORT     | 5432            |
| JWT_SECRET  | secreto         |

> Cambia `JWT_SECRET` por algo seguro antes de producción.

## Endpoints principales

### Auth (`POST /api/usuarios/login`)
```json
// Request
{ "email": "juan@gmail.com", "password": "123" }

// Response
{
  "token": "eyJ...",
  "user": { "id": "2", "name": "Juan", "email": "...", "role": "admin", "avatarInitials": "JU" }
}
```

### Aulas
| Método | Ruta                        | Descripción              |
|--------|-----------------------------|--------------------------|
| GET    | /api/aulas                  | Lista todas las aulas    |
| PATCH  | /api/aulas/:id/status       | Abrir/cerrar forzado     |
| POST   | /api/aulas/:id/qr           | Generar código QR        |
| POST   | /api/aulas/:id/sesion       | Activar sesión de clase  |

### Usuarios (admin)
| Método | Ruta                        | Descripción              |
|--------|-----------------------------|--------------------------|
| GET    | /api/usuarios               | Listar usuarios          |
| POST   | /api/usuarios/registro      | Crear usuario            |
| PUT    | /api/usuarios/:id           | Actualizar usuario       |
| DELETE | /api/usuarios/:id           | Desactivar usuario       |

### Materias y Grupos
Siguen el mismo patrón CRUD: `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`
vía `/api/materias` y `/api/grupos`.

## Roles en BD
- `rol_id = 1` → admin
- `rol_id = 2` → usuario (docente)

## Autenticación

Todos los endpoints protegidos requieren:
```
Authorization: Bearer <token>
```
El frontend lo inyecta automáticamente vía interceptor Angular.

---

## 🐛 Bugs activos (11 abril 2026)

### Bug 1 — `api-gateway/src/routes/gatewayRoutes.js` — proxyReq duplicado

La clave `proxyReq` aparece dos veces en el objeto `on`. JavaScript descarta silenciosamente la primera
(`fixRequestBody`), con lo que los POST bodies pueden llegar vacíos al servicio destino.

**Archivo:** `api-gateway/src/routes/gatewayRoutes.js`

```js
// ❌ ACTUAL (buggy):
on: {
    proxyReq: fixRequestBody,        // ← descartado
    error: (err, req, res) => { ... },
    proxyReq: (proxyReq, req) => {   // ← este gana
        console.log(...)
    },
}

// ✅ FIX:
on: {
    error: (err, req, res) => {
        console.error(`❌ Proxy error → ${target}:`, err.message);
        if (!res.headersSent) res.status(502).json({ error: 'Bad Gateway', details: err.message });
    },
    proxyReq: (proxyReq, req, res) => {
        fixRequestBody(proxyReq, req, res);
        console.log(`→ ${req.method} ${req.originalUrl} → ${target}${proxyReq.path}`);
    },
    proxyRes: (proxyRes, req) => {
        console.log(`← ${req.method} ${req.originalUrl} [${proxyRes.statusCode}]`);
    },
}
```

### Bug 2 — `servicio-usuarios/src/controllers/usuariosController.js` — destructuring fuera de try

`const { email, password } = req.body` está antes del `try`. Si `req.body` es `undefined` (por Bug 1),
Express 5 captura el TypeError y responde automáticamente con HTTP 500.

**Archivo:** `servicio-usuarios/src/controllers/usuariosController.js`

```js
// ❌ ACTUAL — login y registrar tienen este patrón:
exports.login = async (req, res) => {
    const { email, password } = req.body;  // ← explota si req.body === undefined
    try { ... }

// ✅ FIX:
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body ?? {};
        if (!email || !password) return res.status(400).json({ mensaje: 'Faltan credenciales' });
        ...
    } catch (error) {
        console.error('❌ login error:', error);
        res.status(500).json({ error: error.message });
    }
};
```

### Bug 3 — `servicio-aulas`: falla auth PostgreSQL

```
❌ Error DB_Aulas: la autentificación password falló para el usuario 'postgres'
```

Los archivos `.env` de cada servicio NO están en el repositorio (están en `.gitignore`).
Debes crearlos manualmente si no existen.

**Crear `mg-backend/servicio-aulas/.env`:**
```env
DB_USER=postgres
DB_PASSWORD=123
DB_HOST=localhost
DB_PORT=5432
DB_NAME=DB_Aulas
JWT_SECRET=secreto
```

**Crear `mg-backend/servicio-usuarios/.env`:**
```env
DB_USER=postgres
DB_PASSWORD=123
DB_HOST=localhost
DB_PORT=5432
DB_NAME=DB_Usuarios
JWT_SECRET=secreto
```

Si el archivo `.env` existe pero sigue fallando, resetear la contraseña en PostgreSQL:
```sql
ALTER USER postgres WITH PASSWORD '123';
```

### Dependencias clave

| Paquete                  | Versión  | Nota                                     |
|--------------------------|----------|------------------------------------------|
| express                  | ^5.2.1   | Express 5 — captura async errors auto   |
| http-proxy-middleware    | ^3.0.5   | v3 requiere `fixRequestBody` para POST  |
| bcrypt                   | ^6.0.0   | Hash de contraseñas                      |
| jsonwebtoken             | ^9.0.3   | JWT                                      |
| pg                       | ^8.20.0  | Cliente PostgreSQL                       |
| dotenv                   | ^17.3.1  | Variables de entorno (carga doble — OK) |
