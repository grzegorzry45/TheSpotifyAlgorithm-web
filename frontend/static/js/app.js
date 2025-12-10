// The Algorithm - Frontend JavaScript
// Handles all UI interactions and API communication

const API_BASE = '';  // Same origin
let authToken = localStorage.getItem('access_token');
let sessionId = null;
let playlistFiles = [];
let userTrackFiles = [];
let userSingleFile = null;
let referenceFile = null;

// Store current session data (for presets)
let currentPlaylistProfile = null;
let currentPlaylistAnalysis = null;

// Abort controllers for cancelling operations
let playlistAbortController = null;
let batchAbortController = null;
let compareAbortController = null;

// Track if any operation is in progress
let isProcessing = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded - App.js starting");
    // alert("DEBUG: JS is running! v2"); // Temporary debug alert
    
    initializeAuthUI();
    checkAuthAndRenderUI(); // Check auth status on page load

    if (authToken) {
        initializeTabs();
        initializeParameterSelection();
        initializePlaylistUpload();
        initializeUserTracksUpload();
        initializeSingleCompare();
        initializeRecommendations();
        initializeCancelButtons();
        initializeUnloadWarning();
        initializePresets();
        initializeCompareModeToggle();
    }
});

// ===== AUTHENTICATION =====

function getAuthHeaders(isJson = false) {
    const headers = new Headers();
    if (authToken) {
        headers.append('Authorization', `Bearer ${authToken}`);
    }
    if (isJson) {
        headers.append('Content-Type', 'application/json');
    }
    return headers;
}

function handleAuthError(response) {
    if (response.status === 401) {
        showError("Your session has expired. Please log in again.");
        logout();
        return true;
    }
    return false;
}

function logout() {
    localStorage.removeItem('access_token');
    authToken = null;
    window.location.reload(); 
}

function checkAuthAndRenderUI() {
    authToken = localStorage.getItem('access_token');
    const isLoggedIn = !!authToken;
    updateUIForAuth(isLoggedIn);
}

function updateUIForAuth(isLoggedIn) {
    const mainApp = document.getElementById('main-app-content');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (isLoggedIn) {
        mainApp.style.display = 'block';
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
    } else {
        mainApp.style.display = 'none';
        loginBtn.style.display = 'inline-block';
        registerBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
    }
}

function initializeAuthUI() {
    console.log("Initializing Auth UI");
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const logoutBtn = document.getElementById('logout-btn');

    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');

    const loginCancel = document.getElementById('login-cancel');
    const registerCancel = document.getElementById('register-cancel');

    const loginConfirm = document.getElementById('login-confirm');
    const registerConfirm = document.getElementById('register-confirm');

    if(loginBtn) loginBtn.addEventListener('click', () => {
        console.log("Login button clicked");
        if(loginModal) loginModal.style.display = 'flex';
    });
    if(registerBtn) registerBtn.addEventListener('click', () => {
        console.log("Register button clicked");
        if(registerModal) registerModal.style.display = 'flex';
    });
    
    if(loginCancel) loginCancel.addEventListener('click', () => loginModal.style.display = 'none');
    if(registerCancel) registerCancel.addEventListener('click', () => registerModal.style.display = 'none');

    if(logoutBtn) logoutBtn.addEventListener('click', logout);

    // Handle Login
    if(loginConfirm) loginConfirm.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        errorEl.textContent = '';

        const formData = new FormData();
        formData.append('username', email);
        formData.append('password', password);

        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('access_token', data.access_token);
                authToken = data.access_token;
                loginModal.style.display = 'none';
                window.location.reload();
            } else {
                const errorData = await response.json();
                errorEl.textContent = errorData.detail || 'Login failed.';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorEl.textContent = 'An error occurred.';
        }
    });

    // Handle Registration
    if(registerConfirm) registerConfirm.addEventListener('click', async () => {
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const passwordConfirm = document.getElementById('register-password-confirm').value;
        const errorEl = document.getElementById('register-error');
        errorEl.textContent = '';

        if (password !== passwordConfirm) {
            errorEl.textContent = 'Passwords do not match.';
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (response.ok) {
                registerModal.style.display = 'none';
                showSuccess('Registration successful! Please log in.');
                loginModal.style.display = 'flex';
            } else {
                const errorData = await response.json();
                errorEl.textContent = errorData.detail || 'Registration failed.';
            }
        } catch (error) {
            console.error('Registration error:', error);
            errorEl.textContent = 'An error occurred.';
        }
    });
}
// (The rest of the file content follows)
// ...