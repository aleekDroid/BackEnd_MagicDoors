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
router.get('/anomalias',             verificarToken, aulasCtrl.listarAnomalias);
router.post('/acceso-iot', aulasCtrl.accesoIot);
router.post('/:id/sesion', verificarToken, aulasCtrl.activarSesion);

router.get('/:id',                   verificarToken, aulasCtrl.obtenerAula);
router.post('/',                     verificarToken, soloAdmin, aulasCtrl.crearAula);
router.put('/:id',                   verificarToken, soloAdmin, aulasCtrl.actualizarAula);
router.patch('/:id/status',          verificarToken, aulasCtrl.actualizarEstado);
router.post('/:id/qr',               verificarToken, aulasCtrl.generarQR);
router.post('/:id/sesion',           verificarToken, aulasCtrl.activarSesion);
router.post('/:id/sesion',           verificarToken, aulasCtrl.activarSesion);
router.post('/:id/validar-acceso',   verificarToken, aulasCtrl.validarAccesoQR); 

module.exports = router;
