// admin/admin.js
document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos del DOM
    const loginSection = document.getElementById('login-section');
    const adminPanel = document.getElementById('admin-panel');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutButton = document.getElementById('logout-button');


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

    let adminPassword = null;
    let allPosts = []; // Almacenar todos los posts para búsqueda local


    // --- LÓGICA DE AUTENTICACIÓN ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('password').value;
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            if (response.ok) {
                adminPassword = password;
                sessionStorage.setItem('adminPassword', password);
                showAdminPanel();
            } else {
                loginError.textContent = 'Contraseña incorrecta.';
            }
        } catch (error) {
            loginError.textContent = 'Error de conexión con el servidor.';
        }
    });
    
    logoutButton.addEventListener('click', () => {
        adminPassword = null;
        sessionStorage.removeItem('adminPassword');
        showLogin();
    });


    function showAdminPanel() {
        loginSection.style.display = 'none';
        adminPanel.style.display = 'block';
        loginError.textContent = '';
        fetchPosts();
    }


    function showLogin() {
        loginSection.style.display = 'block';
        adminPanel.style.display = 'none';
    }
    
    if (sessionStorage.getItem('adminPassword')) {
        adminPassword = sessionStorage.getItem('adminPassword');
        showAdminPanel();
    }


    // --- LÓGICA DE GESTIÓN DE POSTS (CRUD) ---


    async function fetchPosts() {
        if (!adminPassword) return;
        try {
            const response = await fetch('/api/posts', {
                headers: { 'Authorization': adminPassword }
            });
            if (response.status === 401) {
                showLogin();
                return;
            }
            const posts = await response.json();
            allPosts = posts; // Almacenar todos los posts para búsqueda
            renderPosts(posts);
            updateSearchResults(posts.length, posts.length);
        } catch (error) {
            console.error('Error al obtener posts:', error);
        }
    }


    function renderPosts(posts) {
        postsList.innerHTML = '';
        if (!posts || posts.length === 0) return;
        posts.forEach(post => {
            const li = document.createElement('li');
            li.dataset.id = post.id;
            li.innerHTML = `
                <span>${post.title} <small>(${new Date(post.date).toLocaleDateString()})</small></span>
                <div class="post-actions">
                    <button class="edit-btn">Editar</button>
                    <button class="delete-btn">Eliminar</button>
                </div>
            `;
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
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': adminPassword
                },
                body: JSON.stringify(postData)
            });


            if (response.ok) {
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
            } else {
                const errorData = await response.json();
                const errorMessage = `Error: ${errorData.error} Detalles: ${errorData.details || 'Sin detalles.'}`;
                formError.textContent = errorMessage;
                console.error('Error al guardar:', errorData);
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
            const response = await fetch('/api/posts', { headers: { 'Authorization': adminPassword }});
            const posts = await response.json();
            const post = posts.find(p => p.id === id);
            if (post) loadPostIntoForm(post);
        }
        if (target.classList.contains('delete-btn')) {
            deletePost(id);
        }
    });
    
    function loadPostIntoForm(post) {
        resetForm();
        formTitle.textContent = 'Editar Post';
        postIdInput.value = post.id;
        document.getElementById('title').value = post.title || '';
        document.getElementById('subtitle').value = post.subtitle || '';
        document.getElementById('author').value = post.author || '';
        document.getElementById('date').value = post.date ? post.date.split('T')[0] : '';
        document.getElementById('imageUrl').value = post.imageUrl || '';
        document.getElementById('excerpt').value = post.excerpt || '';
        document.getElementById('content').value = post.content || '';
        document.getElementById('tags').value = post.tags || '';
        document.getElementById('metaTitle').value = post.metaTitle || '';
        document.getElementById('metaDescription').value = post.metaDescription || '';
        
        cancelButton.style.display = 'inline-block';
        window.scrollTo(0, 0);
    }


    async function deletePost(id) {
        if (!confirm('¿Estás seguro de que quieres eliminar este post? Esta acción no se puede deshacer.')) {
            return;
        }
        try {
            const response = await fetch(`/api/posts/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': adminPassword }
            });
            if (response.ok) {
                fetchPosts();
            } else {
                const errorData = await response.json();
                alert(`Error al eliminar: ${errorData.details}`);
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
            alert('Debes seleccionar el texto que quieres poner en negrita.');
            return;
        }
        
        const beforeText = field.value.substring(0, start);
        const afterText = field.value.substring(end);
        
        // Envolvemos el texto seleccionado con las etiquetas HTML
        field.value = beforeText + startTag + selectedText + endTag + afterText;
        
        // Posicionamos el cursor después del texto formateado
        field.focus();
        field.setSelectionRange(start + startTag.length + selectedText.length + endTag.length, start + startTag.length + selectedText.length + endTag.length);
        
        console.log('New field value:', field.value); // Debug
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
                // Procesamos el enlace inmediatamente
                setTimeout(() => {
                    const beforeText = field.value.substring(0, start);
                    const afterText = field.value.substring(end);
                    
                    // Insertamos el enlace en formato HTML con target="_blank" usando el texto seleccionado
                    const linkHtml = `<a href="${url.trim()}" target="_blank">${selectedText}</a>`;
                    field.value = beforeText + linkHtml + afterText;
                    
                    // Posicionamos el cursor después del enlace
                    field.focus();
                    field.setSelectionRange(start + linkHtml.length, start + linkHtml.length);
                    
                    console.log('Link inserted:', linkHtml); // Debug
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

    // Mejorar la función renderPosts para resaltar términos de búsqueda
    function highlightSearchTerms(text, query) {
        if (!query || !text) return text;
        
        const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
        let highlightedText = text;
        
        searchTerms.forEach(term => {
            const regex = new RegExp(`(${term})`, 'gi');
            highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
        });
        
        return highlightedText;
    }
});