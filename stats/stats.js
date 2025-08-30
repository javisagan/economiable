// stats/stats.js
document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos del DOM
    const loginSection = document.getElementById('login-section');
    const statsPanel = document.getElementById('stats-panel');
    const errorMessage = document.getElementById('error-message');
    const logoutButton = document.getElementById('logout-button');
    const refreshButton = document.getElementById('refresh-button');
    
    // Elementos de estadísticas
    const homepageVisits = document.getElementById('homepage-visits');
    const postsCount = document.getElementById('posts-count');
    const totalVisits = document.getElementById('total-visits');
    const topReferrerName = document.getElementById('top-referrer-name');
    const topReferrerCount = document.getElementById('top-referrer-count');
    const postsTbody = document.getElementById('posts-tbody');
    const lastUpdated = document.getElementById('last-updated');
    
    // Elementos de analytics
    const referrersList = document.getElementById('referrers-list');
    const userAgentsList = document.getElementById('user-agents-list');
    const countriesList = document.getElementById('countries-list');
    
    let authToken = null;
    let refreshToken = null;

    // Verificar autenticación al cargar la página
    function checkAuthentication() {
        authToken = sessionStorage.getItem('authToken');
        refreshToken = sessionStorage.getItem('refreshToken');
        
        if (authToken) {
            verifyTokenAndLoadStats();
        } else {
            showLogin();
        }
    }

    // Verificar token y cargar estadísticas
    async function verifyTokenAndLoadStats() {
        try {
            const response = await fetch('/api/stats', {
                headers: { 
                    'Authorization': `Bearer ${authToken}`,
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                showStatsPanel();
                updateStatsDisplay(data);
            } else if (response.status === 401) {
                // Token expirado, intentar refrescar
                const refreshed = await refreshAuthToken();
                if (refreshed) {
                    verifyTokenAndLoadStats();
                } else {
                    showLogin();
                }
            } else {
                showError('Error al verificar autenticación');
                showLogin();
            }
        } catch (error) {
            console.error('Error verificando token:', error);
            showError('Error de conexión');
            showLogin();
        }
    }

    // Refrescar token de autenticación
    async function refreshAuthToken() {
        try {
            const response = await fetch('/api/refresh-token', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ refreshToken })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                authToken = data.token;
                sessionStorage.setItem('authToken', authToken);
                return true;
            } else {
                // Refresh token inválido o expirado
                clearTokens();
                return false;
            }
        } catch (error) {
            console.error('Error refreshing token:', error);
            clearTokens();
            return false;
        }
    }

    // Cargar estadísticas desde el servidor
    async function loadStats() {
        try {
            showLoading();
            
            const response = await fetch('/api/stats', {
                headers: { 
                    'Authorization': `Bearer ${authToken}`,
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                updateStatsDisplay(data);
                hideError();
            } else if (response.status === 401) {
                const refreshed = await refreshAuthToken();
                if (refreshed) {
                    loadStats(); // Retry con nuevo token
                } else {
                    showLogin();
                }
            } else {
                const errorData = await response.json();
                showError(errorData.error || 'Error al cargar estadísticas');
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            showError('Error de conexión con el servidor');
        }
    }

    // Actualizar la visualización de estadísticas
    function updateStatsDisplay(data) {
        // Actualizar contadores principales
        const homepageTotal = data.homepage.total || 0;
        homepageVisits.textContent = homepageTotal.toLocaleString();
        postsCount.textContent = data.posts.length.toLocaleString();
        totalVisits.textContent = data.totalVisits.toLocaleString();
        
        // Actualizar top referrer
        if (data.analytics.topReferrers.length > 0) {
            const topRef = data.analytics.topReferrers[0];
            topReferrerName.textContent = topRef.name;
            topReferrerCount.textContent = `${topRef.count.toLocaleString()} visitas`;
        } else {
            topReferrerName.textContent = 'N/A';
            topReferrerCount.textContent = '0 visitas';
        }
        
        // Actualizar analytics
        updateAnalyticsList(referrersList, data.analytics.topReferrers);
        updateAnalyticsList(userAgentsList, data.analytics.topUserAgents);
        updateAnalyticsList(countriesList, data.analytics.topCountries);
        
        // Actualizar tabla de posts
        updatePostsTable(data.posts);
        
        // Actualizar timestamp
        const now = new Date();
        lastUpdated.textContent = `Última actualización: ${now.toLocaleTimeString()}`;
    }

    // Actualizar tabla de posts
    function updatePostsTable(posts) {
        postsTbody.innerHTML = '';
        
        if (posts.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="5" class="no-data">No hay datos de visitas a posts todavía</td>';
            postsTbody.appendChild(row);
            return;
        }
        
        posts.forEach((post, index) => {
            const row = document.createElement('tr');
            
            const position = index + 1;
            const title = post.title || 'Sin título';
            const date = post.date ? formatDate(post.date) : 'Sin fecha';
            const visits = post.visits.toLocaleString();
            
            // Obtener top referrer del post
            let topReferrer = 'N/A';
            if (post.referrers && Object.keys(post.referrers).length > 0) {
                const topRef = Object.entries(post.referrers)
                    .sort((a, b) => b[1] - a[1])[0];
                topReferrer = `${topRef[0]} (${topRef[1]})`;
            }
            
            row.innerHTML = `
                <td><strong>#${position}</strong></td>
                <td>
                    <div style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${title}">
                        ${title}
                    </div>
                </td>
                <td>${date}</td>
                <td><strong>${visits}</strong> visitas</td>
                <td>
                    <div style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${topReferrer}">
                        ${topReferrer}
                    </div>
                </td>
            `;
            
            postsTbody.appendChild(row);
        });
    }

    // Formatear fecha
    function formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return dateString;
        }
    }

    // Actualizar lista de analytics
    function updateAnalyticsList(container, data) {
        container.innerHTML = '';
        
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="no-data">Sin datos disponibles</div>';
            return;
        }
        
        const maxCount = data[0]?.count || 1;
        
        data.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'analytics-item';
            
            const percentage = (item.count / maxCount) * 100;
            
            itemElement.innerHTML = `
                <div class="analytics-name" title="${item.name}">${item.name}</div>
                <div class="analytics-count">${item.count.toLocaleString()}</div>
                <div class="analytics-bar">
                    <div class="analytics-bar-fill" style="width: ${percentage}%"></div>
                </div>
            `;
            
            container.appendChild(itemElement);
        });
    }

    // Mostrar loading
    function showLoading() {
        postsTbody.innerHTML = '<tr><td colspan="5" class="loading">Actualizando estadísticas...</td></tr>';
        
        // Loading para analytics
        referrersList.innerHTML = '<div class="loading">Actualizando...</div>';
        userAgentsList.innerHTML = '<div class="loading">Actualizando...</div>';
        countriesList.innerHTML = '<div class="loading">Actualizando...</div>';
    }

    // Mostrar panel de estadísticas
    function showStatsPanel() {
        loginSection.style.display = 'none';
        statsPanel.style.display = 'block';
        hideError();
    }

    // Mostrar pantalla de login
    function showLogin() {
        loginSection.style.display = 'flex';
        statsPanel.style.display = 'none';
        hideError();
    }

    // Mostrar error
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }

    // Ocultar error
    function hideError() {
        errorMessage.style.display = 'none';
    }

    // Limpiar tokens
    function clearTokens() {
        authToken = null;
        refreshToken = null;
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('refreshToken');
    }

    // Logout
    async function logout() {
        try {
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
            clearTokens();
            showLogin();
        }
    }

    // Event listeners
    refreshButton.addEventListener('click', loadStats);
    logoutButton.addEventListener('click', logout);

    // Auto-refresh cada 5 minutos
    setInterval(() => {
        if (authToken && statsPanel.style.display === 'block') {
            loadStats();
        }
    }, 5 * 60 * 1000);

    // Inicializar
    checkAuthentication();
});