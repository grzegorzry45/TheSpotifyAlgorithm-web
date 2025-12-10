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

    // TEMPORARILY DISABLED: Authentication suspended for public beta
    // initializeAuthUI();
    checkAuthAndRenderUI(); // Check auth status on page load (now always shows app)

    // Always initialize app features (no auth check)
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
    initializeCollapsibleSections();

    /* ORIGINAL CODE - COMMENTED OUT FOR PUBLIC BETA
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
        initializeCollapsibleSections(); // New call
    }
    */
});

// ===== COLLAPSIBLE SECTIONS =====
function initializeCollapsibleSections() {
    const headers = document.querySelectorAll('.collapsible-header');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.dataset.target;
            const content = document.getElementById(targetId);
            if (content) {
                header.classList.toggle('active');
                content.classList.toggle('collapsed');
                // Adjust max-height for smooth transition
                if (content.classList.contains('collapsed')) {
                    content.style.maxHeight = null;
                } else {
                    content.style.maxHeight = content.scrollHeight + "px";
                }
            }
        });
    });
}


// ===== AUTHENTICATION =====

function getAuthHeaders(isJson = false) {
    const headers = new Headers();

    // TEMPORARILY DISABLED: Authentication suspended for public beta
    // No authorization header sent
    /* ORIGINAL CODE - COMMENTED OUT FOR PUBLIC BETA
    if (authToken) {
        headers.append('Authorization', `Bearer ${authToken}`);
    }
    */

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

    // TEMPORARILY DISABLED: Authentication suspended for public beta
    // Always show main app and hide auth buttons
    if (mainApp) mainApp.style.display = 'block';
    if (loginBtn) loginBtn.style.display = 'none';
    if (registerBtn) registerBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';

    /* ORIGINAL CODE - COMMENTED OUT FOR PUBLIC BETA
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
    */
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

    console.log("Elements check:", {
        loginBtn: !!loginBtn,
        loginModal: !!loginModal,
        registerBtn: !!registerBtn,
        registerModal: !!registerModal
    });

    if(loginBtn) loginBtn.addEventListener('click', () => {
        console.log("Login button clicked");
        if(loginModal) {
            // Fix: Move to body if nested inside hidden container
            if (loginModal.parentNode !== document.body) {
                document.body.appendChild(loginModal);
            }
            loginModal.style.display = 'flex';
        }
    });
    if(registerBtn) registerBtn.addEventListener('click', () => {
        console.log("Register button clicked");
        if(registerModal) {
             // Fix: Move to body if nested inside hidden container
            if (registerModal.parentNode !== document.body) {
                document.body.appendChild(registerModal);
            }
            registerModal.style.display = 'flex';
        }
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


function initializeUnloadWarning() {
    window.addEventListener('beforeunload', (e) => {
        if (isProcessing) {
            e.preventDefault();
            e.returnValue = 'Analysis is in progress. If you leave now, you will lose all progress. Are you sure?';
            return e.returnValue;
        }
    });
}

// ===== PROGRESS STAGE HELPERS =====
function updateProgressStage(containerId, stageName, state) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const stages = container.querySelectorAll('.progress-stage');
    stages.forEach(stage => {
        const stageData = stage.getAttribute('data-stage');
        if (stageData === stageName) {
            stage.className = `progress-stage ${state}`;
        }
    });
}

function resetProgressStages(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const stages = container.querySelectorAll('.progress-stage');
    stages.forEach(stage => {
        stage.className = 'progress-stage pending';
    });
}

// ===== TRACK NAME DISPLAY HELPERS =====
function displayTrackName(containerId, filename, onRemove) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    const trackElement = document.createElement('div');
    trackElement.className = 'track-name';
    trackElement.innerHTML = `
        <span>${filename}</span>
        <button class="remove-track">├Ś</button>
    `;

    trackElement.querySelector('.remove-track').addEventListener('click', onRemove);
    container.appendChild(trackElement);
}

function clearTrackName(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
}

// ===== CANCEL BUTTONS =====
function initializeCancelButtons() {
    // Cancel playlist analysis
    document.getElementById('cancel-playlist-btn').addEventListener('click', () => {
        if (playlistAbortController) {
            playlistAbortController.abort();
            document.getElementById('playlist-progress-text').textContent = 'Analysis cancelled by user';
            document.getElementById('playlist-progress-fill').style.width = '0%';
            document.getElementById('analyze-playlist-btn').disabled = false;
        }
    });

    // Cancel batch comparison
    document.getElementById('cancel-batch-btn').addEventListener('click', () => {
        if (batchAbortController) {
            batchAbortController.abort();
            document.getElementById('batch-progress-text').textContent = 'Comparison cancelled by user';
            document.getElementById('batch-progress-fill').style.width = '0%';
            document.getElementById('compare-batch-btn').disabled = false;
        }
    });

    // Cancel single comparison
    document.getElementById('cancel-compare-btn').addEventListener('click', () => {
        if (compareAbortController) {
            compareAbortController.abort();
            document.getElementById('compare-progress-text').textContent = 'Comparison cancelled by user';
            document.getElementById('compare-progress-fill').style.width = '0%';
            updateCompareBtnState();
        }
    });
}

// ===== TAB NAVIGATION =====
function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;

            // Update buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update content
            tabContents.forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${targetTab}-tab`).classList.add('active');
        });
    });
}

// ===== PARAMETER SELECTION =====
function initializeParameterSelection() {
    // Listen to checkbox changes to validate analyze button state
    const playlistCheckboxes = document.querySelectorAll('input[name="param"]');
    playlistCheckboxes.forEach(cb => {
        cb.addEventListener('change', updateAnalyzeButtonState);
    });

    const compareCheckboxes = document.querySelectorAll('input[name="param-compare"]');
    compareCheckboxes.forEach(cb => {
        cb.addEventListener('change', updateCompareBtnState);
    });
}

function updateAnalyzeButtonState() {
    const analyzeBtn = document.getElementById('analyze-playlist-btn');
    const selectedParams = getSelectedParameters();
    const hasFiles = playlistFiles.length >= 2 && playlistFiles.length <= 30;
    const hasParams = selectedParams.length > 0;

    analyzeBtn.disabled = !hasFiles || !hasParams;
}

function getSelectedParameters() {
    // Get checked parameters from Analyze Playlist tab
    const checkboxes = document.querySelectorAll('input[name="param"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function getSelectedParametersCompare() {
    // Get checked parameters from Compare tab
    const checkboxes = document.querySelectorAll('input[name="param-compare"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// ===== PLAYLIST UPLOAD & ANALYSIS =====
function initializePlaylistUpload() {
    const uploadZone = document.getElementById('playlist-upload');
    const fileInput = document.getElementById('playlist-files');
    const fileList = document.getElementById('playlist-file-list');
    const analyzeBtn = document.getElementById('analyze-playlist-btn');

    // Click to browse
    uploadZone.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', (e) => {
        handlePlaylistFiles(Array.from(e.target.files));
    });

    // Drag & drop
    setupDragDrop(uploadZone, handlePlaylistFiles);

    // Analyze button
    analyzeBtn.addEventListener('click', analyzePlaylist);
}

function handlePlaylistFiles(files) {
    playlistFiles = files.filter(f =>
        f.name.toLowerCase().match(/\.(mp3|wav|flac)$/)
    );

    const fileList = document.getElementById('playlist-file-list');

    fileList.innerHTML = '';

    playlistFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <span>${file.name}</span>
            <button class="remove-file" data-index="${index}">├Ś</button>
        `;
        fileList.appendChild(item);

        item.querySelector('.remove-file').addEventListener('click', (e) => {
            e.stopPropagation();
            playlistFiles.splice(index, 1);
            handlePlaylistFiles(playlistFiles);
        });
    });

    // Update analyze button state based on files AND parameters
    updateAnalyzeButtonState();

    if (playlistFiles.length > 0 && playlistFiles.length < 2) {
        showError('Please upload at least 2 tracks');
    } else if (playlistFiles.length > 30) {
        showError('Maximum 30 tracks allowed');
    }
}

