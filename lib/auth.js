// lib/auth.js - Sistema de autenticación JWT seguro
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { logger, logAuthAttempt } = require('./logger');

// Configuración JWT
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-should-be-changed-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// Almacén temporal para tokens invalidados (en producción usar Redis)
const tokenBlacklist = new Set();

// Generar hash de contraseña
const hashPassword = async (password) => {
    try {
        const saltRounds = 12;
        return await bcrypt.hash(password, saltRounds);
    } catch (error) {
        logger.error('Error hashing password', { error: error.message });
        throw new Error('Error al procesar contraseña');
    }
};

// Verificar contraseña
const verifyPassword = async (password, hashedPassword) => {
    try {
        return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
        logger.error('Error verifying password', { error: error.message });
        return false;
    }
};

// Generar token JWT
const generateToken = (payload, expiresIn = JWT_EXPIRES_IN) => {
    try {
        return jwt.sign(payload, JWT_SECRET, { 
            expiresIn,
            issuer: 'economiable',
            audience: 'economiable-admin'
        });
    } catch (error) {
        logger.error('Error generating token', { error: error.message });
        throw new Error('Error al generar token');
    }
};

// Verificar token JWT
const verifyToken = (token) => {
    try {
        // Verificar si el token está en la lista negra
        if (tokenBlacklist.has(token)) {
            throw new Error('Token invalidado');
        }

        return jwt.verify(token, JWT_SECRET, {
            issuer: 'economiable',
            audience: 'economiable-admin'
        });
    } catch (error) {
        logger.warn('Token verification failed', { 
            error: error.message,
            tokenPrefix: token ? token.substring(0, 20) + '...' : 'undefined'
        });
        throw new Error('Token inválido o expirado');
    }
};

// Invalidar token (logout)
const invalidateToken = (token) => {
    try {
        // Agregar a lista negra
        tokenBlacklist.add(token);
        
        // Limpiar tokens expirados cada hora (en producción usar cronjob)
        setTimeout(() => {
            cleanExpiredTokens();
        }, 3600000);
        
        return true;
    } catch (error) {
        logger.error('Error invalidating token', { error: error.message });
        return false;
    }
};

// Limpiar tokens expirados de la lista negra
const cleanExpiredTokens = () => {
    tokenBlacklist.forEach(token => {
        try {
            jwt.verify(token, JWT_SECRET);
        } catch (error) {
            // Token expirado, remover de lista negra
            if (error.name === 'TokenExpiredError') {
                tokenBlacklist.delete(token);
            }
        }
    });
};

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            logAuthAttempt(false, req.ip, req.get('User-Agent'));
            return res.status(401).json({ 
                error: 'Token de acceso requerido',
                code: 'NO_TOKEN'
            });
        }

        const token = authHeader.startsWith('Bearer ') 
            ? authHeader.substring(7) 
            : authHeader;

        if (!token) {
            logAuthAttempt(false, req.ip, req.get('User-Agent'));
            return res.status(401).json({ 
                error: 'Token de acceso requerido',
                code: 'NO_TOKEN'
            });
        }

        const decoded = verifyToken(token);
        
        // Agregar información del usuario al request
        req.user = decoded;
        req.token = token;
        
        logAuthAttempt(true, req.ip, req.get('User-Agent'));
        next();
        
    } catch (error) {
        logAuthAttempt(false, req.ip, req.get('User-Agent'));
        
        if (error.message.includes('expirado')) {
            return res.status(401).json({ 
                error: 'Token expirado',
                code: 'TOKEN_EXPIRED'
            });
        }
        
        return res.status(403).json({ 
            error: 'Token inválido',
            code: 'INVALID_TOKEN'
        });
    }
};

// Middleware opcional de autenticación (no falla si no hay token)
const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader) {
            const token = authHeader.startsWith('Bearer ') 
                ? authHeader.substring(7) 
                : authHeader;

            if (token) {
                try {
                    const decoded = verifyToken(token);
                    req.user = decoded;
                    req.token = token;
                } catch (error) {
                    // Ignorar errores en autenticación opcional
                    logger.debug('Optional auth failed', { error: error.message });
                }
            }
        }
        
        next();
    } catch (error) {
        // Continuar sin autenticación
        next();
    }
};

// Verificar si el usuario tiene rol de administrador
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            error: 'Autenticación requerida',
            code: 'NO_AUTH'
        });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({ 
            error: 'Permisos de administrador requeridos',
            code: 'INSUFFICIENT_PERMISSIONS'
        });
    }

    next();
};

// Procesar login
const processLogin = async (password, req, res) => {
    try {
        const adminPassword = process.env.ADMIN_PASSWORD;
        
        if (!adminPassword) {
            logger.error('ADMIN_PASSWORD not configured');
            return res.status(500).json({ 
                error: 'Configuración de servidor incorrecta' 
            });
        }

        // En producción, deberías almacenar el hash de la contraseña
        // Por ahora, comparamos directamente para mantener compatibilidad
        const isValid = password === adminPassword;
        
        const clientIp = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        if (isValid) {
            const payload = {
                role: 'admin',
                loginTime: new Date().toISOString(),
                ip: clientIp
            };

            const token = generateToken(payload);
            const refreshToken = generateToken(
                { ...payload, type: 'refresh' }, 
                REFRESH_TOKEN_EXPIRES_IN
            );

            logAuthAttempt(true, clientIp, userAgent);
            
            logger.info('Successful admin login', { 
                ip: clientIp,
                userAgent: userAgent?.substring(0, 100) // Truncar user agent largo
            });

            return res.json({
                success: true,
                token,
                refreshToken,
                expiresIn: JWT_EXPIRES_IN
            });

        } else {
            logAuthAttempt(false, clientIp, userAgent);
            
            logger.warn('Failed admin login attempt', { 
                ip: clientIp,
                userAgent: userAgent?.substring(0, 100)
            });

            return res.status(401).json({ 
                error: 'Credenciales incorrectas',
                code: 'INVALID_CREDENTIALS'
            });
        }

    } catch (error) {
        logger.error('Login process error', { error: error.message });
        return res.status(500).json({ 
            error: 'Error interno del servidor' 
        });
    }
};

// Refrescar token
const refreshToken = (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({ 
                error: 'Refresh token requerido' 
            });
        }

        const decoded = verifyToken(refreshToken);
        
        if (decoded.type !== 'refresh') {
            return res.status(400).json({ 
                error: 'Tipo de token inválido' 
            });
        }

        // Generar nuevo token de acceso
        const payload = {
            role: decoded.role,
            loginTime: decoded.loginTime,
            ip: decoded.ip
        };

        const newToken = generateToken(payload);

        res.json({
            success: true,
            token: newToken,
            expiresIn: JWT_EXPIRES_IN
        });

    } catch (error) {
        logger.error('Token refresh error', { error: error.message });
        return res.status(401).json({ 
            error: 'Refresh token inválido o expirado' 
        });
    }
};

// Logout
const processLogout = (req, res) => {
    try {
        const token = req.token;
        
        if (token) {
            invalidateToken(token);
        }

        logger.info('User logged out', { 
            ip: req.ip,
            userAgent: req.get('User-Agent')?.substring(0, 100)
        });

        res.json({ 
            success: true,
            message: 'Sesión cerrada correctamente' 
        });

    } catch (error) {
        logger.error('Logout error', { error: error.message });
        res.status(500).json({ 
            error: 'Error al cerrar sesión' 
        });
    }
};

module.exports = {
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
    invalidateToken,
    authenticateToken,
    optionalAuth,
    requireAdmin,
    processLogin,
    refreshToken,
    processLogout,
    cleanExpiredTokens
};