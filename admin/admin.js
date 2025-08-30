// admin/admin.js
document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos del DOM
    const loginSection = document.getElementById('login-section');
    const adminPanel = document.getElementById('admin-panel');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutButton = document.getElementById('logout-button');
    
    // Nuevos elementos para utilidades
    const sitemapButton = document.getElementById('sitemap-button');
    const robotsButton = document.getElementById('robots-button');
    const utilidadesButton = document.getElementById('utilidades-button');
    const statsButton = document.getElementById('stats-button');


    const postForm = document.getElementById('post-form');
    const formTitle = document.getElementById('form-title');
    const postIdInput = document.getElementById('post-id');
    const cancelButton = document.getElementById('cancel-button');
    const postsList = document.getElementById('posts-list');
    const formError = document.getElementById('form-error');

    // Referencias para la búsqueda
    const searchInput = document.getElementById('search-input');
    const searchResultsCount = document.getElementById('search-results-count');
    const clearSearchButton = document.getElementById('clear-search');

    let authToken = null;
    let refreshToken = null;
    let allPosts = []; // Almacenar todos los posts para búsqueda local


    // --- LÓGICA DE AUTENTICACIÓN JWT SEGURA ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('password').value;
        
        if (!password || password.trim() === '') {
            loginError.textContent = 'La contraseña es requerida.';
            return;
        }
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                authToken = data.token;
                refreshToken = data.refreshToken;
                
                // Almacenar tokens de forma segura (httpOnly cookies sería mejor)
                sessionStorage.setItem('authToken', authToken);
                sessionStorage.setItem('refreshToken', refreshToken);
                
                // Limpiar campo de contraseña
                document.getElementById('password').value = '';
                
                showAdminPanel();
            } else {
                loginError.textContent = data.error || 'Credenciales incorrectas.';
                
                // Limpiar campo de contraseña en error
                document.getElementById('password').value = '';
            }
        } catch (error) {
            console.error('Login error:', error);
            loginError.textContent = 'Error de conexión con el servidor.';
        }
    });
    
    logoutButton.addEventListener('click', async () => {
        try {
            // Intentar logout en el servidor
            if (authToken) {
                await fetch('/api/logout', {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.warn('Error during server logout:', error);
        } finally {
            // Limpiar tokens locales
            authToken = null;
            refreshToken = null;
            sessionStorage.removeItem('authToken');
            sessionStorage.removeItem('refreshToken');
            showLogin();
        }
    });


    function showAdminPanel() {
        loginSection.style.display = 'none';
        adminPanel.style.display = 'block';
        loginError.textContent = '';
        fetchPosts();
        
        // Configurar botón de estadísticas cuando el panel esté visible
        setupStatsButton();
    }


    function showLogin() {
        loginSection.style.display = 'block';
        adminPanel.style.display = 'none';
    }
    
    // Verificar si hay tokens almacenados al cargar la página
    const storedToken = sessionStorage.getItem('authToken');
    const storedRefreshToken = sessionStorage.getItem('refreshToken');
    
    if (storedToken && storedRefreshToken) {
        authToken = storedToken;
        refreshToken = storedRefreshToken;
        
        // Verificar si el token sigue siendo válido
        verifyTokenAndShowPanel();
    }
    
    async function verifyTokenAndShowPanel() {
        try {
            const response = await fetch('/api/posts', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (response.ok) {
                showAdminPanel();
            } else if (response.status === 401) {
                // Token expirado, intentar refrescar
                const refreshed = await refreshAuthToken();
                if (refreshed) {
                    showAdminPanel();
                } else {
                    showLogin();
                }
            } else {
                showLogin();
            }
        } catch (error) {
            console.error('Token verification error:', error);
            showLogin();
        }
    }
    
    async function refreshAuthToken() {
        try {
            const response = await fetch('/api/refresh-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });
            
            if (response.ok) {
                const data = await response.json();
                authToken = data.token;
                sessionStorage.setItem('authToken', authToken);
                return true;
            }
        } catch (error) {
            console.error('Token refresh error:', error);
        }
        
        // Si falla el refresh, limpiar tokens
        authToken = null;
        refreshToken = null;
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('refreshToken');
        return false;
    }


    // --- LÓGICA DE GESTIÓN DE POSTS (CRUD) ---


    async function fetchPosts() {
        if (!authToken) {
            showLogin();
            return;
        }
        
        try {
            const response = await fetchWithAuth('/api/posts');
            
            if (!response) {
                showLogin();
                return;
            }
            
            if (response.ok) {
                const posts = await response.json();
                allPosts = posts; // Almacenar todos los posts para búsqueda
                renderPosts(posts);
                updateSearchResults(posts.length, posts.length);
            } else if (response.status === 401) {
                // Token expirado, intentar refrescar
                const refreshed = await refreshAuthToken();
                if (refreshed) {
                    // Reintentar la petición
                    fetchPosts();
                } else {
                    showLogin();
                }
            } else {
                console.error('Error fetching posts:', response.statusText);
            }
        } catch (error) {
            console.error('Error al obtener posts:', error);
        }
    }
    
    // Función auxiliar para hacer peticiones autenticadas
    async function fetchWithAuth(url, options = {}) {
        if (!authToken) {
            return null;
        }
        
        const authOptions = {
            ...options,
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        };
        
        try {
            return await fetch(url, authOptions);
        } catch (error) {
            console.error('Fetch with auth error:', error);
            return null;
        }
    }


    // Función segura para renderizar posts (evita XSS)
    function renderPosts(posts) {
        // Limpiar lista existente de forma segura
        while (postsList.firstChild) {
            postsList.removeChild(postsList.firstChild);
        }
        
        if (!posts || posts.length === 0) return;
        
        posts.forEach(post => {
            const li = document.createElement('li');
            li.dataset.id = post.id;
            
            // Crear contenedor principal del post
            const postHeader = document.createElement('div');
            postHeader.className = 'post-header';
            
            // Crear span para el título de forma segura
            const titleSpan = document.createElement('span');
            titleSpan.className = 'post-title';
            titleSpan.textContent = post.title || 'Sin título'; // Usar textContent para evitar XSS
            
            const dateSmall = document.createElement('small');
            const postDate = post.date ? new Date(post.date) : new Date();
            dateSmall.textContent = ` (${postDate.toLocaleDateString()})`;
            titleSpan.appendChild(dateSmall);
            
            // Crear div de acciones con iconos pequeños
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'post-actions-icons';
            
            // Botón editar con icono
            const editBtn = document.createElement('button');
            editBtn.className = 'action-icon edit-btn';
            editBtn.innerHTML = '✎';
            editBtn.title = 'Editar post';
            editBtn.type = 'button';
            
            // Botón eliminar con icono
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-icon delete-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = 'Eliminar post';
            deleteBtn.type = 'button';
            
            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(deleteBtn);
            
            // Ensamblar el header del post
            postHeader.appendChild(titleSpan);
            postHeader.appendChild(actionsDiv);
            
            li.appendChild(postHeader);
            postsList.appendChild(li);
        });
    }


    // Manejar envío del formulario (Crear o Actualizar)
    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        formError.textContent = ''; // Limpiar errores previos
        const id = postIdInput.value;
        const isUpdating = !!id;


        const postData = {
            title: document.getElementById('title').value,
            subtitle: document.getElementById('subtitle').value,
            author: document.getElementById('author').value,
            date: document.getElementById('date').value,
            imageUrl: document.getElementById('imageUrl').value,
            excerpt: document.getElementById('excerpt').value,
            content: document.getElementById('content').value,
            tags: document.getElementById('tags').value,
            metaTitle: document.getElementById('metaTitle').value,
            metaDescription: document.getElementById('metaDescription').value,
        };


        const url = isUpdating ? `/api/posts/${id}` : '/api/posts';
        const method = isUpdating ? 'PUT' : 'POST';


        try {
            const response = await fetchWithAuth(url, {
                method,
                body: JSON.stringify(postData)
            });


            if (response && response.ok) {
                // Solo resetear el formulario si es un post nuevo
                // Si se está editando, mantener el formulario en modo edición
                if (!isUpdating) {
                    resetForm();
                }
                
                // Actualizar la lista de posts
                fetchPosts();
                
                // Mostrar mensaje de confirmación
                if (isUpdating) {
                    formError.textContent = '';
                    const successMessage = document.createElement('div');
                    successMessage.textContent = 'Post actualizado correctamente';
                    successMessage.style.color = '#28a745';
                    successMessage.style.backgroundColor = '#d4edda';
                    successMessage.style.border = '1px solid #28a745';
                    successMessage.style.padding = '10px';
                    successMessage.style.marginTop = '1rem';
                    successMessage.style.textAlign = 'center';
                    
                    // Insertar el mensaje después del botón de guardar
                    const formButtons = document.querySelector('.form-buttons');
                    formButtons.parentNode.insertBefore(successMessage, formButtons.nextSibling);
                    
                    // Remover el mensaje después de 3 segundos
                    setTimeout(() => {
                        if (successMessage.parentNode) {
                            successMessage.parentNode.removeChild(successMessage);
                        }
                    }, 3000);
                }
            } else if (response) {
                const errorData = await response.json();
                const errorMessage = `Error: ${errorData.error || 'Error desconocido'}`;
                if (errorData.details && Array.isArray(errorData.details)) {
                    // Mostrar errores de validación
                    const validationErrors = errorData.details.map(d => d.message || d.field).join(', ');
                    formError.textContent = `${errorMessage}. ${validationErrors}`;
                } else {
                    formError.textContent = errorMessage;
                }
                console.error('Error al guardar:', errorData);
            } else {
                formError.textContent = 'Error de conexión al guardar el post.';
            }
        } catch (error) {
            formError.textContent = 'Error de conexión. Revisa la consola del navegador.';
            console.error('Error de conexión al guardar:', error);
        }
    });


    postsList.addEventListener('click', async (e) => {
        const target = e.target;
        const li = target.closest('li');
        if (!li) return;
        const id = li.dataset.id;


        if (target.classList.contains('edit-btn')) {
            try {
                const response = await fetchWithAuth('/api/posts');
                if (response && response.ok) {
                    const posts = await response.json();
                    const post = posts.find(p => p.id === id);
                    if (post) loadPostIntoForm(post);
                } else {
                    console.error('Error fetching posts for edit');
                }
            } catch (error) {
                console.error('Error loading post for edit:', error);
            }
        }
        if (target.classList.contains('delete-btn')) {
            deletePost(id);
        }
    });
    
    function loadPostIntoForm(post) {
        resetForm();
        formTitle.textContent = 'Editar Post';
        
        // Cargar datos de forma segura, validando cada campo
        postIdInput.value = post.id || '';
        
        // Sanitizar y cargar cada campo
        const fields = {
            'title': post.title || '',
            'subtitle': post.subtitle || '',
            'author': post.author || '',
            'date': post.date ? post.date.split('T')[0] : '',
            'imageUrl': post.imageUrl || '',
            'excerpt': post.excerpt || '',
            'content': post.content || '',
            'tags': post.tags || '',
            'metaTitle': post.metaTitle || '',
            'metaDescription': post.metaDescription || ''
        };
        
        Object.entries(fields).forEach(([fieldId, value]) => {
            const field = document.getElementById(fieldId);
            if (field) {
                // Para campos de texto, asegurarse de que el valor sea una cadena
                field.value = typeof value === 'string' ? value : String(value || '');
            }
        });
        
        cancelButton.style.display = 'inline-block';
        window.scrollTo(0, 0);
    }


    async function deletePost(id) {
        if (!confirm('¿Estás seguro de que quieres eliminar este post? Esta acción no se puede deshacer.')) {
            return;
        }
        try {
            const response = await fetchWithAuth(`/api/posts/${id}`, {
                method: 'DELETE'
            });
            
            if (response && response.ok) {
                fetchPosts();
            } else if (response) {
                const errorData = await response.json();
                alert(`Error al eliminar: ${errorData.error || errorData.details || 'Error desconocido'}`);
            } else {
                alert('Error de conexión al eliminar el post.');
            }
        } catch (error) {
            console.error('Error al eliminar:', error);
            alert('Error de conexión al eliminar el post.');
        }
    }


    function resetForm() {
        postForm.reset();
        postIdInput.value = '';
        formTitle.textContent = 'Añadir Nuevo Post';
        cancelButton.style.display = 'none';
        formError.textContent = '';
    }


    cancelButton.addEventListener('click', resetForm);

    // --- FUNCIONALIDAD DE LA BARRA DE HERRAMIENTAS ---
    
    // Manejar clics en los botones de la barra de herramientas
    document.addEventListener('click', (e) => {
        // Verificar si el elemento clicado o su padre es un botón de toolbar
        let button = e.target;
        
        // Si se hace clic en el contenido del botón (como el <strong>), buscar el botón padre
        if (!button.classList.contains('toolbar-btn') && button.parentElement) {
            button = button.parentElement;
        }
        
        if (button.classList.contains('toolbar-btn')) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Toolbar button clicked:', button); // Debug
            
            const fieldId = button.dataset.field;
            const action = button.dataset.action;
            const field = document.getElementById(fieldId);
            
            console.log('Field ID:', fieldId, 'Action:', action, 'Field:', field); // Debug
            
            if (!field) {
                console.error('Field not found:', fieldId);
                return;
            }
            
            if (action === 'bold') {
                insertFormatting(field, '<strong>', '</strong>');
            } else if (action === 'link') {
                insertLink(field);
            }
        }
    });

    function insertFormatting(field, startTag, endTag) {
        console.log('insertFormatting called with:', startTag, endTag); // Debug
        
        const start = field.selectionStart;
        const end = field.selectionEnd;
        const selectedText = field.value.substring(start, end);
        
        console.log('Selection:', start, end, 'Selected text:', selectedText); // Debug
        
        // Verificar que hay texto seleccionado
        if (!selectedText || selectedText.trim() === '') {
            alert('Debes seleccionar el texto que quieres formatear.');
            return;
        }
        
        const beforeText = field.value.substring(0, start);
        const afterText = field.value.substring(end);
        
        // Escapar el texto seleccionado para evitar XSS
        const escapedText = escapeHtml(selectedText);
        
        // Envolvemos el texto seleccionado con las etiquetas HTML
        field.value = beforeText + startTag + escapedText + endTag + afterText;
        
        // Posicionamos el cursor después del texto formateado
        const newCursorPos = start + startTag.length + escapedText.length + endTag.length;
        field.focus();
        field.setSelectionRange(newCursorPos, newCursorPos);
        
        console.log('Text formatted safely:', field.value.substring(start, start + startTag.length + escapedText.length + endTag.length)); // Debug
    }

    // Validador de URL segura
    function isValidURL(url) {
        try {
            const urlObj = new URL(url);
            // Solo permitir protocolos seguros
            return ['http:', 'https:'].includes(urlObj.protocol);
        } catch (error) {
            return false;
        }
    }
    
    // Escapar caracteres peligrosos en HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function insertLink(field) {
        console.log('insertLink called'); // Debug
        
        const start = field.selectionStart;
        const end = field.selectionEnd;
        const selectedText = field.value.substring(start, end);
        
        // Verificar que hay texto seleccionado
        if (!selectedText || selectedText.trim() === '') {
            alert('Debes seleccionar el texto al que quieres asignar el enlace.');
            return;
        }
        
        // Usamos setTimeout para asegurar que el prompt se maneje correctamente
        setTimeout(() => {
            const url = prompt('Introduce la URL del enlace:');
            if (url && url.trim() !== '') {
                const trimmedUrl = url.trim();
                
                // Validar URL antes de insertarla
                if (!isValidURL(trimmedUrl)) {
                    alert('La URL no es válida. Debe empezar con http:// o https://');
                    return;
                }
                
                // Procesamos el enlace inmediatamente
                setTimeout(() => {
                    const beforeText = field.value.substring(0, start);
                    const afterText = field.value.substring(end);
                    
                    // Escapar el texto seleccionado y la URL para evitar XSS
                    const escapedText = escapeHtml(selectedText);
                    const escapedUrl = escapeHtml(trimmedUrl);
                    
                    // Insertamos el enlace en formato HTML con target="_blank" usando texto escapado
                    const linkHtml = `<a href="${escapedUrl}" target="_blank">${escapedText}</a>`;
                    field.value = beforeText + linkHtml + afterText;
                    
                    // Posicionamos el cursor después del enlace
                    field.focus();
                    field.setSelectionRange(start + linkHtml.length, start + linkHtml.length);
                    
                    console.log('Link inserted safely:', linkHtml); // Debug
                }, 10);
            } else {
                console.log('Link insertion cancelled'); // Debug
            }
        }, 10);
    }

    // --- FUNCIONALIDAD DE BÚSQUEDA SÚPER EFECTIVA ---

    // Búsqueda en tiempo real con debounce para optimizar rendimiento
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch(e.target.value);
        }, 150); // Debounce de 150ms para evitar búsquedas excesivas
    });

    // Botón limpiar búsqueda
    clearSearchButton.addEventListener('click', () => {
        searchInput.value = '';
        performSearch('');
        clearSearchButton.style.display = 'none';
    });

    function performSearch(query) {
        const trimmedQuery = query.trim();
        
        if (trimmedQuery === '') {
            // Mostrar todos los posts si no hay búsqueda
            renderPosts(allPosts);
            updateSearchResults(allPosts.length, allPosts.length);
            clearSearchButton.style.display = 'none';
            return;
        }

        // Realizar búsqueda súper efectiva
        const filteredPosts = searchPosts(trimmedQuery);
        renderPosts(filteredPosts);
        updateSearchResults(filteredPosts.length, allPosts.length);
        clearSearchButton.style.display = 'inline-block';
    }

    function searchPosts(query) {
        const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
        
        return allPosts.filter(post => {
            // Campos en los que buscar
            const searchableText = [
                post.title || '',
                post.subtitle || '',
                post.excerpt || '',
                post.content || '',
                post.author || '',
                post.tags || ''
            ].join(' ').toLowerCase();

            // Remover HTML tags para buscar solo en texto
            const cleanText = searchableText.replace(/<[^>]*>/g, ' ');

            // Verificar que TODOS los términos de búsqueda estén presentes
            return searchTerms.every(term => {
                // Búsqueda flexible: coincidencias parciales y exactas
                return cleanText.includes(term) || 
                       // Búsqueda por palabras que empiecen con el término
                       cleanText.split(/\s+/).some(word => word.startsWith(term));
            });
        }).sort((a, b) => {
            // Ordenar por relevancia: primero los que coinciden en título
            const aTitle = (a.title || '').toLowerCase();
            const bTitle = (b.title || '').toLowerCase();
            const queryLower = query.toLowerCase();
            
            const aTitleMatch = aTitle.includes(queryLower);
            const bTitleMatch = bTitle.includes(queryLower);
            
            if (aTitleMatch && !bTitleMatch) return -1;
            if (!aTitleMatch && bTitleMatch) return 1;
            
            // Si ambos coinciden en título o ninguno, mantener orden por fecha
            return new Date(b.date || 0) - new Date(a.date || 0);
        });
    }

    function updateSearchResults(found, total) {
        if (searchInput.value.trim() === '') {
            searchResultsCount.textContent = `${total} posts`;
        } else {
            searchResultsCount.textContent = `${found} de ${total} posts encontrados`;
            
            // Resaltar visualmente si hay pocos resultados
            if (found === 0) {
                searchResultsCount.style.color = '#d93025';
                searchResultsCount.textContent = 'Sin resultados';
            } else if (found < 3) {
                searchResultsCount.style.color = '#f57c00';
            } else {
                searchResultsCount.style.color = '#28a745';
            }
        }
    }

    // Función segura para resaltar términos de búsqueda (sin XSS)
    function highlightSearchTerms(text, query) {
        if (!query || !text) return escapeHtml(text);
        
        // Escapar el texto primero
        const escapedText = escapeHtml(text);
        const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
        let highlightedText = escapedText;
        
        searchTerms.forEach(term => {
            // Escapar el término de búsqueda para evitar regex injection
            const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedTerm})`, 'gi');
            highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
        });
        
        return highlightedText;
    }
    
    // --- FUNCIONALIDAD DE UTILIDADES ---
    
    // Botón para generar sitemap
    sitemapButton.addEventListener('click', async () => {
        if (!confirm('¿Estás seguro de que quieres generar un nuevo sitemap.xml?')) {
            return;
        }
        
        try {
            sitemapButton.disabled = true;
            sitemapButton.textContent = '🔄 Generando...';
            
            // Obtener todos los posts para generar el sitemap
            const postsResponse = await fetchWithAuth('/api/posts');
            if (!postsResponse || !postsResponse.ok) {
                throw new Error('Error al obtener posts');
            }
            
            const posts = await postsResponse.json();
            
            // Generar contenido XML del sitemap
            const sitemapContent = generateSitemapXML(posts);
            
            // Enviar al servidor
            const response = await fetchWithAuth('/api/generate-sitemap', {
                method: 'POST',
                body: JSON.stringify({ content: sitemapContent })
            });
            
            if (response && response.ok) {
                const result = await response.json();
                alert(`✅ Sitemap generado exitosamente\n${result.urls} URLs incluidas`);
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Error al generar sitemap');
            }
            
        } catch (error) {
            console.error('Error generating sitemap:', error);
            alert('❌ Error al generar sitemap: ' + error.message);
        } finally {
            sitemapButton.disabled = false;
            sitemapButton.textContent = '📄 Generar Sitemap';
        }
    });
    
    // Botón para generar robots.txt
    robotsButton.addEventListener('click', async () => {
        if (!confirm('¿Estás seguro de que quieres generar un nuevo robots.txt?')) {
            return;
        }
        
        try {
            robotsButton.disabled = true;
            robotsButton.textContent = '🔄 Generando...';
            
            // Generar contenido del robots.txt
            const robotsContent = generateRobotsContent();
            
            // Enviar al servidor
            const response = await fetchWithAuth('/api/generate-robots', {
                method: 'POST',
                body: JSON.stringify({ content: robotsContent })
            });
            
            if (response && response.ok) {
                const result = await response.json();
                alert('✅ robots.txt generado exitosamente');
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Error al generar robots.txt');
            }
            
        } catch (error) {
            console.error('Error generating robots.txt:', error);
            alert('❌ Error al generar robots.txt: ' + error.message);
        } finally {
            robotsButton.disabled = false;
            robotsButton.textContent = '🤖 Generar Robots.txt';
        }
    });
    
    // Botón para acceder a utilidades
    utilidadesButton.addEventListener('click', () => {
        // Abrir utilidades en nueva ventana
        window.open('/admin/utilidades/', '_blank');
    });

    // Función para configurar el botón de estadísticas
    function setupStatsButton() {
        setTimeout(() => {
            const statsBtn = document.getElementById('stats-button');
            if (statsBtn) {
                statsBtn.onclick = function() {
                    if (!authToken) {
                        alert('Debes estar autenticado para ver las estadísticas');
                        return;
                    }
                    window.location.href = '/stats';
                };
            }
        }, 100);
    }
    
    // Funciones auxiliares para generar contenido
    function generateSitemapXML(posts) {
        const baseUrl = window.location.origin;
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
        
        // Página principal
        xml += `    <url>
        <loc>${baseUrl}/</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
    </url>
`;
        
        // Páginas estáticas
        const staticPages = [
            { url: '/sobre-economiable', priority: '0.8' },
            { url: '/suscribete', priority: '0.7' }
        ];
        
        staticPages.forEach(page => {
            xml += `    <url>
        <loc>${baseUrl}${page.url}</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>${page.priority}</priority>
    </url>
`;
        });
        
        // Posts
        posts.forEach(post => {
            if (post.slug) {
                const postDate = new Date(post.date).toISOString().split('T')[0];
                xml += `    <url>
        <loc>${baseUrl}/post/${post.slug}</loc>
        <lastmod>${postDate}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.9</priority>
    </url>
`;
            }
        });
        
        xml += `</urlset>`;
        return xml;
    }
    
    function generateRobotsContent() {
        const baseUrl = window.location.origin;
        return `User-agent: *
Allow: /

Disallow: /admin/
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml`;
    }
    
});