async function analyzePlaylist() {
    const selectedParams = getSelectedParameters();

    // Validate that parameters are selected
    if (selectedParams.length === 0) {
        showError('Please select at least one parameter to analyze');
        return;
    }

    const progressContainer = document.getElementById('playlist-progress');
    const progressFill = document.getElementById('playlist-progress-fill');
    const progressText = document.getElementById('playlist-progress-text');
    const resultsPanel = document.getElementById('playlist-results');
    const analyzeBtn = document.getElementById('analyze-playlist-btn');

    // Create new abort controller
    playlistAbortController = new AbortController();
    isProcessing = true;

    analyzeBtn.disabled = true;
    progressContainer.style.display = 'block';
    resultsPanel.style.display = 'none';
    resetProgressStages('playlist-progress-stages');

    try {
        // Upload files
        updateProgressStage('playlist-progress-stages', 'upload', 'active');
        progressText.textContent = 'Uploading files to server...';
        progressFill.style.width = '20%';

        const formData = new FormData();
        playlistFiles.forEach(file => formData.append('files', file));

        const uploadResponse = await fetch(`${API_BASE}/api/upload/playlist`, {
            method: 'POST',
            body: formData,
            headers: getAuthHeaders(),
            signal: playlistAbortController.signal
        });

        if (handleAuthError(uploadResponse)) return;
        if (!uploadResponse.ok) {
            throw new Error('Upload failed');
        }

        const uploadData = await uploadResponse.json();
        sessionId = uploadData.session_id;
        document.getElementById('session-id').textContent = sessionId;

        updateProgressStage('playlist-progress-stages', 'upload', 'completed');

        // Analyze playlist
        updateProgressStage('playlist-progress-stages', 'analyze', 'active');
        progressText.textContent = 'Analyzing audio features...';
        progressFill.style.width = '50%';

        const selectedParams = getSelectedParameters();

        const analyzeResponse = await fetch(`${API_BASE}/api/analyze/playlist`, {
            method: 'POST',
            headers: getAuthHeaders(true),
            body: JSON.stringify({
                session_id: sessionId,
                additional_params: selectedParams
            }),
            signal: playlistAbortController.signal
        });

        if (handleAuthError(analyzeResponse)) return;
        if (!analyzeResponse.ok) {
            throw new Error('Analysis failed');
        }

        const analyzeData = await analyzeResponse.json();

        updateProgressStage('playlist-progress-stages', 'analyze', 'completed');

        // Create profile
        updateProgressStage('playlist-progress-stages', 'profile', 'active');
        progressText.textContent = 'Creating sonic profile...';
        progressFill.style.width = '80%';

        // Simulate profile creation delay
        await new Promise(resolve => setTimeout(resolve, 300));

        updateProgressStage('playlist-progress-stages', 'profile', 'completed');

        // Complete
        updateProgressStage('playlist-progress-stages', 'complete', 'active');
        progressFill.style.width = '100%';
        progressText.textContent = 'Analysis complete!';

        // Store profile for presets
        currentPlaylistProfile = analyzeData.profile;
        currentPlaylistAnalysis = analyzeData.playlist_analysis || [];

        // Show results
        displayPlaylistProfile(analyzeData.profile);
        document.getElementById('has-playlist-profile').textContent = 'true';

        updateProgressStage('playlist-progress-stages', 'complete', 'completed');

        setTimeout(() => {
            progressContainer.style.display = 'none';
            resultsPanel.style.display = 'block';
        }, 800);

    } catch (error) {
        console.error('Error:', error);
        if (error.name === 'AbortError') {
            progressText.textContent = 'Analysis cancelled by user';
        } else {
            progressText.textContent = 'Error: ' + error.message;
        }
        progressFill.style.width = '0%';
    } finally {
        analyzeBtn.disabled = false;
        playlistAbortController = null;
        isProcessing = false;
    }
}

