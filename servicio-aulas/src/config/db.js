// src/config/db.js
require('dotenv').config();
const { Pool } = require('pg');

const poolConfig = process.env.DATABASE_URL 
    ? { 
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } 
      }
    : {
        user:     process.env.DB_USER     || 'postgres',
        host:     process.env.DB_HOST     || 'localhost',
        database: process.env.DB_NAME     || 'DB_Aulas', // (Cambia a DB_Usuarios en el otro archivo)
        password: process.env.DB_PASSWORD || '123',
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
