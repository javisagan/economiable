// lib/logger.js - Sistema de logging estructurado y seguro
const winston = require('winston');
const path = require('path');

// Configuración de niveles de log
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

// Formato personalizado para logs
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let logEntry = {
            timestamp,
            level,
            message: sanitizeLogMessage(message)
        };

        // Agregar stack trace para errores
        if (stack) {
            logEntry.stack = stack;
        }

        // Agregar metadata sanitizada
        if (Object.keys(meta).length > 0) {
            logEntry.meta = sanitizeLogMetadata(meta);
        }

        return JSON.stringify(logEntry);
    })
);

// Sanitizar mensajes de log para remover información sensible
const sanitizeLogMessage = (message) => {
    if (typeof message !== 'string') return message;
    
    return message
        .replace(/password["\s]*[:=]["\s]*[^"'\s,}]+/gi, 'password:"[REDACTED]"')
        .replace(/token["\s]*[:=]["\s]*[^"'\s,}]+/gi, 'token:"[REDACTED]"')
        .replace(/authorization["\s]*[:=]["\s]*[^"'\s,}]+/gi, 'authorization:"[REDACTED]"')
        .replace(/api[_-]?key["\s]*[:=]["\s]*[^"'\s,}]+/gi, 'api_key:"[REDACTED]"')
        .replace(/secret["\s]*[:=]["\s]*[^"'\s,}]+/gi, 'secret:"[REDACTED]"');
};

// Sanitizar metadata de logs
const sanitizeLogMetadata = (meta) => {
    const sanitized = { ...meta };
    const sensitiveFields = ['password', 'token', 'authorization', 'api_key', 'secret', 'apiKey'];
    
    const sanitizeObject = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        
        for (const key in obj) {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
                obj[key] = '[REDACTED]';
            } else if (typeof obj[key] === 'object') {
                sanitizeObject(obj[key]);
            }
        }
        return obj;
    };
    
    return sanitizeObject(sanitized);
};

// Crear logger principal
const logger = winston.createLogger({
    levels: logLevels,
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        // Console transport para desarrollo
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        
        // Archivo para logs generales
        new winston.transports.File({
            filename: path.join(__dirname, '..', 'logs', 'app.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        
        // Archivo específico para errores
        new winston.transports.File({
            filename: path.join(__dirname, '..', 'logs', 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ],
    
    // Manejo de excepciones no capturadas
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, '..', 'logs', 'exceptions.log')
        })
    ],
    
    // Manejo de rechazos de promesas no capturadas
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, '..', 'logs', 'rejections.log')
        })
    ]
});

// Logger específico para seguridad
const securityLogger = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
        new winston.transports.File({
            filename: path.join(__dirname, '..', 'logs', 'security.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 10
        })
    ]
});

// Middleware para logging de requests
const requestLogger = (req, res, next) => {
    const start = Date.now();
    const originalSend = res.send;
    
    res.send = function(data) {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            contentLength: data ? data.length : 0
        };
        
        // Log nivel info para requests normales, warn para errores 4xx, error para 5xx
        if (res.statusCode >= 500) {
            logger.error('HTTP Request Error', logData);
        } else if (res.statusCode >= 400) {
            logger.warn('HTTP Request Warning', logData);
        } else {
            logger.info('HTTP Request', logData);
        }
        
        return originalSend.call(this, data);
    };
    
    next();
};

// Middleware para logging de seguridad
const securityLog = (event, details = {}) => {
    const logEntry = {
        event,
        timestamp: new Date().toISOString(),
        ...sanitizeLogMetadata(details)
    };
    
    securityLogger.warn('Security Event', logEntry);
};

// Funciones de conveniencia
const logAuthAttempt = (success, ip, userAgent) => {
    securityLog('AUTH_ATTEMPT', {
        success,
        ip,
        userAgent,
        timestamp: new Date().toISOString()
    });
};

const logRateLimitExceeded = (ip, endpoint) => {
    securityLog('RATE_LIMIT_EXCEEDED', {
        ip,
        endpoint,
        timestamp: new Date().toISOString()
    });
};

const logSuspiciousActivity = (type, details) => {
    securityLog('SUSPICIOUS_ACTIVITY', {
        type,
        ...details,
        timestamp: new Date().toISOString()
    });
};

// Asegurar que el directorio de logs existe
const fs = require('fs');
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = {
    logger,
    securityLogger,
    requestLogger,
    securityLog,
    logAuthAttempt,
    logRateLimitExceeded,
    logSuspiciousActivity,
    sanitizeLogMessage,
    sanitizeLogMetadata
};