function displayPlaylistProfile(profile) {
    const container = document.getElementById('playlist-profile-data');
    container.innerHTML = '';

    // Complete parameter mapping with labels and formatters
    const parameterMap = {
        // Core parameters (always displayed first)
        'bpm': { label: 'BPM', format: (v) => v.toFixed(1), order: 1 },
        'energy': { label: 'Energy', format: (v) => v.toFixed(2), order: 2 },
        'loudness': { label: 'Loudness', format: (v) => v.toFixed(1) + ' LUFS', order: 3 },
        'spectral_centroid': { label: 'Brightness', format: (v) => v.toFixed(0) + ' Hz', order: 4 },
        'dynamic_range': { label: 'Dynamic Range', format: (v) => v.toFixed(1) + ' dB', order: 5 },

        // Tier 1: Spectral
        'spectral_rolloff': { label: 'Spectral Rolloff', format: (v) => v.toFixed(0) + ' Hz', order: 10 },
        'spectral_flatness': { label: 'Spectral Flatness', format: (v) => v.toFixed(3), order: 11 },
        'zero_crossing_rate': { label: 'Zero Crossing Rate', format: (v) => v.toFixed(0), order: 12 },

        // Tier 1B: Energy Distribution
        'low_energy': { label: 'Low Energy', format: (v) => (v * 100).toFixed(1) + '%', order: 20 },
        'mid_energy': { label: 'Mid Energy', format: (v) => (v * 100).toFixed(1) + '%', order: 21 },
        'high_energy': { label: 'High Energy', format: (v) => (v * 100).toFixed(1) + '%', order: 22 },

        // Tier 2: Perceptual
        'danceability': { label: 'Danceability', format: (v) => v.toFixed(2), order: 30 },
        'beat_strength': { label: 'Beat Strength', format: (v) => v.toFixed(2), order: 31 },
        'sub_bass_presence': { label: 'Sub-Bass Presence', format: (v) => v.toFixed(2), order: 32 },
        'stereo_width': { label: 'Stereo Width', format: (v) => v.toFixed(2), order: 33 },
        'valence': { label: 'Valence (Mood)', format: (v) => v.toFixed(2), order: 34 },
        'key_confidence': { label: 'Key Confidence', format: (v) => v.toFixed(2), order: 35 },

        // Tier 3: Production
        'loudness_range': { label: 'Loudness Range (LRA)', format: (v) => v.toFixed(1) + ' LU', order: 40 },
        'true_peak': { label: 'True Peak', format: (v) => v.toFixed(1) + ' dBTP', order: 41 },
        'crest_factor': { label: 'Crest Factor', format: (v) => v.toFixed(1) + ' dB', order: 42 },
        'spectral_contrast': { label: 'Spectral Contrast', format: (v) => v.toFixed(2), order: 43 },
        'transient_energy': { label: 'Transient Energy', format: (v) => v.toFixed(2), order: 44 },
        'harmonic_to_noise_ratio': { label: 'Harmonic/Noise Ratio', format: (v) => v.toFixed(1) + ' dB', order: 45 },

        // Tier 4: Compositional
        'harmonic_complexity': { label: 'Harmonic Complexity', format: (v) => v.toFixed(2), order: 50 },
        'melodic_range': { label: 'Melodic Range', format: (v) => v.toFixed(0) + ' semitones', order: 51 },
        'rhythmic_density': { label: 'Rhythmic Density', format: (v) => v.toFixed(2), order: 52 },
        'arrangement_density': { label: 'Arrangement Density', format: (v) => v.toFixed(2), order: 53 },
        'repetition_score': { label: 'Repetition Score', format: (v) => v.toFixed(2), order: 54 },
        'frequency_occupancy': { label: 'Frequency Occupancy', format: (v) => (v * 100).toFixed(1) + '%', order: 55 },
        'timbral_diversity': { label: 'Timbral Diversity', format: (v) => v.toFixed(2), order: 56 },
        'vocal_instrumental_ratio': { label: 'Vocal/Instrumental', format: (v) => v.toFixed(2), order: 57 },
        'energy_curve': { label: 'Energy Curve', format: (v) => v.toFixed(2), order: 58 },
        'call_response_presence': { label: 'Call-Response', format: (v) => v.toFixed(2), order: 59 }
    };

    // Collect all parameters that exist in profile
    const paramsToDisplay = [];
    Object.keys(profile).forEach(key => {
        if (parameterMap[key]) {
            // Handle nested structure: profile[key] = {mean: x, std: y, ...}
            let value;
            if (typeof profile[key] === 'object' && profile[key].mean !== undefined) {
                value = profile[key].mean;
            } else if (typeof profile[key] === 'number') {
                value = profile[key];
            } else {
                return; // Skip if not a valid value
            }

            if (!isNaN(value) && isFinite(value)) {
                paramsToDisplay.push({
                    key: key,
                    label: parameterMap[key].label,
                    value: parameterMap[key].format(value),
                    order: parameterMap[key].order
                });
            }
        }
    });

    // Sort by order
    paramsToDisplay.sort((a, b) => a.order - b.order);

    // Display all parameters
    paramsToDisplay.forEach(param => {
        const item = document.createElement('div');
        item.className = 'profile-item';
        item.innerHTML = `
            <div class="label">${param.label}</div>
            <div class="value">${param.value}</div>
        `;
        container.appendChild(item);
    });

    // Show message if no parameters
    if (paramsToDisplay.length === 0) {
        container.innerHTML = '<p class="placeholder">No parameters available</p>';
    }
}

// ===== USER TRACKS UPLOAD & BATCH COMPARISON =====
function initializeUserTracksUpload() {
    const uploadZone = document.getElementById('user-tracks-upload');
    const fileInput = document.getElementById('user-track-files');
    const fileList = document.getElementById('user-file-list');
    const compareBtn = document.getElementById('compare-batch-btn');

    uploadZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        handleUserTrackFiles(Array.from(e.target.files));
    });

    setupDragDrop(uploadZone, handleUserTrackFiles);
    compareBtn.addEventListener('click', compareBatch);
}

