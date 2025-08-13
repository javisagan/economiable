// VERSIÓN 3.3 - CORREGIDO ERROR EN LA API DE LISTADO DE POSTS

// 1. IMPORTACIONES Y CONFIGURACIÓN INICIAL
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const Airtable = require('airtable');

const app = express();
const port = process.env.PORT || 3000;

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
const table = base(process.env.AIRTABLE_TABLE_NAME);

app.set('view engine', 'ejs');
// Desactivar caché de vistas EJS para asegurar que los cambios se reflejen inmediatamente
app.set('view cache', false);
app.use(express.static('public'));
app.use('/admin', express.static('admin'));
app.use('/utilidades', express.static('utilidades'));
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

// 2. MIDDLEWARE DE AUTENTICACIÓN
const checkAuth = (req, res, next) => {
    const password = req.headers['authorization'];
    if (password && password === process.env.ADMIN_PASSWORD) {
        next();
    } else {
        res.status(401).json({ error: 'No autorizado.' });
    }
};

// 3. RUTAS DE LA API (CORREGIDAS Y COMPLETADAS)

app.post('/api/login', (req, res) => {
    if (req.body.password && req.body.password === process.env.ADMIN_PASSWORD) {
        res.status(200).json({ message: 'Login correcto' });
    } else {
        res.status(401).json({ error: 'Contraseña incorrecta' });
    }
});

app.get('/api/posts', checkAuth, async (req, res) => {
    try {
        const records = await table.select({ sort: [{ field: 'date', direction: 'desc' }] }).all();
        // CORRECCIÓN: Se revierte al formato plano que el panel de admin espera.
        // Este era el error que causaba que apareciera "undefined".
        const posts = records.map(record => ({ id: record.id, ...record.fields }));
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los posts', details: error.message });
    }
});

app.get('/api/posts/:id', checkAuth, async (req, res) => {
    try {
        const record = await table.find(req.params.id);
        // La respuesta para un solo post SÍ debe tener la estructura "fields"
        // porque así lo espera la función loadPostIntoForm en admin.js
        res.json({ id: record.id, fields: record.fields });
    } catch (error) {
        res.status(404).json({ error: 'Post no encontrado en la API.', details: error.message });
    }
});

app.post('/api/posts', checkAuth, async (req, res) => {
    try {
        const fields = req.body;
        if (fields.title) {
            fields.slug = slugify(fields.title);
        }
        Object.keys(fields).forEach(key => { if (fields[key] === '' || fields[key] === null) delete fields[key]; });
        const newRecord = await table.create([{ fields }]);
        res.status(201).json({ id: newRecord[0].id, fields: newRecord[0].fields });
    } catch (error) {
        res.status(400).json({ error: 'Error de Airtable al crear el post.', details: error.message });
    }
});

app.put('/api/posts/:id', checkAuth, async (req, res) => {
    try {
        const fieldsToUpdate = req.body;
        if (fieldsToUpdate.title) {
            fieldsToUpdate.slug = slugify(fieldsToUpdate.title);
        }
        Object.keys(fieldsToUpdate).forEach(key => { if (fieldsToUpdate[key] === '' || fieldsToUpdate[key] === null) delete fieldsToUpdate[key]; });
        const updatedRecords = await table.update([{ id: req.params.id, fields: fieldsToUpdate }]);
        res.json({ id: updatedRecords[0].id, fields: updatedRecords[0].fields });
    } catch (error) {
        res.status(400).json({ error: 'Error de Airtable al actualizar.', details: error.message });
    }
});

app.delete('/api/posts/:id', checkAuth, async (req, res) => {
    try {
        await table.destroy(req.params.id);
        res.status(200).json({ message: 'Post eliminado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar', details: error.message });
    }
});

app.post('/api/generate-sitemap', checkAuth, (req, res) => {
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


// 4. RUTAS DEL FRONTEND
app.get('/', async (req, res) => {
    try {
        const records = await table.select({ 
            sort: [{ field: 'date', direction: 'desc' }],
            fields: ['title', 'subtitle', 'date', 'slug']
        }).all();
        const posts = records.map(record => ({ id: record.id, ...record.fields }));
        res.render('index', { posts, pageTitle: 'economIAble IA', pageDescription: 'El impacto de la Inteligencia artificial' });
    } catch (error) {
        res.status(500).send('Error al cargar el blog');
    }
});

app.get('/post/:slug', async (req, res) => {
    try {
        const records = await table.select({
            filterByFormula: `{slug} = '${req.params.slug}'`,
            maxRecords: 1
        }).firstPage();

        if (!records || records.length === 0) {
            return res.status(404).send('Post no encontrado');
        }
        const post = { id: records[0].id, ...records[0].fields };
        
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

app.get('/suscribete', (req, res) => {
  res.render('suscribete', {
    pageTitle: 'Suscríbete a economIAble',
    pageDescription: 'Recibe los últimos análisis sobre IA, economía y negocios directamente en tu correo.'
  });
});

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
    console.log(`Servidor escuchando en http://localhost:${port}`);
});