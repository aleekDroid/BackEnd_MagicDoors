// src/config/db.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user:     process.env.DB_USER     || 'postgres',
    host:     process.env.DB_HOST     || 'localhost',
    database: process.env.DB_NAME     || 'DB_Aulas',
    password: process.env.DB_PASSWORD || '123',
    port:     parseInt(process.env.DB_PORT) || 5432,
});

// Verify connection on startup
pool.connect()
    .then(client => {
        console.log('✅ Conectado a DB_Aulas');
        client.release();
    })
    .catch(err => console.error('❌ Error DB_Aulas:', err.message));

module.exports = pool;