function handleUserTrackFiles(files) {
    userTrackFiles = files.filter(f =>
        f.name.toLowerCase().match(/\.(mp3|wav|flac)$/)
    );

    const fileList = document.getElementById('user-file-list');
    const compareBtn = document.getElementById('compare-batch-btn');

    fileList.innerHTML = '';

    userTrackFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <span>${file.name}</span>
            <button class="remove-file" data-index="${index}">├Ś</button>
        `;
        fileList.appendChild(item);

        item.querySelector('.remove-file').addEventListener('click', (e) => {
            e.stopPropagation();
            userTrackFiles.splice(index, 1);
            handleUserTrackFiles(userTrackFiles);
        });
    });

    const hasProfile = document.getElementById('has-playlist-profile').textContent === 'true';
    compareBtn.disabled = userTrackFiles.length === 0 || !hasProfile;
}

async function compareBatch() {
    const selectedParams = getSelectedParameters();

    // Validate that parameters are selected
    if (selectedParams.length === 0) {
        showError('Please select at least one parameter to analyze');
        return;
    }

    if (!sessionId) {
        showError('Please analyze playlist first');
        return;
    }

    const progressContainer = document.getElementById('batch-progress');
    const progressFill = document.getElementById('batch-progress-fill');
    const progressText = document.getElementById('batch-progress-text');
    const compareBtn = document.getElementById('compare-batch-btn');

    // Create new abort controller
    batchAbortController = new AbortController();
    isProcessing = true;

    compareBtn.disabled = true;
    progressContainer.style.display = 'block';
    resetProgressStages('batch-progress-stages');

    try {
        // Upload user tracks
        updateProgressStage('batch-progress-stages', 'upload', 'active');
        progressText.textContent = 'Uploading your tracks...';
        progressFill.style.width = '15%';

        const formData = new FormData();
        userTrackFiles.forEach(file => formData.append('files', file));
        formData.append('session_id', sessionId);

        const uploadResponse = await fetch(`${API_BASE}/api/upload/user-tracks?session_id=${sessionId}`, {
            method: 'POST',
            body: formData,
            headers: getAuthHeaders(),
            signal: batchAbortController.signal
        });

        if (handleAuthError(uploadResponse)) return;
        if (!uploadResponse.ok) {
            throw new Error('Upload failed');
        }

        updateProgressStage('batch-progress-stages', 'upload', 'completed');

        // Analyze tracks
        updateProgressStage('batch-progress-stages', 'analyze', 'active');
        progressText.textContent = 'Analyzing audio features...';
        progressFill.style.width = '40%';

        // Compare tracks
        updateProgressStage('batch-progress-stages', 'compare', 'active');
        progressText.textContent = 'Comparing vs playlist profile...';
        progressFill.style.width = '60%';

        const selectedParams = getSelectedParameters();

        const compareResponse = await fetch(`${API_BASE}/api/compare/batch`, {
            method: 'POST',
            headers: getAuthHeaders(true),
            body: JSON.stringify({
                session_id: sessionId,
                additional_params: selectedParams
            }),
            signal: batchAbortController.signal
        });

        if (handleAuthError(compareResponse)) return;
        if (!compareResponse.ok) {
            throw new Error('Comparison failed');
        }

        const compareData = await compareResponse.json();

        updateProgressStage('batch-progress-stages', 'analyze', 'completed');
        updateProgressStage('batch-progress-stages', 'compare', 'completed');

        // Generate recommendations
        updateProgressStage('batch-progress-stages', 'recommendations', 'active');
        progressText.textContent = 'Generating recommendations...';
        progressFill.style.width = '85%';

        // Simulate recommendations generation delay
        await new Promise(resolve => setTimeout(resolve, 300));

        updateProgressStage('batch-progress-stages', 'recommendations', 'completed');

        // Complete
        updateProgressStage('batch-progress-stages', 'complete', 'active');
        progressFill.style.width = '100%';
        progressText.textContent = 'Comparison complete!';

        // Show recommendations
        displayRecommendations(compareData.recommendations);

        updateProgressStage('batch-progress-stages', 'complete', 'completed');

        // Switch to recommendations tab
        setTimeout(() => {
            progressContainer.style.display = 'none';
            document.querySelector('[data-tab="recommendations"]').click();
        }, 800);

    } catch (error) {
        console.error('Error:', error);
        if (error.name === 'AbortError') {
            progressText.textContent = 'Comparison cancelled by user';
        } else {
            progressText.textContent = 'Error: ' + error.message;
        }
        progressFill.style.width = '0%';
    } finally {
        compareBtn.disabled = false;
        batchAbortController = null;
        isProcessing = false;
    }
}

// ===== SINGLE TRACK COMPARISON =====
function initializeSingleCompare() {
    const modeInputs = document.querySelectorAll('input[name="compare-mode"]');
    const referenceSection = document.getElementById('reference-section');
    const userUploadZone = document.getElementById('user-single-upload');
    const userFileInput = document.getElementById('user-single-file');
    const refUploadZone = document.getElementById('reference-upload');
    const refFileInput = document.getElementById('reference-file');
    const compareBtn = document.getElementById('compare-single-btn');

    // Mode switch
    modeInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            referenceSection.style.display = e.target.value === 'track' ? 'block' : 'none';
            updateCompareBtnState();
        });
    });

    // User track upload
    userUploadZone.addEventListener('click', () => userFileInput.click());
    userFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            userSingleFile = e.target.files[0];
            displayTrackName('user-single-name', userSingleFile.name, () => {
                userSingleFile = null;
                clearTrackName('user-single-name');
                updateCompareBtnState();
            });
            updateCompareBtnState();
        }
    });
    setupDragDrop(userUploadZone, (files) => {
        if (files.length > 0) {
            userSingleFile = files[0];
            displayTrackName('user-single-name', userSingleFile.name, () => {
                userSingleFile = null;
                clearTrackName('user-single-name');
                updateCompareBtnState();
            });
            updateCompareBtnState();
        }
    });

    // Reference track upload
    refUploadZone.addEventListener('click', () => refFileInput.click());
    refFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            referenceFile = e.target.files[0];
            displayTrackName('reference-name', referenceFile.name, () => {
                referenceFile = null;
                clearTrackName('reference-name');
                updateCompareBtnState();
            });
            updateCompareBtnState();
        }
    });
    setupDragDrop(refUploadZone, (files) => {
        if (files.length > 0) {
            referenceFile = files[0];
            displayTrackName('reference-name', referenceFile.name, () => {
                referenceFile = null;
                clearTrackName('reference-name');
                updateCompareBtnState();
            });
            updateCompareBtnState();
        }
    });

    // Compare button
    compareBtn.addEventListener('click', compareSingleTrack);
}

function updateCompareBtnState() {
    const mode = document.querySelector('input[name="compare-mode"]:checked').value;
    const compareBtn = document.getElementById('compare-single-btn');
    const hasProfile = document.getElementById('has-playlist-profile').textContent === 'true';

    if (mode === 'playlist') {
        compareBtn.disabled = !userSingleFile || !hasProfile;
    } else {
        compareBtn.disabled = !userSingleFile || !referenceFile;
    }
}

async function compareSingleTrack() {
    const selectedParams = getSelectedParametersCompare();

    // Validate that parameters are selected
    if (selectedParams.length === 0) {
        showError('Please select at least one parameter to analyze');
        return;
    }

    if (!sessionId && document.querySelector('input[name="compare-mode"]:checked').value === 'playlist') {
        // Create session if comparing vs playlist
        const formData = new FormData();
        const dummyFile = new File([''], 'dummy.mp3');
        for (let i = 0; i < 15; i++) formData.append('files', dummyFile);

        try {
            const response = await fetch(`${API_BASE}/api/upload/playlist`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: formData
            });
            if (handleAuthError(response)) return;
            const data = await response.json();
            sessionId = data.session_id;
        } catch (error) {
            showError('Please analyze playlist first');
            return;
        }
    }

    const mode = document.querySelector('input[name="compare-mode"]:checked').value;
    const progressContainer = document.getElementById('compare-progress');
    const progressFill = document.getElementById('compare-progress-fill');
    const progressText = document.getElementById('compare-progress-text');
    const resultsPanel = document.getElementById('compare-results');
    const compareBtn = document.getElementById('compare-single-btn');

    // Create new abort controller
    compareAbortController = new AbortController();
    isProcessing = true;

    compareBtn.disabled = true;
    progressContainer.style.display = 'block';
    resultsPanel.style.display = 'none';
    resetProgressStages('compare-progress-stages');

    try {
        // Upload tracks
        updateProgressStage('compare-progress-stages', 'upload', 'active');
        progressText.textContent = 'Uploading tracks...';
        progressFill.style.width = '15%';

        const formData = new FormData();
        formData.append('mode', mode);
        formData.append('user_track', userSingleFile);
        if (mode === 'track' && referenceFile) {
            formData.append('reference_track', referenceFile);
        }
        if (sessionId && sessionId !== 'null') {
            formData.append('session_id', sessionId);
        }

        // Get selected parameters
        const selectedParams = getSelectedParametersCompare();

        // Add parameters to formData
        if (selectedParams.length > 0) {
            formData.append('additional_params', JSON.stringify(selectedParams));
        }

        updateProgressStage('compare-progress-stages', 'upload', 'completed');

        // Analyze your track
        updateProgressStage('compare-progress-stages', 'analyze-user', 'active');
        progressText.textContent = 'Analyzing your track...';
        progressFill.style.width = '35%';

        // Analyze reference track (if 1:1 mode)
        if (mode === 'track') {
            updateProgressStage('compare-progress-stages', 'analyze-user', 'completed');
            updateProgressStage('compare-progress-stages', 'analyze-ref', 'active');
            progressText.textContent = 'Analyzing reference track...';
            progressFill.style.width = '55%';
        }

        // Compare
        updateProgressStage('compare-progress-stages', 'compare', 'active');
        progressText.textContent = 'Comparing parameters...';
        progressFill.style.width = '75%';

        const response = await fetch(`${API_BASE}/api/compare/single`, {
            method: 'POST',
            body: formData,
            headers: getAuthHeaders(),
            signal: compareAbortController.signal
        });

        if (handleAuthError(response)) return;
        if (!response.ok) {
            throw new Error('Comparison failed');
        }

        const data = await response.json();

        if (mode === 'playlist') {
            updateProgressStage('compare-progress-stages', 'analyze-user', 'completed');
            // Hide analyze-ref stage for playlist mode
            const refStage = document.querySelector('#compare-progress-stages [data-stage="analyze-ref"]');
            if (refStage) refStage.style.display = 'none';
        } else {
            updateProgressStage('compare-progress-stages', 'analyze-ref', 'completed');
        }

        updateProgressStage('compare-progress-stages', 'compare', 'completed');

        // Complete
        updateProgressStage('compare-progress-stages', 'complete', 'active');
        progressFill.style.width = '100%';
        progressText.textContent = 'Comparison complete!';

        // Display results
        displaySingleComparison(data);

        updateProgressStage('compare-progress-stages', 'complete', 'completed');

        setTimeout(() => {
            progressContainer.style.display = 'none';
            resultsPanel.style.display = 'block';
            // Reset ref stage visibility for next comparison
            const refStage = document.querySelector('#compare-progress-stages [data-stage="analyze-ref"]');
            if (refStage) refStage.style.display = '';
        }, 800);

    } catch (error) {
        console.error('Error:', error);
        if (error.name === 'AbortError') {
            progressText.textContent = 'Comparison cancelled by user';
        } else {
            progressText.textContent = 'Error: ' + error.message;
        }
        progressFill.style.width = '0%';
    } finally {
        compareBtn.disabled = false;
        compareAbortController = null;
        isProcessing = false;
    }
}

function displaySingleComparison(data) {
    const container = document.getElementById('compare-data');
    container.innerHTML = '';

    const comparison = data.comparison;
    const userTrack = data.user_track;
    const refData = data.mode === 'playlist' ? data.playlist_profile : data.reference_track;

    // Complete parameter mapping with labels and formatters
    const parameterMap = {
        // Core parameters
        'bpm': { label: 'BPM', format: (v) => v.toFixed(1) },
        'energy': { label: 'Energy', format: (v) => v.toFixed(2) },
        'loudness': { label: 'Loudness', format: (v) => v.toFixed(1) + ' LUFS' },
        'spectral_centroid': { label: 'Brightness', format: (v) => v.toFixed(0) + ' Hz' },
        'dynamic_range': { label: 'Dynamic Range', format: (v) => v.toFixed(1) + ' dB' },

        // Tier 1: Spectral
        'spectral_rolloff': { label: 'Spectral Rolloff', format: (v) => v.toFixed(0) + ' Hz' },
        'spectral_flatness': { label: 'Spectral Flatness', format: (v) => v.toFixed(3) },
        'zero_crossing_rate': { label: 'Zero Crossing Rate', format: (v) => v.toFixed(0) },

        // Tier 1B: Energy Distribution
        'low_energy': { label: 'Low Energy', format: (v) => (v * 100).toFixed(1) + '%' },
        'mid_energy': { label: 'Mid Energy', format: (v) => (v * 100).toFixed(1) + '%' },
        'high_energy': { label: 'High Energy', format: (v) => (v * 100).toFixed(1) + '%' },

        // Tier 2: Perceptual
        'danceability': { label: 'Danceability', format: (v) => v.toFixed(2) },
        'beat_strength': { label: 'Beat Strength', format: (v) => v.toFixed(2) },
        'sub_bass_presence': { label: 'Sub-Bass Presence', format: (v) => v.toFixed(2) },
        'stereo_width': { label: 'Stereo Width', format: (v) => v.toFixed(2) },
        'valence': { label: 'Valence (Mood)', format: (v) => v.toFixed(2) },
        'key_confidence': { label: 'Key Confidence', format: (v) => v.toFixed(2) },

        // Tier 3: Production
        'loudness_range': { label: 'Loudness Range (LRA)', format: (v) => v.toFixed(1) + ' LU' },
        'true_peak': { label: 'True Peak', format: (v) => v.toFixed(1) + ' dBTP' },
        'crest_factor': { label: 'Crest Factor', format: (v) => v.toFixed(1) + ' dB' },
        'spectral_contrast': { label: 'Spectral Contrast', format: (v) => v.toFixed(2) },
        'transient_energy': { label: 'Transient Energy', format: (v) => v.toFixed(2) },
        'harmonic_to_noise_ratio': { label: 'Harmonic/Noise Ratio', format: (v) => v.toFixed(1) + ' dB' },

        // Tier 4: Compositional
        'harmonic_complexity': { label: 'Harmonic Complexity', format: (v) => v.toFixed(2) },
        'melodic_range': { label: 'Melodic Range', format: (v) => v.toFixed(0) + ' semitones' },
        'rhythmic_density': { label: 'Rhythmic Density', format: (v) => v.toFixed(2) },
        'arrangement_density': { label: 'Arrangement Density', format: (v) => v.toFixed(2) },
        'repetition_score': { label: 'Repetition Score', format: (v) => v.toFixed(2) },
        'frequency_occupancy': { label: 'Frequency Occupancy', format: (v) => (v * 100).toFixed(1) + '%' },
        'timbral_diversity': { label: 'Timbral Diversity', format: (v) => v.toFixed(2) },
        'vocal_instrumental_ratio': { label: 'Vocal/Instrumental', format: (v) => v.toFixed(2) },
        'energy_curve': { label: 'Energy Curve', format: (v) => v.toFixed(2) },
        'call_response_presence': { label: 'Call-Response', format: (v) => v.toFixed(2) }
    };

    // Helper function to get value (handles both nested and flat structure)
    const getValue = (obj, key) => {
        if (obj[key] === undefined) return undefined;
        // Handle nested structure (profile): {mean: x, std: y, ...}
        if (typeof obj[key] === 'object' && obj[key].mean !== undefined) {
            return obj[key].mean;
        }
        // Handle flat structure (track): just a number
        return obj[key];
    };

    // Find all numeric parameters that exist in both tracks
    const displayedParams = [];

    // First add the core parameters if they exist
    const coreOrder = ['bpm', 'energy', 'loudness', 'spectral_centroid', 'dynamic_range', 'danceability'];
    coreOrder.forEach(key => {
        const userVal = getValue(userTrack, key);
        const refVal = getValue(refData, key);
        if (userVal !== undefined && refVal !== undefined && typeof userVal === 'number' && typeof refVal === 'number') {
            displayedParams.push(key);
        }
    });

    // Then add all other parameters that exist in both tracks
    Object.keys(parameterMap).forEach(key => {
        if (!coreOrder.includes(key)) {
            const userVal = getValue(userTrack, key);
            const refVal = getValue(refData, key);
            if (userVal !== undefined && refVal !== undefined && typeof userVal === 'number' && typeof refVal === 'number') {
                displayedParams.push(key);
            }
        }
    });

    // Display all found parameters
    displayedParams.forEach(key => {
        const param = parameterMap[key];
        if (!param) return;

        const userVal = getValue(userTrack, key);
        const refVal = getValue(refData, key);
        const diff = userVal - refVal;
        const diffPercent = refVal !== 0 ? (diff / refVal * 100).toFixed(1) : '0.0';

        const row = document.createElement('div');
        row.className = 'comparison-row';
        row.innerHTML = `
            <div class="param-name">${param.label}</div>
            <div class="param-value">Your: ${param.format(userVal)}</div>
            <div class="param-value">Target: ${param.format(refVal)}</div>
            <div class="param-diff ${diff > 0 ? 'positive' : 'negative'}">
                ${diff > 0 ? '+' : ''}${diffPercent}%
            </div>
        `;
        container.appendChild(row);
    });

    // Display recommendations if available
    if (data.recommendations && data.recommendations.length > 0) {
        displaySingleRecommendations(data.recommendations);
    }
}

function displaySingleRecommendations(recommendations) {
    const container = document.getElementById('recommendations-list');
    container.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'recommendation-card';
    card.innerHTML = '<h4>RECOMMENDATIONS</h4>';

    recommendations.forEach(rec => {
        const item = document.createElement('div');
        item.className = 'recommendation-item';
        item.innerHTML = `
            <div class="category">${rec.category || 'General'}</div>
            <div class="suggestion">${rec.suggestion}</div>
        `;
        card.appendChild(item);
    });

    container.appendChild(card);

    // Show export button
    document.getElementById('generate-report-btn').style.display = 'block';
}

// ===== RECOMMENDATIONS =====
function initializeRecommendations() {
    const exportBtn = document.getElementById('generate-report-btn');
    exportBtn.addEventListener('click', generateReport);
}

function displayRecommendations(recommendations) {
    const container = document.getElementById('recommendations-list');
    container.innerHTML = '';

    recommendations.forEach(rec => {
        const card = document.createElement('div');
        card.className = 'recommendation-card';
        card.innerHTML = `<h4>${rec.filename}</h4>`;

        if (rec.recommendations && rec.recommendations.length > 0) {
            rec.recommendations.forEach(item => {
                const recItem = document.createElement('div');
                recItem.className = 'recommendation-item';
                recItem.innerHTML = `
                    <div class="category">${item.category || 'General'}</div>
                    <div class="suggestion">${item.suggestion}</div>
                `;
                card.appendChild(recItem);
            });
        }

        container.appendChild(card);
    });

    // Show export button
    document.getElementById('generate-report-btn').style.display = 'block';
}

async function generateReport() {
    if (!sessionId) {
        showError('No data to export');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/report/generate`, {
            method: 'POST',
            headers: getAuthHeaders(true),
            body: JSON.stringify({ session_id: sessionId })
        });

        if (handleAuthError(response)) return;
        if (!response.ok) {
            throw new Error('Report generation failed');
        }

        const data = await response.json();

        // Download report
        window.open(`${API_BASE}${data.report_url}`, '_blank');

    } catch (error) {
        console.error('Error:', error);
        showError('Failed to generate report');
    }
}

