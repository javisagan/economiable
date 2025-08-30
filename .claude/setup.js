const fs = require('fs');
const path = require('path');

function createClaudeFolder() {
    const claudeDir = path.join(process.cwd(), '.claude');
    
    if (!fs.existsSync(claudeDir)) {
        fs.mkdirSync(claudeDir);
        console.log('📁 Carpeta .claude creada');
    }
    
    return claudeDir;
}

function detectProjectType() {
    const packagePath = path.join(process.cwd(), 'package.json');
    
    if (!fs.existsSync(packagePath)) {
        return { type: 'basic', mcps: ['github'] };
    }
    
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    const mcps = ['github']; // Siempre incluir GitHub
    let type = 'basic';
    
    if (deps['@supabase/supabase-js']) {
        mcps.push('supabase');
        type = 'supabase';
    }
    
    if (deps['react']) {
        type = type === 'basic' ? 'react' : `${type}-react`;
    }
    
    return { type, mcps };
}

function createEnvFile(claudeDir, projectInfo) {
    const envPath = path.join(claudeDir, 'env');
    
    if (fs.existsSync(envPath)) {
        console.log('✅ Archivo .claude/env ya existe');
        return;
    }
    
    let envContent = `# Configuración de Claude Code para este proyecto
# Tipo de proyecto detectado: ${projectInfo.type}
# Generado automáticamente el ${new Date().toLocaleString()}

# ========================================
# CONFIGURACIÓN DE MCPs
# ========================================

`;

    // Configurar MCPs según el proyecto
    projectInfo.mcps.forEach(mcp => {
        envContent += `MCP_${mcp.toUpperCase()}_ENABLED=true\n`;
    });
    
    envContent += `\n# ========================================
# TOKENS Y CREDENCIALES
# ========================================

`;

    // GitHub (siempre presente)
    envContent += `# GitHub Personal Access Token
# Obtenerlo en: https://github.com/settings/tokens
GITHUB_PERSONAL_ACCESS_TOKEN=

`;

    // Supabase si está presente
    if (projectInfo.mcps.includes('supabase')) {
        envContent += `# Supabase Configuration
# Obtenerlo en: https://supabase.com/dashboard/project/[tu-proyecto]/settings/api
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=

`;
    }
    
    envContent += `# ========================================
# CONFIGURACIÓN ADICIONAL
# ========================================

# Nombre del proyecto (opcional)
CLAUDE_PROJECT_NAME=${path.basename(process.cwd())}

# Debug mode (true/false)
CLAUDE_DEBUG=false
`;
    
    fs.writeFileSync(envPath, envContent);
    console.log('📝 Archivo .claude/env creado');
    console.log(`🎯 Proyecto tipo: ${projectInfo.type}`);
    console.log(`🔧 MCPs configurados: ${projectInfo.mcps.join(', ')}`);
}

function copyStartScript(claudeDir) {
    const scriptPath = path.join(claudeDir, 'start-claude.js');
    
    if (fs.existsSync(scriptPath)) {
        console.log('✅ Script start-claude.js ya existe');
        return;
    }
    
    // El contenido del script está en el paso anterior
    const scriptContent = fs.readFileSync(__filename, 'utf8');
    // Aquí deberías copiar el contenido real del start-claude.js
    // Por simplicidad, asumo que ya está creado
    
    console.log('📜 Script start-claude.js configurado');
}

function updateGitignore() {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    const claudeIgnore = '\n# Claude Code\n.claude/env\n';
    
    if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, 'utf8');
        if (!content.includes('.claude/env')) {
            fs.appendFileSync(gitignorePath, claudeIgnore);
            console.log('📄 .gitignore actualizado (agregado .claude/env)');
        }
    } else {
        fs.writeFileSync(gitignorePath, claudeIgnore);
        console.log('📄 .gitignore creado');
    }
}

// Función principal
function main() {
    console.log('🚀 Configurando Claude Code para este proyecto...\n');
    
    // Crear estructura
    const claudeDir = createClaudeFolder();
    const projectInfo = detectProjectType();
    
    // Crear archivos
    createEnvFile(claudeDir, projectInfo);
    updateGitignore();
    
    console.log('\n🎉 ¡Configuración completada!');
    console.log('\n📋 Próximos pasos:');
    console.log('1. Edita .claude/env con tus tokens reales');
    console.log('2. Ejecuta: npm run claude');
    console.log('\n💡 Los tokens no se subirán al repositorio (están en .gitignore)');
}

main();