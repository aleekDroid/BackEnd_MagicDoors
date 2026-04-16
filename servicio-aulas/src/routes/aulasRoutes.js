// src/routes/aulasRoutes.js
const express = require('express');
const router  = express.Router();

const aulasCtrl    = require('../controllers/aulasController');
const materiasCtrl = require('../controllers/materiasController');
const gruposCtrl   = require('../controllers/gruposController');
const { verificarToken, soloAdmin } = require('../middleware/authMiddleware');

// ── Aulas ─────────────────────────────────────────────────────────────────────
router.get('/',                      verificarToken, aulasCtrl.listarAulas);
router.get('/historial',             verificarToken, soloAdmin, aulasCtrl.obtenerHistorial);
router.get('/sesiones/todas',   verificarToken, aulasCtrl.listarTodasSesiones);
router.get('/anomalias',             verificarToken, aulasCtrl.listarAnomalias);
router.post('/acceso-iot',           aulasCtrl.accesoIot);
router.post('/:id/sesion',           verificarToken, aulasCtrl.activarSesion);
router.get('/sesiones/todas',        verificarToken, aulasCtrl.listarTodasSesiones);
router.put('/sesiones/:id', verificarToken, soloAdmin, aulasCtrl.actualizarSesion);
router.delete('/sesiones/:id', verificarToken, soloAdmin, aulasCtrl.eliminarSesion);

router.get('/:id',                   verificarToken, aulasCtrl.obtenerAula);
router.post('/',                     verificarToken, soloAdmin, aulasCtrl.crearAula);
router.put('/:id',                   verificarToken, soloAdmin, aulasCtrl.actualizarAula);
router.patch('/:id/status',          verificarToken, aulasCtrl.actualizarEstado);
router.get('/:id/qr-activo',         verificarToken, aulasCtrl.obtenerQRActivo);
router.post('/:id/qr',               verificarToken, aulasCtrl.generarQR);
router.post('/:id/generar-qr-aula',  verificarToken, aulasCtrl.generarQRAula);
router.post('/:id/sesion',           verificarToken, aulasCtrl.activarSesion);
router.post('/:id/validar-acceso',   verificarToken, aulasCtrl.validarAccesoQR); 

// Ruta utilizada por el ESP32 (Hardware Scanner)
router.post('/verificar-qr-dinamico', aulasCtrl.verificarQRDinamico);

// Nueva ruta para mandar orden directa al ESP32 (abrir/cerrar)
router.post('/:id/control-puerta',   verificarToken, aulasCtrl.controlPuertaESP32);

module.exports = router;