// ===== UTILITY FUNCTIONS =====
function setupDragDrop(element, handler) {
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        element.classList.add('drag-over');
    });

    element.addEventListener('dragleave', () => {
        element.classList.remove('drag-over');
    });

    element.addEventListener('drop', (e) => {
        e.preventDefault();
        element.classList.remove('drag-over');

        const files = Array.from(e.dataTransfer.files).filter(f =>
            f.name.toLowerCase().match(/\.(mp3|wav|flac)$/)
        );

        if (files.length > 0) {
            handler(files);
        }
    });
}

function showError(message) {
    // Simple error display - could be enhanced with a modal
    console.error(message);
    alert(message);
}

function showSuccess(message) {
    console.log(message);
}

// ===== PRESETS MANAGEMENT =====
const PresetManager = {
    STORAGE_KEY: 'playlist_presets',

    // Get all presets from localStorage
    getAll() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    },

    // Save preset
    save(preset) {
        const presets = this.getAll();
        preset.id = Date.now().toString();
        preset.createdAt = new Date().toISOString();
        presets.push(preset);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(presets));
        return preset.id;
    },

    // Get single preset by ID
    get(id) {
        const presets = this.getAll();
        return presets.find(p => p.id === id);
    },

    // Update preset
    update(id, updates) {
        const presets = this.getAll();
        const index = presets.findIndex(p => p.id === id);
        if (index !== -1) {
            presets[index] = { ...presets[index], ...updates };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(presets));
            return true;
        }
        return false;
    },

        // Delete preset


        delete(id) {


            const presets = this.getAll();


            const filtered = presets.filter(p => p.id !== id);


            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));


            return true;


        },


    


        // Export preset to JSON file


        exportPreset(id) {


            const preset = this.get(id);


            if (!preset) return false;


    


            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(preset));


            const downloadAnchorNode = document.createElement('a');


            downloadAnchorNode.setAttribute("href", dataStr);


            downloadAnchorNode.setAttribute("download", `${preset.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_preset.json`);


            document.body.appendChild(downloadAnchorNode); // required for firefox


            downloadAnchorNode.click();


            downloadAnchorNode.remove();


            return true;


        },


    


        // Import preset from JSON file


        importPreset(file) {


            return new Promise((resolve, reject) => {


                const reader = new FileReader();


                reader.onload = (e) => {


                    try {


                        const preset = JSON.parse(e.target.result);


                        // Basic validation


                        if (!preset.name || !preset.profile) {


                            reject(new Error("Invalid preset file structure"));


                            return;


                        }


                        


                        // Generate new ID to avoid collisions


                        preset.id = Date.now().toString();


                        preset.createdAt = new Date().toISOString();


                        


                        this.save(preset);


                        resolve(preset);


                    } catch (error) {


                        reject(error);


                    }


                };


                reader.onerror = () => reject(new Error("Error reading file"));


                reader.readAsText(file);


            });


        }


    };


    


    // Initialize presets functionality


    function initializePresets() {


        const saveBtn = document.getElementById('save-preset-btn');


        const presetModal = document.getElementById('preset-modal');


        const presetNameInput = document.getElementById('preset-name-input');


        const presetSaveConfirm = document.getElementById('preset-save-confirm');


        const presetSaveCancel = document.getElementById('preset-save-cancel');


    


        const renameModal = document.getElementById('rename-modal');


        const renameInput = document.getElementById('rename-input');


        const renameConfirm = document.getElementById('rename-confirm');


        const renameCancel = document.getElementById('rename-cancel');


    


        const loadPresetModal = document.getElementById('load-preset-modal');


        const showPresetModalBtn = document.getElementById('show-preset-modal-btn');


        const loadPresetCancel = document.getElementById('load-preset-cancel');


        


        // Import functionality


        const importPresetBtn = document.getElementById('import-preset-btn');


        const importPresetFile = document.getElementById('import-preset-file');


    


        if (importPresetBtn && importPresetFile) {


            importPresetBtn.addEventListener('click', () => importPresetFile.click());


            importPresetFile.addEventListener('change', async (e) => {


                const file = e.target.files[0];


                if (!file) return;


    


                try {


                    await PresetManager.importPreset(file);


                    showSuccess(`Preset imported successfully!`);


                    displayPresetsList();


                    // Clear input


                    importPresetFile.value = '';


                } catch (error) {


                    showError(`Failed to import preset: ${error.message}`);


                }


            });


        }


    


        let currentRenameId = null;


        let currentProfileToSave = null;


    

    // Display presets list on page load
    displayPresetsList();

    // Show load preset modal
    showPresetModalBtn.addEventListener('click', () => {
        displayComparePresetsList(); // Populate the list right before showing
        loadPresetModal.style.display = 'flex';
    });

    // Hide load preset modal
    loadPresetCancel.addEventListener('click', () => {
        loadPresetModal.style.display = 'none';
    });

    // Save preset button
    saveBtn.addEventListener('click', () => {
        // Get current session profile
        if (!currentPlaylistProfile) {
            showError('No playlist profile to save. Analyze a playlist first.');
            return;
        }

        // Store profile temporarily
        currentProfileToSave = {
            profile: currentPlaylistProfile,
            analysis: currentPlaylistAnalysis,
            sessionId: sessionId
        };

        // Show modal
        presetNameInput.value = '';
        presetModal.style.display = 'flex';
        presetNameInput.focus();
    });

    // Confirm save
    presetSaveConfirm.addEventListener('click', () => {
        const name = presetNameInput.value.trim();
        if (!name) {
            showError('Please enter a preset name');
            return;
        }

        if (!currentProfileToSave) {
            showError('No profile data to save');
            return;
        }

        // Save to localStorage
        const preset = {
            name: name,
            profile: currentProfileToSave.profile,
            analysis: currentProfileToSave.analysis,
            tracksCount: currentProfileToSave.analysis ? currentProfileToSave.analysis.length : 0
        };

        PresetManager.save(preset);
        presetModal.style.display = 'none';
        currentProfileToSave = null;

        // Refresh both lists
        displayPresetsList();
        showSuccess(`Preset "${name}" saved successfully!`);
    });

    // Cancel save
    presetSaveCancel.addEventListener('click', () => {
        presetModal.style.display = 'none';
        currentProfileToSave = null;
    });

    // Close modal on Escape
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            presetModal.style.display = 'none';
            renameModal.style.display = 'none';
            loadPresetModal.style.display = 'none';
            currentProfileToSave = null;
            currentRenameId = null;
        }
    });

    // Rename modal handlers
    renameConfirm.addEventListener('click', () => {
        const newName = renameInput.value.trim();
        if (!newName) {
            showError('Please enter a new name');
            return;
        }

        if (currentRenameId) {
            PresetManager.update(currentRenameId, { name: newName });
            renameModal.style.display = 'none';
            currentRenameId = null;
            displayPresetsList();
            showSuccess(`Preset renamed to "${newName}"`);
        }
    });

    renameCancel.addEventListener('click', () => {
        renameModal.style.display = 'none';
        currentRenameId = null;
    });

    // Make rename modal accessible globally
    window.showRenameModal = (presetId) => {
        const preset = PresetManager.get(presetId);
        if (preset) {
            currentRenameId = presetId;
            renameInput.value = preset.name;
            renameModal.style.display = 'flex';
            renameInput.focus();
        }
    };
}

