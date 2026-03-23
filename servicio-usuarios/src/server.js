// src/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const usuariosRoutes = require('./routes/usuariosRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/usuarios', usuariosRoutes);

const PORT = 3001;

app.listen(PORT, () => {
    console.log(`Servicio usuarios corriendo en puerto ${PORT}`);
});