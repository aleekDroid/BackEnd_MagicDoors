const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secreto';

exports.verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ mensaje: 'Token requerido' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.usuario = decoded; // { id, rol_id }
        next();
    } catch (err) {
        return res.status(403).json({ mensaje: 'Token inválido o expirado' });
    }
};

exports.soloAdmin = (req, res, next) => {
    if (req.usuario.rol_id !== 1) {
        return res.status(403).json({ mensaje: 'Acceso restringido a administradores' });
    }
    next();
};
