// src/routes/gatewayRoutes.js
const express = require('express');
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');
const router = express.Router();

// ─── Proxy robusto con fixRequestBody (soluciona consumo de body stream) ────

const proxyConfig = (target, endpoint) => ({
    target,
    changeOrigin: true,
    // ✅ Reconstruye la path: /login → /usuarios/login (Express quitó /usuarios)
    pathRewrite: { '^': `/${endpoint}` },
    // ✅ CRÍTICO: repara el body para POST requests (fix de hpm v2+)
    on: {
        proxyReq: fixRequestBody,
        error: (err, req, res) => {
            console.error(`❌ Proxy error → ${target}:`, err.message);
            if (!res.headersSent) {
                res.status(502).json({ error: 'Bad Gateway', details: err.message });
            }
        },
        proxyReq: (proxyReq, req) => {
            console.log(`→ ${req.method} ${req.originalUrl} → ${target}${proxyReq.path}`);
        },
        proxyRes: (proxyRes, req) => {
            console.log(`← ${req.method} ${req.originalUrl} [${proxyRes.statusCode}]`);
        },
    },
    logger: console,
});

const URL_USUARIOS = process.env.URL_USUARIOS || 'http://localhost:3001';
const URL_AULAS    = process.env.URL_AULAS    || 'http://localhost:3002';

// Servicios activos
router.use('/usuarios', createProxyMiddleware(proxyConfig(URL_USUARIOS, 'usuarios')));
router.use('/aulas',    createProxyMiddleware(proxyConfig(URL_AULAS, 'aulas')));
router.use('/materias', createProxyMiddleware(proxyConfig(URL_AULAS, 'materias')));
router.use('/grupos',   createProxyMiddleware(proxyConfig(URL_AULAS, 'grupos')));

// Servicios futuros — comentados porque aún no están corriendo
// router.use('/accesos', createProxyMiddleware(proxyConfig('http://localhost:3003')));
// router.use('/qr',      createProxyMiddleware(proxyConfig('http://localhost:3004')));
// router.use('/iot',     createProxyMiddleware(proxyConfig('http://localhost:3005')));

module.exports = router;
