# MG Magic Doors — Backend

Arquitectura de microservicios en Node.js + Express + PostgreSQL.

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
