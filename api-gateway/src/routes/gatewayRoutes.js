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

// Servicios activos
router.use('/usuarios', createProxyMiddleware(proxyConfig('http://localhost:3001', 'usuarios')));
router.use('/aulas',    createProxyMiddleware(proxyConfig('http://localhost:3002', 'aulas')));
router.use('/materias', createProxyMiddleware(proxyConfig('http://localhost:3002', 'materias')));
router.use('/grupos',   createProxyMiddleware(proxyConfig('http://localhost:3002', 'grupos')));

// Servicios futuros — comentados porque aún no están corriendo
// router.use('/accesos', createProxyMiddleware(proxyConfig('http://localhost:3003')));
// router.use('/qr',      createProxyMiddleware(proxyConfig('http://localhost:3004')));
// router.use('/iot',     createProxyMiddleware(proxyConfig('http://localhost:3005')));

module.exports = router;
