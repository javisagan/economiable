// lib/jsonStorage.js
const fs = require('fs');
const path = require('path');

class JsonStorage {
    constructor(dataDir = 'data') {
        this.dataDir = dataDir;
        this.postsFile = path.join(dataDir, 'posts.json');
        this.pagesFile = path.join(dataDir, 'pages.json');
        this.configFile = path.join(dataDir, 'config.json');
        
        this.ensureDataFiles();
    }

    ensureDataFiles() {
        // Crear directorio si no existe
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        // Inicializar archivo de posts si no existe
        if (!fs.existsSync(this.postsFile)) {
            this.saveData(this.postsFile, { posts: [] });
        }

        // Inicializar archivo de páginas si no existe
        if (!fs.existsSync(this.pagesFile)) {
            this.saveData(this.pagesFile, { pages: [] });
        }

        // Inicializar archivo de configuración si no existe
        if (!fs.existsSync(this.configFile)) {
            this.saveData(this.configFile, { 
                siteName: 'economIAble',
                version: '1.0.0',
                lastUpdated: new Date().toISOString()
            });
        }
    }

    loadData(filePath) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error loading data from ${filePath}:`, error);
            return null;
        }
    }

    saveData(filePath, data) {
        try {
            // Crear backup antes de guardar
            if (fs.existsSync(filePath)) {
                const backupPath = filePath + '.backup';
                fs.copyFileSync(filePath, backupPath);
            }
            
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error(`Error saving data to ${filePath}:`, error);
            return false;
        }
    }

    generateId() {
        // Generar ID similar al formato de Airtable (rec + 14 caracteres)
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = 'rec';
        for (let i = 0; i < 14; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // OPERACIONES PARA POSTS

    getAllPosts(sortBy = 'date', direction = 'desc') {
        const data = this.loadData(this.postsFile);
        if (!data || !data.posts) return [];

        const posts = [...data.posts];
        
        posts.sort((a, b) => {
            if (direction === 'desc') {
                return new Date(b[sortBy] || 0) - new Date(a[sortBy] || 0);
            } else {
                return new Date(a[sortBy] || 0) - new Date(b[sortBy] || 0);
            }
        });

        return posts;
    }

    getPostById(id) {
        const data = this.loadData(this.postsFile);
        if (!data || !data.posts) return null;
        
        return data.posts.find(post => post.id === id) || null;
    }

    getPostBySlug(slug) {
        const data = this.loadData(this.postsFile);
        if (!data || !data.posts) return null;
        
        return data.posts.find(post => post.slug === slug) || null;
    }

    createPost(postData) {
        const data = this.loadData(this.postsFile);
        if (!data) return null;

        const newPost = {
            id: this.generateId(),
            ...postData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        data.posts = data.posts || [];
        data.posts.push(newPost);
        
        if (this.saveData(this.postsFile, data)) {
            return newPost;
        }
        
        return null;
    }

    updatePost(id, updateData) {
        const data = this.loadData(this.postsFile);
        if (!data || !data.posts) return null;

        const postIndex = data.posts.findIndex(post => post.id === id);
        if (postIndex === -1) return null;

        // Mantener ID y fechas de creación
        const updatedPost = {
            ...data.posts[postIndex],
            ...updateData,
            id: data.posts[postIndex].id,
            createdAt: data.posts[postIndex].createdAt,
            updatedAt: new Date().toISOString()
        };

        data.posts[postIndex] = updatedPost;
        
        if (this.saveData(this.postsFile, data)) {
            return updatedPost;
        }
        
        return null;
    }

    deletePost(id) {
        const data = this.loadData(this.postsFile);
        if (!data || !data.posts) return false;

        const initialLength = data.posts.length;
        data.posts = data.posts.filter(post => post.id !== id);
        
        if (data.posts.length < initialLength) {
            return this.saveData(this.postsFile, data);
        }
        
        return false;
    }

    // OPERACIONES PARA PÁGINAS

    getAllPages() {
        const data = this.loadData(this.pagesFile);
        if (!data || !data.pages) return [];
        return data.pages;
    }

    getPageBySlug(slug) {
        const data = this.loadData(this.pagesFile);
        if (!data || !data.pages) return null;
        
        return data.pages.find(page => page.slug === slug) || null;
    }

    updatePageContent(slug, content) {
        const data = this.loadData(this.pagesFile);
        if (!data) return null;

        data.pages = data.pages || [];
        const pageIndex = data.pages.findIndex(page => page.slug === slug);
        
        if (pageIndex === -1) {
            // Crear nueva página
            const newPage = {
                id: this.generateId(),
                slug,
                content,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            data.pages.push(newPage);
        } else {
            // Actualizar página existente
            data.pages[pageIndex] = {
                ...data.pages[pageIndex],
                content,
                updatedAt: new Date().toISOString()
            };
        }
        
        if (this.saveData(this.pagesFile, data)) {
            return data.pages[pageIndex === -1 ? data.pages.length - 1 : pageIndex];
        }
        
        return null;
    }

    // OPERACIONES DE CONFIGURACIÓN

    getConfig() {
        return this.loadData(this.configFile);
    }

    updateConfig(configData) {
        const currentConfig = this.loadData(this.configFile) || {};
        const updatedConfig = {
            ...currentConfig,
            ...configData,
            lastUpdated: new Date().toISOString()
        };
        
        if (this.saveData(this.configFile, updatedConfig)) {
            return updatedConfig;
        }
        
        return null;
    }

    // UTILIDADES

    exportData() {
        return {
            posts: this.loadData(this.postsFile),
            pages: this.loadData(this.pagesFile),
            config: this.loadData(this.configFile)
        };
    }

    importData(importData) {
        let success = true;
        
        if (importData.posts && !this.saveData(this.postsFile, importData.posts)) {
            success = false;
        }
        
        if (importData.pages && !this.saveData(this.pagesFile, importData.pages)) {
            success = false;
        }
        
        if (importData.config && !this.saveData(this.configFile, importData.config)) {
            success = false;
        }
        
        return success;
    }

    getStats() {
        const posts = this.getAllPosts();
        const pages = this.getAllPages();
        
        return {
            totalPosts: posts.length,
            totalPages: pages.length,
            lastPostDate: posts.length > 0 ? posts[0].date : null,
            dataSize: {
                posts: fs.statSync(this.postsFile).size,
                pages: fs.statSync(this.pagesFile).size,
                config: fs.statSync(this.configFile).size
            }
        };
    }
}

module.exports = JsonStorage;