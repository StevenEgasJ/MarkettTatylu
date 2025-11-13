const validUser = {
    username: "usuario",
    password: "123"
};

function checkLoggedIn() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    if (isLoggedIn === 'true' && loggedInUser) {
        updateAuthUI(true, loggedInUser);
        return true;
    }
    return false;
}

function updateAuthUI(isLoggedIn, username) {
    const navItems = document.querySelector('nav ul');
    if (!navItems) return;
    const loginItem = [...navItems.children].find(item => item.textContent.includes('Iniciar Sesión'));
    const registerItem = [...navItems.children].find(item => item.textContent.includes('Registrarse'));
    if (isLoggedIn) {
        if (loginItem) {
            loginItem.innerHTML = `<a href="#">Hola, ${username}</a>`;
        }
        if (registerItem) {
            registerItem.innerHTML = `<a href="#" id="logout-link">Cerrar Sesión</a>`;
            const logoutLink = document.getElementById('logout-link');
            if (logoutLink) {
                logoutLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    logout();
                });
            }
        }
    }
}

function logout() {
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('loggedInUser');
    alert('Has cerrado sesión correctamente.');
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    checkLoggedIn();
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorElement = document.getElementById('login-error');
            if (username === validUser.username && password === validUser.password) {
                sessionStorage.setItem('isLoggedIn', 'true');
                sessionStorage.setItem('loggedInUser', username);
                alert('¡Inicio de sesión exitoso!');
                window.location.href = 'index.html';
            } else {
                errorElement.textContent = 'Usuario o contraseña incorrectos. Intente nuevamente.';
            }
        });
    }
    const registroForm = document.getElementById('registro-form');
    if (registroForm) {
        registroForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('reg-username').value;
            const password = document.getElementById('reg-password').value;
            const confirmPassword = document.getElementById('reg-confirm-password').value;
            const errorElement = document.getElementById('registro-error');
            if (password !== confirmPassword) {
                errorElement.textContent = 'Las contraseñas no coinciden. Intente nuevamente.';
                return;
            }
            alert('¡Registro exitoso! Ahora puede iniciar sesión con sus credenciales.');
            window.location.href = 'login.html';
        });
    }
});
