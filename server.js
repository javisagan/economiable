// VERSIÓN 4.0 - MIGRADO A SISTEMA DE ALMACENAMIENTO JSON LOCAL

// 1. IMPORTACIONES Y CONFIGURACIÓN INICIAL
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const JsonStorage = require('./lib/jsonStorage');
const { authenticateToken, optionalAuth, processLogin, refreshToken, processLogout, verifyToken } = require('./lib/auth');

const app = express();
const port = process.env.PORT || 3000;

const storage = new JsonStorage();

// Configurar Content Security Policy para permitir MailerLite, Google Fonts y reCAPTCHA
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://assets.mailerlite.com https://www.gstatic.com https://www.google.com https://www.recaptcha.net; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "connect-src 'self' https://assets.mailerlite.com https://www.google.com https://www.recaptcha.net; " +
        "frame-src 'self' https://www.google.com https://www.recaptcha.net https://recaptcha.net; " +
        "img-src 'self' data: https://www.gstatic.com https://www.economiable.com;"
    );
    next();
});

app.set('view engine', 'ejs');
// Desactivar caché de vistas EJS para asegurar que los cambios se reflejen inmediatamente
app.set('view cache', false);
app.use(express.static('public'));
app.use('/admin', express.static('admin'));
app.use('/utilidades', express.static('utilidades'));
app.use('/stats', express.static('stats'));

