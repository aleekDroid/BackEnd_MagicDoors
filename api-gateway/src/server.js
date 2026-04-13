// src/server.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const gatewayRoutes = require('./routes/gatewayRoutes');

const app = express();

// Estos van ANTES del proxy (no consumen el body)
app.use(morgan('dev'));
app.use(cors());


app.use('/api', gatewayRoutes);

// express.json() solo para rutas propias del gateway (después del proxy)
app.use(express.json());
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ API Gateway corriendo en puerto ${PORT}`);
});