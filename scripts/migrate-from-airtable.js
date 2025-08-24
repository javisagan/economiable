// scripts/migrate-from-airtable.js
// Script para migrar datos desde Airtable al nuevo sistema JSON

require('dotenv').config();
const Airtable = require('airtable');
const JsonStorage = require('../lib/jsonStorage');

class AirtableMigration {
    constructor() {
        // Verificar que las variables de entorno de Airtable existan
        if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID || !process.env.AIRTABLE_TABLE_NAME) {
            console.error('❌ Error: Variables de entorno de Airtable no configuradas.');
            console.log('Asegúrate de que AIRTABLE_API_KEY, AIRTABLE_BASE_ID y AIRTABLE_TABLE_NAME estén definidas en .env');
            process.exit(1);
        }

        this.base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
        this.table = this.base(process.env.AIRTABLE_TABLE_NAME);
        this.storage = new JsonStorage();
    }

    async migrateAllPosts() {
        console.log('🚀 Iniciando migración desde Airtable...');
        
        try {
            // Obtener todos los registros de Airtable
            console.log('📥 Obteniendo posts desde Airtable...');
            const records = await this.table.select({
                sort: [{ field: 'date', direction: 'desc' }]
            }).all();

            console.log(`📊 Encontrados ${records.length} posts en Airtable`);

            if (records.length === 0) {
                console.log('⚠️ No se encontraron posts para migrar');
                return;
            }

            // Convertir registros de Airtable al formato JSON
            const posts = records.map(record => ({
                id: record.id,
                ...record.fields,
                createdAt: record._rawJson.createdTime || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }));

            // Guardar en el sistema JSON
            console.log('💾 Guardando posts en sistema JSON...');
            const success = this.storage.importData({ 
                posts: { posts } 
            });

            if (success) {
                console.log('✅ Migración completada exitosamente');
                console.log(`📈 Posts migrados: ${posts.length}`);
                
                // Mostrar estadísticas
                const stats = this.storage.getStats();
                console.log('📊 Estadísticas del sistema:');
                console.log(`   - Total posts: ${stats.totalPosts}`);
                console.log(`   - Último post: ${stats.lastPostDate}`);
                console.log(`   - Tamaño datos: ${Math.round(stats.dataSize.posts / 1024)} KB`);
                
                // Verificar algunos posts migrados
                console.log('\n🔍 Verificando migración...');
                const firstPost = this.storage.getAllPosts()[0];
                if (firstPost) {
                    console.log(`✓ Post más reciente: "${firstPost.title}" (${firstPost.date})`);
                }
                
            } else {
                console.error('❌ Error al guardar los datos migrados');
            }

        } catch (error) {
            console.error('❌ Error durante la migración:', error.message);
            console.error('Detalles:', error);
        }
    }

    async createBackup() {
        console.log('💾 Creando backup de datos actuales...');
        
        try {
            const fs = require('fs');
            const path = require('path');
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const backupDir = path.join(__dirname, '..', 'backups', timestamp);
            
            // Crear directorio de backup
            fs.mkdirSync(backupDir, { recursive: true });
            
            // Exportar datos actuales
            const currentData = this.storage.exportData();
            
            // Guardar backup
            fs.writeFileSync(
                path.join(backupDir, 'backup-posts.json'),
                JSON.stringify(currentData.posts, null, 2)
            );
            
            fs.writeFileSync(
                path.join(backupDir, 'backup-pages.json'),
                JSON.stringify(currentData.pages, null, 2)
            );
            
            fs.writeFileSync(
                path.join(backupDir, 'backup-config.json'),
                JSON.stringify(currentData.config, null, 2)
            );
            
            console.log(`✅ Backup creado en: ${backupDir}`);
            
        } catch (error) {
            console.error('❌ Error al crear backup:', error.message);
        }
    }

    async validateMigration() {
        console.log('🔍 Validando migración...');
        
        try {
            // Comparar conteos
            const airtableRecords = await this.table.select().all();
            const jsonPosts = this.storage.getAllPosts();
            
            console.log(`📊 Comparación de datos:`);
            console.log(`   - Posts en Airtable: ${airtableRecords.length}`);
            console.log(`   - Posts en JSON: ${jsonPosts.length}`);
            
            if (airtableRecords.length === jsonPosts.length) {
                console.log('✅ Conteo de posts coincide');
            } else {
                console.log('⚠️ Diferencia en el conteo de posts');
            }
            
            // Validar estructura de algunos posts
            if (jsonPosts.length > 0) {
                const samplePost = jsonPosts[0];
                const requiredFields = ['id', 'title', 'slug'];
                const hasRequiredFields = requiredFields.every(field => samplePost.hasOwnProperty(field));
                
                if (hasRequiredFields) {
                    console.log('✅ Estructura de posts es válida');
                } else {
                    console.log('⚠️ Estructura de posts incompleta');
                }
            }
            
        } catch (error) {
            console.error('❌ Error en validación:', error.message);
        }
    }
}

// Ejecutar migración si se llama directamente
if (require.main === module) {
    const migration = new AirtableMigration();
    
    const args = process.argv.slice(2);
    const command = args[0] || 'migrate';
    
    switch (command) {
        case 'migrate':
            migration.createBackup()
                .then(() => migration.migrateAllPosts())
                .then(() => migration.validateMigration());
            break;
        case 'backup':
            migration.createBackup();
            break;
        case 'validate':
            migration.validateMigration();
            break;
        default:
            console.log('Comandos disponibles:');
            console.log('  node scripts/migrate-from-airtable.js migrate   - Migrar datos');
            console.log('  node scripts/migrate-from-airtable.js backup    - Crear backup');
            console.log('  node scripts/migrate-from-airtable.js validate  - Validar migración');
    }
}

module.exports = AirtableMigration;