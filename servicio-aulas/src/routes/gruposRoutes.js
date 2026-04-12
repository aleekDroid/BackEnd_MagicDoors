// src/routes/gruposRoutes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/gruposController');
const { verificarToken, soloAdmin } = require('../middleware/authMiddleware');

router.get('/',        verificarToken, ctrl.listar);
router.post('/',       verificarToken, soloAdmin, ctrl.crear);
router.put('/:id',     verificarToken, soloAdmin, ctrl.actualizar);
router.delete('/:id',  verificarToken, soloAdmin, ctrl.eliminar);

module.exports = router;
