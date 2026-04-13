// src/routes/usuariosRoutes.js
const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/usuariosController');
const { verificarToken, soloAdmin } = require('../middleware/authMiddleware');

// ── Auth (public) ──────────────────────────────────────────────────────────────
router.post('/registro', ctrl.registrar);
router.post('/login',    ctrl.login);

// ── Usuarios CRUD (admin only) ─────────────────────────────────────────────────
router.get('/',                      verificarToken, soloAdmin, ctrl.listar);
router.get('/roles',                 verificarToken, ctrl.listarRoles);
router.get('/profesores',            verificarToken, ctrl.listarProfesores);
router.get('/:id/qr',                verificarToken, ctrl.generarQRProfesor);

router.get('/:id',                   verificarToken, ctrl.obtener);
router.put('/:id',                   verificarToken, soloAdmin, ctrl.actualizar);
router.delete('/:id',                verificarToken, soloAdmin, ctrl.eliminar);
router.patch('/:id/password',        verificarToken, soloAdmin, ctrl.cambiarPassword);

module.exports = router;
