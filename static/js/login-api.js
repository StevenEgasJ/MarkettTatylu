document.addEventListener("DOMContentLoaded", function() {
    // Si ya está logueado, ir al index
    if (localStorage.getItem('userLoggedIn') === 'true') {
        window.location.href = "index.html";
        return;
    }

    const loginForm = document.getElementById("loginForm");
    if (!loginForm) return;

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("email").value.trim().toLowerCase();
        const password = document.getElementById("password").value;

        // Validación básica
        if (!email || !password) {
            Swal.fire({ title: 'Campos requeridos', text: 'Por favor ingresa email y contraseña', icon: 'error', confirmButtonText: 'OK' });
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            Swal.fire({ title: 'Email inválido', text: 'Por favor ingresa un email válido', icon: 'error', confirmButtonText: 'OK' });
            return;
        }

        // Admin local shortcut
        if (email === 'admin@gmail.com' && password === '123456') {
            await Swal.fire({ title: '¡Bienvenido Administrador!', text: 'Accediendo al panel de administración...', icon: 'success', confirmButtonText: 'Continuar' });
            localStorage.setItem('adminLoggedIn', 'true');
            localStorage.setItem('adminEmail', 'admin@gmail.com');
            localStorage.setItem('adminName', 'Administrador');
            localStorage.setItem('loginTimestamp', Date.now().toString());
            window.location.href = 'admin.html';
            return;
        }

        // Check API availability. When reachable, require server-based login (persisted in Atlas).
        let apiAvailable = false;
        try {
            if (window.api && typeof window.api.ping === 'function') {
                apiAvailable = await window.api.ping();
            }
        } catch (err) {
            apiAvailable = false;
        }

        if (apiAvailable) {
            try {
                if (window.api && typeof window.api.login === 'function') {
                    const res = await window.api.login({ email, password });
                    if (res && res.token) {
                        localStorage.setItem('token', res.token);
                        localStorage.setItem('userLoggedIn', 'true');
                        localStorage.setItem('userEmail', res.user.email);
                        localStorage.setItem('userNombre', res.user.nombre || '');
                        localStorage.setItem('userApellido', res.user.apellido || '');
                        if (res.user.photo) localStorage.setItem('userPhoto', res.user.photo);
                        // Try to load server-side cart into localStorage
                        try {
                            if (window.api && typeof window.api.getCart === 'function') {
                                let serverCartRes = await window.api.getCart();
                                const serverCart = Array.isArray(serverCartRes) ? serverCartRes : (serverCartRes && serverCartRes.cart) ? serverCartRes.cart : [];
                                if (Array.isArray(serverCart) && serverCart.length > 0) {
                                    // map to local shape if necessary
                                    const mapped = serverCart.map(item => ({ id: item.id || item._id || item.productId, nombre: item.nombre || item.name || '', precio: item.precio || item.price || 0, imagen: item.imagen || item.image || '', mililitros: item.mililitros || item.capacidad || 'N/A', cantidad: item.cantidad || item.quantity || item.qty || 1 }));
                                    localStorage.setItem('carrito', JSON.stringify(mapped));
                                }
                            }
                        } catch (err) {
                            console.warn('Could not load server cart:', err);
                        }
                        window.location.href = 'index.html';
                        return;
                    }
                }
                // Server rejected login or returned unexpected response
                console.error('Login failed on server or unexpected response');
                await Swal.fire({ title: 'Error de autenticación', text: 'No se pudo iniciar sesión en el servidor. Por favor verifica tus credenciales o intenta más tarde.', icon: 'error', confirmButtonText: 'OK' });
                return; // Block local fallback when server is reachable
            } catch (err) {
                console.error('API login error (server reachable):', err);
                const message = extractApiError(err) || 'Hubo un error al comunicarse con el servidor. Intenta más tarde.';
                await Swal.fire({ title: 'No se pudo iniciar sesión en el servidor', html: `<div>${escapeHtml(message)}</div>`, icon: 'error', confirmButtonText: 'OK' });
                return;
            }
        }

        // Fallback: comprobar en localStorage
        const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers')) || [];
        const user = registeredUsers.find(u => u.email.toLowerCase() === email && u.password === password);
        if (user) {
            localStorage.setItem('userLoggedIn', 'true');
            localStorage.setItem('userEmail', user.email);
            localStorage.setItem('userNombre', user.nombre || '');
            localStorage.setItem('userApellido', user.apellido || '');
            if (user.photo) localStorage.setItem('userPhoto', user.photo);
            window.location.href = 'index.html';
            return;
        }

        Swal.fire({ title: 'Error de autenticación', text: 'Email o contraseña incorrectos.', icon: 'error' });
    });

    // Solicitar permisos de notificación al cargar la página
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

// Helper: extract error message from API errors (same helpers as in singUp.js)
function extractApiError(err) {
    if (!err) return null;
    try {
        const parsed = JSON.parse(err.message);
        if (parsed && parsed.error) return parsed.error;
    } catch (e) {}
    return err.message || String(err);
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[&<>"'`]/g, function (m) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[m];
    });
}