// Servir robots.txt y sitemap.xml desde el directorio raíz
app.get('/robots.txt', (req, res) => {
    res.sendFile(path.join(__dirname, 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
    res.sendFile(path.join(__dirname, 'sitemap.xml'));
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// 2. MIDDLEWARE DE AUTENTICACIÓN JWT

// 3. RUTAS DE LA API (CORREGIDAS Y COMPLETADAS)

app.post('/api/login', (req, res) => {
    processLogin(req.body.password, req, res);
});

app.post('/api/refresh-token', (req, res) => {
    refreshToken(req, res);
});

app.post('/api/logout', authenticateToken, (req, res) => {
    processLogout(req, res);
});

app.get('/api/posts', authenticateToken, async (req, res) => {
    try {
        const posts = storage.getAllPosts('date', 'desc');
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los posts', details: error.message });
    }
});

app.get('/api/posts/:id', authenticateToken, async (req, res) => {
    try {
        const post = storage.getPostById(req.params.id);
        if (!post) {
            return res.status(404).json({ error: 'Post no encontrado en la API.' });
        }
        // Mantener compatibilidad con el formato esperado por admin.js
        res.json({ id: post.id, fields: post });
    } catch (error) {
        res.status(404).json({ error: 'Post no encontrado en la API.', details: error.message });
    }
});

app.post('/api/posts', authenticateToken, async (req, res) => {
    try {
        const fields = req.body;
        if (fields.title) {
            fields.slug = slugify(fields.title);
        }
        Object.keys(fields).forEach(key => { if (fields[key] === '' || fields[key] === null) delete fields[key]; });
        
        const newPost = storage.createPost(fields);
        if (!newPost) {
            return res.status(400).json({ error: 'Error al crear el post.' });
        }
        
        res.status(201).json({ id: newPost.id, fields: newPost });
    } catch (error) {
        res.status(400).json({ error: 'Error al crear el post.', details: error.message });
    }
});

app.put('/api/posts/:id', authenticateToken, async (req, res) => {
    try {
        const fieldsToUpdate = req.body;
        if (fieldsToUpdate.title) {
            fieldsToUpdate.slug = slugify(fieldsToUpdate.title);
        }
        Object.keys(fieldsToUpdate).forEach(key => { if (fieldsToUpdate[key] === '' || fieldsToUpdate[key] === null) delete fieldsToUpdate[key]; });
        
        const updatedPost = storage.updatePost(req.params.id, fieldsToUpdate);
        if (!updatedPost) {
            return res.status(404).json({ error: 'Post no encontrado para actualizar.' });
        }
        
        res.json({ id: updatedPost.id, fields: updatedPost });
    } catch (error) {
        res.status(400).json({ error: 'Error al actualizar el post.', details: error.message });
    }
});

app.delete('/api/posts/:id', authenticateToken, async (req, res) => {
    try {
        const deleted = storage.deletePost(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Post no encontrado para eliminar.' });
        }
        res.status(200).json({ message: 'Post eliminado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar', details: error.message });
    }
});

app.post('/api/generate-sitemap', authenticateToken, (req, res) => {
    const fs = require('fs');
    const path = require('path');
    
    try {
        const { content } = req.body;
        if (!content) {
            return res.status(400).json({ error: 'Contenido del sitemap requerido' });
        }
        
        const sitemapPath = path.join(__dirname, 'sitemap.xml');
        fs.writeFileSync(sitemapPath, content, 'utf8');
        
        res.json({ message: 'Sitemap generado exitosamente' });
    } catch (error) {
        console.error('Error generando sitemap:', error);
        res.status(500).json({ error: 'Error al generar sitemap', details: error.message });
    }
});

app.post('/api/generate-robots', authenticateToken, (req, res) => {
    const fs = require('fs');
    const path = require('path');
    
    try {
        const { content } = req.body;
        if (!content) {
            return res.status(400).json({ error: 'Contenido del robots.txt requerido' });
        }
        
        const robotsPath = path.join(__dirname, 'robots.txt');
        fs.writeFileSync(robotsPath, content, 'utf8');
        
        res.json({ message: 'robots.txt generado exitosamente' });
    } catch (error) {
        console.error('Error generando robots.txt:', error);
        res.status(500).json({ error: 'Error al generar robots.txt', details: error.message });
    }
});


// Sistema de estadísticas
const fs = require('fs');
const statsPath = path.join(__dirname, 'data', 'stats.json');

function updateVisitStats(type, slug = null, req = null) {
    try {
        // No contar visitas de usuarios autenticados (admin)
        if (req && isUserAuthenticated(req)) {
            return; // Salir sin contar la visita
        }
        
        // Estructura por defecto
        let stats = {
            homepage: {
                total: 0,
                referrers: {},
                userAgents: {},
                countries: {}
            },
            posts: {}
        };
        
        if (fs.existsSync(statsPath)) {
            const data = fs.readFileSync(statsPath, 'utf8');
            const existingStats = JSON.parse(data);
            
            // Migrar formato antiguo si existe
            if (typeof existingStats.homepage === 'number') {
                stats.homepage.total = existingStats.homepage;
                // Migrar posts del formato antiguo
                if (existingStats.posts) {
                    Object.entries(existingStats.posts).forEach(([postSlug, count]) => {
                        if (typeof count === 'number') {
                            stats.posts[postSlug] = {
                                total: count,
                                referrers: {},
                                userAgents: {},
                                countries: {}
                            };
                        }
                    });
                }
            } else {
                stats = existingStats;
            }
        }
        
        // Extraer datos de la visita
        const visitData = extractVisitData(req);
        
        if (type === 'homepage') {
            stats.homepage.total++;
            updateVisitMetrics(stats.homepage, visitData);
        } else if (type === 'post' && slug) {
            if (!stats.posts[slug]) {
                stats.posts[slug] = {
                    total: 0,
                    referrers: {},
                    userAgents: {},
                    countries: {}
                };
            }
            stats.posts[slug].total++;
            updateVisitMetrics(stats.posts[slug], visitData);
        }
        
        fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// Extraer datos de la visita
function extractVisitData(req) {
    const referrer = req ? (req.get('Referer') || req.get('Referrer') || 'direct') : 'direct';
    const userAgent = req ? (req.get('User-Agent') || 'unknown') : 'unknown';
    const ip = req ? (req.ip || req.connection.remoteAddress || 'unknown') : 'unknown';
    
    return {
        referrer: cleanReferrer(referrer),
        userAgent: parseUserAgent(userAgent),
        country: 'Unknown' // Implementar geolocalización después
    };
}

// Limpiar y categorizar referrer
function cleanReferrer(referrer) {
    if (!referrer || referrer === 'direct') {
        return 'Direct';
    }
    
    try {
        const url = new URL(referrer);
        const domain = url.hostname.toLowerCase();
        
        // Categorizar referrers principales
        if (domain.includes('google.')) {
            return 'Google';
        } else if (domain.includes('bing.')) {
            return 'Bing';
        } else if (domain.includes('twitter.') || domain.includes('t.co')) {
            return 'Twitter/X';
        } else if (domain.includes('facebook.') || domain.includes('fb.')) {
            return 'Facebook';
        } else if (domain.includes('linkedin.')) {
            return 'LinkedIn';
        } else if (domain.includes('youtube.')) {
            return 'YouTube';
        } else if (domain.includes('instagram.')) {
            return 'Instagram';
        } else if (domain.includes('reddit.')) {
            return 'Reddit';
        } else {
            return domain;
        }
    } catch (error) {
        return referrer.length > 50 ? referrer.substring(0, 50) + '...' : referrer;
    }
}

// Parsear User Agent para obtener info del dispositivo/navegador
function parseUserAgent(userAgent) {
    if (!userAgent || userAgent === 'unknown') {
        return 'Unknown';
    }
    
    const ua = userAgent.toLowerCase();
    
    // Detectar bots
    if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
        return 'Bot/Crawler';
    }
    
    // Detectar navegador
    let browser = 'Other';
    if (ua.includes('chrome') && !ua.includes('edge')) {
        browser = 'Chrome';
    } else if (ua.includes('firefox')) {
        browser = 'Firefox';
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
        browser = 'Safari';
    } else if (ua.includes('edge')) {
        browser = 'Edge';
    }
    
    // Detectar sistema operativo
    let os = 'Other';
    if (ua.includes('windows')) {
        os = 'Windows';
    } else if (ua.includes('mac')) {
        os = 'macOS';
    } else if (ua.includes('linux')) {
        os = 'Linux';
    } else if (ua.includes('android')) {
        os = 'Android';
    } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
        os = 'iOS';
    }
    
    // Detectar tipo de dispositivo
    let device = 'Desktop';
    if (ua.includes('mobile')) {
        device = 'Mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
        device = 'Tablet';
    }
    
    return `${browser} (${os}, ${device})`;
}

// Actualizar métricas de visita
function updateVisitMetrics(section, visitData) {
    // Actualizar referrers
    section.referrers[visitData.referrer] = (section.referrers[visitData.referrer] || 0) + 1;
    
    // Actualizar user agents
    section.userAgents[visitData.userAgent] = (section.userAgents[visitData.userAgent] || 0) + 1;
    
    // Actualizar países (por ahora solo 'Unknown')
    section.countries[visitData.country] = (section.countries[visitData.country] || 0) + 1;
}

// Verificar si el usuario está autenticado
function isUserAuthenticated(req) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return false;
        }
        
        const token = authHeader.startsWith('Bearer ') 
            ? authHeader.substring(7) 
            : authHeader;
        
        if (!token) {
            return false;
        }
        
        // Verificar token sin lanzar excepciones
        verifyToken(token);
        return true; // Token válido = usuario autenticado
    } catch (error) {
        return false; // Token inválido o no presente = no autenticado
    }
}

function getVisitStats() {
    try {
        if (fs.existsSync(statsPath)) {
            const data = fs.readFileSync(statsPath, 'utf8');
            const stats = JSON.parse(data);
            
            // Migrar formato antiguo si es necesario
            if (typeof stats.homepage === 'number') {
                return {
                    homepage: {
                        total: stats.homepage,
                        referrers: {},
                        userAgents: {},
                        countries: {}
                    },
                    posts: stats.posts || {}
                };
            }
            
            return stats;
        }
        
        return {
            homepage: {
                total: 0,
                referrers: {},
                userAgents: {},
                countries: {}
            },
            posts: {}
        };
    } catch (error) {
        console.error('Error reading stats:', error);
        return {
            homepage: {
                total: 0,
                referrers: {},
                userAgents: {},
                countries: {}
            },
            posts: {}
        };
    }
}

// API para estadísticas
app.get('/api/stats', authenticateToken, (req, res) => {
    try {
        const stats = getVisitStats();
        const posts = storage.getAllPosts();
        
        // Enriquecer estadísticas con información de posts
        const postsStats = Object.entries(stats.posts).map(([slug, data]) => {
            const post = posts.find(p => p.slug === slug);
            return {
                slug,
                visits: data.total || 0,
                title: post ? post.title : slug,
                date: post ? post.date : null,
                referrers: data.referrers || {},
                userAgents: data.userAgents || {},
                countries: data.countries || {}
            };
        }).sort((a, b) => b.visits - a.visits);
        
        // Calcular totales
        const homepageTotal = stats.homepage.total || 0;
        const postsTotal = Object.values(stats.posts).reduce((sum, data) => sum + (data.total || 0), 0);
        
        // Agregar top referrers globales
        const globalReferrers = {};
        const globalUserAgents = {};
        const globalCountries = {};
        
        // Combinar datos del homepage
        Object.entries(stats.homepage.referrers || {}).forEach(([ref, count]) => {
            globalReferrers[ref] = (globalReferrers[ref] || 0) + count;
        });
        Object.entries(stats.homepage.userAgents || {}).forEach(([ua, count]) => {
            globalUserAgents[ua] = (globalUserAgents[ua] || 0) + count;
        });
        Object.entries(stats.homepage.countries || {}).forEach(([country, count]) => {
            globalCountries[country] = (globalCountries[country] || 0) + count;
        });
        
        // Combinar datos de posts
        Object.values(stats.posts).forEach(postData => {
            Object.entries(postData.referrers || {}).forEach(([ref, count]) => {
                globalReferrers[ref] = (globalReferrers[ref] || 0) + count;
            });
            Object.entries(postData.userAgents || {}).forEach(([ua, count]) => {
                globalUserAgents[ua] = (globalUserAgents[ua] || 0) + count;
            });
            Object.entries(postData.countries || {}).forEach(([country, count]) => {
                globalCountries[country] = (globalCountries[country] || 0) + count;
            });
        });
        
        // Convertir a arrays ordenados
        const topReferrers = Object.entries(globalReferrers)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));
            
        const topUserAgents = Object.entries(globalUserAgents)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));
            
        const topCountries = Object.entries(globalCountries)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));
        
        res.json({
            homepage: {
                total: homepageTotal,
                referrers: stats.homepage.referrers || {},
                userAgents: stats.homepage.userAgents || {},
                countries: stats.homepage.countries || {}
            },
            posts: postsStats,
            totalVisits: homepageTotal + postsTotal,
            analytics: {
                topReferrers,
                topUserAgents,
                topCountries
            }
        });
    } catch (error) {
        console.error('Stats API error:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

// 4. RUTAS DEL FRONTEND
app.get('/', optionalAuth, async (req, res) => {
    try {
        updateVisitStats('homepage', null, req);
        const posts = storage.getAllPosts('date', 'desc');
        res.render('index', { posts, pageTitle: 'economIAble IA', pageDescription: 'El impacto de la Inteligencia artificial' });
    } catch (error) {
        res.status(500).send('Error al cargar el blog');
    }
});

// Redirect para URL antigua del post de Software Efímero
app.get('/post/software-efmero-el-futuro-de-la-programacin-es-usar-y-tirar', (req, res) => {
    res.redirect(301, '/post/software-efimero-el-futuro-de-la-programacion-es-usar-y-tirar');
});

app.get('/post/:slug', optionalAuth, async (req, res) => {
    try {
        const post = storage.getPostBySlug(req.params.slug);
        
        if (!post) {
            return res.status(404).send('Post no encontrado');
        }
        
        updateVisitStats('post', req.params.slug, req);
        
        res.render('post', {
            post,
            previousPost: null,
            nextPost: null,
            pageTitle: post.metaTitle || post.title,
            pageDescription: post.metaDescription || post.excerpt
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al cargar el post');
    }
});

// Ruta comentada - ahora se usa archivo estático en /views/suscribete.html
// app.get('/suscribete', (req, res) => {
//   res.render('suscribete', {
//     pageTitle: 'Suscríbete a economIAble',
//     pageDescription: 'Recibe los últimos análisis sobre IA, economía y negocios directamente en tu correo.'
//   });
// });

app.get('/sobre-economiable', (req, res) => {
  res.render('sobre-economiable', {
    pageTitle: 'Sobre economIAble',
    pageDescription: 'Descubre la misión y el propósito de economIAble, un espacio de análisis sobre el impacto de la inteligencia artificial en la economía.'
  });
});

app.get('/utilidades', (req, res) => {
  res.render('utilidades', {
    pageTitle: 'Utilidades - economIAble',
    pageDescription: 'Herramientas para la gestión y optimización del sitio web'
  });
});

// 5. INICIAR EL SERVIDOR
app.listen(port, () => {
    console.log(`Servidor iniciado correctamente en puerto ${port}`);
});