// Display presets list
function displayPresetsList() {
    const container = document.getElementById('presets-list');
    const presets = PresetManager.getAll();

    if (presets.length === 0) {
        container.innerHTML = '<p class="placeholder">No presets saved yet. Analyze a playlist and save it!</p>';
        return;
    }

    container.innerHTML = '';

    presets.forEach(preset => {
        const item = document.createElement('div');
        item.className = 'preset-item';

        const date = new Date(preset.createdAt).toLocaleDateString();
        const paramCount = preset.profile ? Object.keys(preset.profile).length : 0;

        item.innerHTML = `
            <div class="preset-info">
                <div class="preset-name">${preset.name}</div>
                <div class="preset-meta">${preset.tracksCount} tracks ÔÇó ${paramCount} parameters ÔÇó ${date}</div>
            </div>
                        <div class="preset-actions">

                            <button class="preset-btn load" onclick="loadPreset('${preset.id}')">­čôé LOAD</button>

                            <button class="preset-btn export" onclick="PresetManager.exportPreset('${preset.id}')">📤 EXPORT</button>

                            <button class="preset-btn rename" onclick="showRenameModal('${preset.id}')">ÔťĆ´ŞĆ RENAME</button>

                            <button class="preset-btn delete" onclick="deletePreset('${preset.id}')">­čŚĹ´ŞĆ DELETE</button>

                        </div>
        `;

        container.appendChild(item);
    });
}

