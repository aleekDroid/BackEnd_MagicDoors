// src/config/db.js (Servicio Aulas)
require('dotenv').config();
const { Pool } = require('pg');

// Recuperamos nuestra vacuna para Supabase
const poolConfig = process.env.DATABASE_URL 
    ? { 
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } 
      }
    : {
        user:     process.env.DB_USER     || 'postgres',
        host:     process.env.DB_HOST     || 'localhost',
        database: process.env.DB_NAME     || 'DB_Aulas',
        password: process.env.DB_PASSWORD || 'admin@',
        port:     parseInt(process.env.DB_PORT) || 5432,
    };

const pool = new Pool(poolConfig);

// Verify connection on startup
pool.connect()
    .then(client => {
        console.log('✅ Conectado a DB_Aulas');
        client.release();
    })
    .catch(err => console.error('❌ Error DB_Aulas:', err.message));

module.exports = pool;