// server-prod.js (En la raíz del repositorio)
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// 1. Configuraciones globales
app.use(cors());
app.use(express.json());

// 2. Importamos las rutas directamente desde las carpetas de tus microservicios
const usuariosRoutes = require('./servicio-usuarios/src/routes/usuariosRoutes');
const aulasRoutes    = require('./servicio-aulas/src/routes/aulasRoutes');
const materiasRoutes = require('./servicio-aulas/src/routes/materiasRoutes');
const gruposRoutes   = require('./servicio-aulas/src/routes/gruposRoutes');
const { cierreAutomatico } = require('./servicio-aulas/src/controllers/aulasController');

// 3. Montamos TODO bajo /api (¡Esto reemplaza a tu API Gateway!)
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/aulas',    aulasRoutes);
app.use('/api/materias', materiasRoutes);
app.use('/api/grupos',   gruposRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', modo: 'fusion-produccion' }));

// 4. Cron job de las aulas
setInterval(() => {
    if (new Date().getMinutes() === 10) cierreAutomatico();
}, 60 * 1000); 
cierreAutomatico();

// 5. Levantamos el servidor en el puerto que Railway nos regale
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Súper-Servidor de Producción corriendo en puerto ${PORT}`);
});