// Display presets list in Compare tab
function displayComparePresetsList() {
    const container = document.getElementById('modal-presets-list');
    const presets = PresetManager.getAll();

    if (presets.length === 0) {
        container.innerHTML = '<p class="placeholder">No presets saved yet. Create some in the Analyze tab!</p>';
        return;
    }

    container.innerHTML = '';

    presets.forEach(preset => {
        const item = document.createElement('div');
        item.className = 'preset-item';

        const date = new Date(preset.createdAt).toLocaleDateString();
        const paramCount = preset.profile ? Object.keys(preset.profile).length : 0;

        item.innerHTML = `
            <div class="preset-info">
                <div class="preset-name">${preset.name}</div>
                <div class="preset-meta">${preset.tracksCount} tracks ÔÇó ${paramCount} parameters ÔÇó ${date}</div>
            </div>
            <div class="preset-actions">
                <button class="preset-btn load" onclick="loadPresetForCompare('${preset.id}')">­čôé LOAD</button>
            </div>
        `;

        container.appendChild(item);
    });
}

// Load preset (for Analyze tab)
window.loadPreset = function(presetId) {
    const preset = PresetManager.get(presetId);
    if (!preset) {
        showError('Preset not found');
        return;
    }

    // Load profile into current session
    sessionId = 'preset_' + Date.now();
    currentPlaylistProfile = preset.profile;
    currentPlaylistAnalysis = preset.analysis || [];

    document.getElementById('session-id').textContent = sessionId;
    document.getElementById('has-playlist-profile').textContent = 'true';

    // Display the profile
    displayPlaylistProfile(preset.profile);
    document.getElementById('playlist-results').style.display = 'block';

    showSuccess(`Loaded preset: ${preset.name}`);
};

