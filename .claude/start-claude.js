const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Cargar variables de entorno desde .claude/env
function loadClaudeEnv() {
    const envPath = path.join(__dirname, 'env');
    
    if (!fs.existsSync(envPath)) {
        console.log('❌ No se encontró .claude/env');
        console.log('💡 Ejecuta: npm run setup-claude');
        process.exit(1);
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    envContent.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        
        // Ignorar comentarios y líneas vacías
        if (!trimmedLine || trimmedLine.startsWith('#')) return;
        
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            process.env[key.trim()] = value;
        }
    });
}

// Configurar MCPs según las variables
function buildMcpArgs() {
    const args = [];
    
    // GitHub MCP
    if (process.env.MCP_GITHUB_ENABLED === 'true' && process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
        args.push('--mcp-server', 'github=npx @modelcontextprotocol/server-github');
        console.log('✅ GitHub MCP habilitado');
    }
    
    // Supabase MCP  
    if (process.env.MCP_SUPABASE_ENABLED === 'true' && 
        process.env.SUPABASE_URL && 
        process.env.SUPABASE_ANON_KEY) {
        args.push('--mcp-server', 'supabase=npx @modelcontextprotocol/server-supabase');
        console.log('✅ Supabase MCP habilitado');
    }
    
    return args;
}

// Función principal
function main() {
    console.log('🚀 Iniciando Claude Code con configuración específica del proyecto...\n');
    
    // Cargar configuración del proyecto
    loadClaudeEnv();
    
    const projectName = process.env.CLAUDE_PROJECT_NAME || path.basename(process.cwd());
    console.log(`📁 Proyecto: ${projectName}`);
    
    // Configurar MCPs
    const mcpArgs = buildMcpArgs();
    
    if (mcpArgs.length === 0) {
        console.log('\n⚠️  No se configuraron MCPs o faltan tokens');
        console.log('💡 Revisa tu archivo .claude/env');
        return;
    }
    
    console.log(`\n🔧 Iniciando con ${mcpArgs.length / 2} MCP(s) configurado(s)...\n`);
    
    // Iniciar Claude Code
    const claude = spawn('claude-code', mcpArgs, {
        stdio: 'inherit',
        env: process.env,
        cwd: path.resolve(__dirname, '..')
    });
    
    claude.on('close', (code) => {
        if (code !== 0) {
            console.log(`\n❌ Claude Code terminó con código ${code}`);
        } else {
            console.log('\n👋 ¡Hasta la próxima!');
        }
    });
    
    // Manejar cierre limpio
    process.on('SIGINT', () => {
        console.log('\n⏹️  Cerrando Claude Code...');
        claude.kill('SIGINT');
    });
}

main();