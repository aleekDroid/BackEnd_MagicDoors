// src/config/db.js (Servicio Usuarios)
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
        database: process.env.DB_NAME     || 'DB_Usuarios',
        password: process.env.DB_PASSWORD || 'admin@',
        port:     parseInt(process.env.DB_PORT) || 5432,
    };

const pool = new Pool(poolConfig);

pool.connect()
  .then(client => { console.log('✅ Conectado a DB_Usuarios'); client.release(); })
  .catch(err => console.error('❌ Error DB_Usuarios:', err.message));

pool.on('error', (error) => {
  console.error('PG pool error', error);
});

module.exports = pool;