// Load preset for Compare tab
window.loadPresetForCompare = async function(presetId) {
    const preset = PresetManager.get(presetId);
    if (!preset) {
        showError('Preset not found');
        return;
    }

    try {
        // Create backend session with preset data
        const response = await fetch(`${API_BASE}/api/preset/load`, {
            method: 'POST',
            headers: getAuthHeaders(true),
            body: JSON.stringify({
                profile: preset.profile,
                analysis: preset.analysis || []
            })
        });

        if (handleAuthError(response)) return;
        if (!response.ok) {
            throw new Error('Failed to load preset in backend');
        }

        const data = await response.json();

        // Load profile into current session
        sessionId = data.session_id;
        currentPlaylistProfile = preset.profile;
        currentPlaylistAnalysis = preset.analysis || [];

        document.getElementById('session-id').textContent = sessionId;
        document.getElementById('has-playlist-profile').textContent = 'true';

        // Show active preset indicator
        const activeInfo = document.getElementById('active-preset-info');
        const activeName = document.getElementById('active-preset-name');
        activeName.textContent = preset.name;
        activeInfo.style.display = 'flex';

        // Store active preset id
        window.activePresetId = preset.id;
        window.activePresetName = preset.name;

        // Hide modal
        document.getElementById('load-preset-modal').style.display = 'none';

        showSuccess(`Loaded preset: ${preset.name}`);
    } catch (error) {
        console.error('Error loading preset:', error);
        showError('Failed to load preset: ' + error.message);
    }
};

// Clear active preset
window.clearActivePreset = function() {
    sessionId = null;
    currentPlaylistProfile = null;
    currentPlaylistAnalysis = null;
    window.activePresetId = null;
    window.activePresetName = null;

    document.getElementById('session-id').textContent = '';
    document.getElementById('has-playlist-profile').textContent = 'false';
    document.getElementById('active-preset-info').style.display = 'none';

    showSuccess('Preset cleared');
};

// Delete preset
window.deletePreset = function(presetId) {
    const preset = PresetManager.get(presetId);
    if (!preset) {
        showError('Preset not found');
        return;
    }

    if (confirm(`Delete preset "${preset.name}"? This cannot be undone.`)) {
        PresetManager.delete(presetId);
        displayPresetsList();
        displayComparePresetsList();

        // Clear active preset if it was the deleted one
        if (window.activePresetId === presetId) {
            clearActivePreset();
        }

        showSuccess(`Preset "${preset.name}" deleted`);
    }
};

// Initialize compare mode toggle
function initializeCompareModeToggle() {
    const modeRadios = document.querySelectorAll('input[name="compare-mode"]');
    const presetsSection = document.getElementById('compare-presets-section');

    modeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'playlist') {
                // Show presets section
                presetsSection.style.display = 'block';
            } else {
                // Hide presets section for 1:1 mode
                presetsSection.style.display = 'none';
            }
        });
    });

    // Clear button handler
    const clearBtn = document.getElementById('clear-preset-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearActivePreset);
    }
}

// Initialize presets on page load
document.addEventListener('DOMContentLoaded', () => {
    initializePresets();
    displayComparePresetsList();
    initializeCompareModeToggle();
});
