require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const aulasRoutes    = require('./routes/aulasRoutes');
const materiasRoutes = require('./routes/materiasRoutes');
const gruposRoutes   = require('./routes/gruposRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/aulas',    aulasRoutes);
app.use('/materias', materiasRoutes);
app.use('/grupos',   gruposRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'servicio-aulas' }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`🚀 Servicio Aulas corriendo en puerto ${PORT}`);
});
