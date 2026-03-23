// src/config/db.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user:     process.env.DB_USER     || 'postgres',
    host:     process.env.DB_HOST     || 'localhost',
    database: process.env.DB_NAME     || 'DB_Usuarios',
    password: process.env.DB_PASSWORD || '123',
    port:     parseInt(process.env.DB_PORT) || 5432,
});

pool.connect()
    .then(client => { console.log('✅ Conectado a DB_Usuarios'); client.release(); })
    .catch(err  => console.error('❌ Error DB_Usuarios:', err.message));

module.exports = pool;

pool.on('error', (error) => {
  console.error('PG pool error', error);
});

pool.connect().catch(err => {
   console.error(err);
   process.exit(1);
});