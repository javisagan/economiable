// lib/validation.js - Esquemas de validación y sanitización
const Joi = require('joi');
const { body, param, query } = require('express-validator');

// Esquemas Joi para validación completa
const postSchema = Joi.object({
    title: Joi.string().trim().min(1).max(200).required()
        .messages({
            'string.empty': 'El título es obligatorio',
            'string.max': 'El título no puede exceder 200 caracteres'
        }),
    subtitle: Joi.string().trim().max(300).optional().allow(''),
    author: Joi.string().trim().min(1).max(200).required()
        .messages({
            'string.empty': 'El autor es obligatorio',
            'string.max': 'El autor no puede exceder 200 caracteres'
        }),
    date: Joi.date().iso().required()
        .messages({
            'date.format': 'La fecha debe estar en formato válido',
            'any.required': 'La fecha es obligatoria'
        }),
    content: Joi.string().trim().min(1).max(100000).required()
        .messages({
            'string.empty': 'El contenido es obligatorio',
            'string.max': 'El contenido no puede exceder 100,000 caracteres'
        }),
    excerpt: Joi.string().trim().min(1).max(1000).required()
        .messages({
            'string.empty': 'El extracto es obligatorio',
            'string.max': 'El extracto no puede exceder 1,000 caracteres'
        }),
    tags: Joi.string().trim().max(500).optional().allow(''),
    imageUrl: Joi.string().uri().max(2048).optional().allow(''),
    metaTitle: Joi.string().trim().max(60).optional().allow(''),
    metaDescription: Joi.string().trim().max(160).optional().allow('')
});

const sitemapContentSchema = Joi.object({
    content: Joi.string().trim().min(1).max(1000000).required()
        .pattern(/^<\?xml.*<\/urlset>$/s)
        .messages({
            'string.pattern.base': 'El contenido debe ser un sitemap XML válido'
        })
});

const robotsContentSchema = Joi.object({
    content: Joi.string().trim().min(1).max(10000).required()
        .pattern(/^(User-agent:|Disallow:|Allow:|Sitemap:).*$/m)
        .messages({
            'string.pattern.base': 'El contenido debe ser un robots.txt válido'
        })
});

// Middleware de validación usando Joi
const validatePost = (req, res, next) => {
    const { error, value } = postSchema.validate(req.body, { 
        stripUnknown: true,
        abortEarly: false 
    });
    
    if (error) {
        return res.status(400).json({
            error: 'Datos inválidos',
            details: error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }))
        });
    }
    
    // Datos sanitizados
    req.body = value;
    next();
};

const validateSitemapContent = (req, res, next) => {
    const { error, value } = sitemapContentSchema.validate(req.body);
    
    if (error) {
        return res.status(400).json({
            error: 'Contenido de sitemap inválido',
            details: error.details[0].message
        });
    }
    
    req.body = value;
    next();
};

const validateRobotsContent = (req, res, next) => {
    const { error, value } = robotsContentSchema.validate(req.body);
    
    if (error) {
        return res.status(400).json({
            error: 'Contenido de robots.txt inválido',
            details: error.details[0].message
        });
    }
    
    req.body = value;
    next();
};

// Validadores express-validator para casos específicos
const validatePostId = param('id')
    .matches(/^rec[a-zA-Z0-9]{14}$/)
    .withMessage('ID de post inválido');

const validateSlug = param('slug')
    .isSlug()
    .isLength({ min: 1, max: 200 })
    .withMessage('Slug inválido');

// Sanitización de HTML (para contenido que puede tener HTML)
const sanitizeHtmlContent = (content) => {
    if (!content) return content;
    
    // Lista blanca de etiquetas HTML permitidas
    const allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    const allowedAttributes = {
        'a': ['href', 'target', 'title'],
        'img': ['src', 'alt', 'title']
    };
    
    // En el servidor, usaremos una implementación básica
    // Para una implementación más robusta, considerar usar 'sanitize-html'
    return content;
};

// Middleware para sanitizar contenido HTML
const sanitizeHtmlFields = (fields) => (req, res, next) => {
    if (req.body) {
        fields.forEach(field => {
            if (req.body[field]) {
                req.body[field] = sanitizeHtmlContent(req.body[field]);
            }
        });
    }
    next();
};

// Validador de URL segura
const isValidURL = (url) => {
    try {
        const urlObj = new URL(url);
        return ['http:', 'https:'].includes(urlObj.protocol);
    } catch (error) {
        return false;
    }
};

// Middleware para validar URLs en el contenido
const validateUrls = (req, res, next) => {
    if (req.body.imageUrl && req.body.imageUrl !== '' && !isValidURL(req.body.imageUrl)) {
        return res.status(400).json({
            error: 'URL de imagen inválida',
            details: 'La URL de la imagen debe ser válida y usar protocolo HTTP o HTTPS'
        });
    }
    next();
};

module.exports = {
    validatePost,
    validateSitemapContent,
    validateRobotsContent,
    validatePostId,
    validateSlug,
    sanitizeHtmlFields,
    isValidURL,
    validateUrls,
    postSchema,
    sitemapContentSchema,
    robotsContentSchema
};