// src/server.js
require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const aulasRoutes    = require('./routes/aulasRoutes');
const materiasRoutes = require('./routes/materiasRoutes');
const gruposRoutes   = require('./routes/gruposRoutes');
const { cierreAutomatico } = require('./controllers/aulasController');
const app = express();

app.use(cors());
app.use(express.json());

app.use('/aulas',    aulasRoutes);
app.use('/materias', materiasRoutes);
app.use('/grupos',   gruposRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'servicio-aulas' }));

const PORT = process.env.PORT || 3002;
setInterval(() => {
    const minutosActuales = new Date().getMinutes();
    
    // Si estamos exactamente en el minuto 10 de cualquier hora (ej. 17:10, 18:10).
    if (minutosActuales === 10) {
        cierreAutomatico();
    }
}, 60 * 1000); 
cierreAutomatico();

app.listen(PORT, () => {
    console.log(`🚀 Servicio Aulas corriendo en puerto ${PORT}`);
});
