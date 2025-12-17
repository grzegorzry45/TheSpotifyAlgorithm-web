// ===================================
// WIZARD INTERFACE JAVASCRIPT
// Simple 3-step track comparison
// ===================================

const API_BASE = '';
let sessionId = null;
let referenceType = null; // 'playlist', 'preset', or 'single'
let referenceReady = false;

// File storage
let playlistFiles = [];
let referenceTrackFile = null;
let userTrackFile = null;

// Store analysis data
let playlistProfile = null;
let playlistAnalysis = null;
let referenceTrackData = null;

// Abort controllers
let abortController = null;

// Track max step reached for navigation
let maxStepReached = 1;

// Progress modal interval
let progressModalInterval = null;

// AI MODE / GATEKEEPER
let analysisMode = 'standard'; // 'standard' or 'ai'
let gatekeeperResults = null;

// ===== AUTHENTICATION =====
let authToken = localStorage.getItem('access_token');
let userEmail = null; // To store logged in user's email

function getAuthHeaders() {
    return authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
}

function handleAuthError(response) {
    if (response.status === 401) {
        showMessage('Session expired. Please login again.', 'error');
        authToken = null;
        localStorage.removeItem('access_token');
        // No header loginBtn to update text/class on, it's removed
        const loginModal = document.getElementById('login-modal');
        if (loginModal) loginModal.style.display = 'flex';
        return true;
    }
    return false;
}

function initializeAuth() {
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    
    // UI Elements for Auth State
    const mainAppContent = document.getElementById('main-app-content');
    const landingHero = document.getElementById('landing-hero');
    const logoutBtnHeader = document.getElementById('logout-btn-header'); // New button
    const loggedInStatusEl = document.getElementById('logged-in-status'); // The new p tag
    const userEmailDisplay = document.getElementById('user-email-display'); // Span inside the p tag

    function decodeJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            return null;
        }
    }

    function updateUIState() {
        if (authToken) {
            const decodedToken = decodeJwt(authToken);
            userEmail = decodedToken ? decodedToken.sub : null;

            // Logged In
            if (mainAppContent) mainAppContent.style.display = 'block';
            if (landingHero) landingHero.style.display = 'none';
            if (loggedInStatusEl) loggedInStatusEl.style.display = 'block';
            if (userEmailDisplay) userEmailDisplay.textContent = userEmail || '';

            // Fetch and display credits (logout button is inside credits-display, so it shows automatically)
            fetchCredits();
        } else {
            // Logged Out
            userEmail = null;
            if (mainAppContent) mainAppContent.style.display = 'none';
            if (landingHero) landingHero.style.display = 'block';
            if (loggedInStatusEl) loggedInStatusEl.style.display = 'none';

            // Hide credits display (logout button inside will be hidden too)
            const creditsDisplayEl = document.getElementById('credits-display');
            if (creditsDisplayEl) creditsDisplayEl.style.display = 'none';
        }
        // Re-render presets to reflect auth state (cloud vs system)
        renderPresetsInWizard();
    }

    // Initial State Check
    updateUIState();

    // Hero Buttons
    document.getElementById('hero-login-btn')?.addEventListener('click', () => {
        if (loginModal) loginModal.style.display = 'flex';
    });

    document.getElementById('hero-register-btn')?.addEventListener('click', () => {
        if (registerModal) registerModal.style.display = 'flex';
    });

    // Logout Button in Header
    if (logoutBtnHeader) {
        logoutBtnHeader.addEventListener('click', () => {
            authToken = null;
            localStorage.removeItem('access_token');
            updateUIState();
            showMessage('Logged out successfully', 'success');
        });
    }

    // Login Logic
    document.getElementById('login-confirm')?.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        
        try {
            const formData = new FormData();
            formData.append('username', email);
            formData.append('password', password);

            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Login failed');
            }

            const data = await response.json();
            authToken = data.access_token;
            localStorage.setItem('access_token', authToken);
            
            updateUIState(); // Update UI after successful login
            if (loginModal) loginModal.style.display = 'none';
            showMessage('Login successful!', 'success');
            
        } catch (error) {
            if (errorEl) errorEl.textContent = error.message;
        }
    });

    // Cancel Buttons
    document.getElementById('login-cancel')?.addEventListener('click', () => {
        if (loginModal) loginModal.style.display = 'none';
    });
    
    // Switch to Register
    document.getElementById('go-to-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (loginModal) loginModal.style.display = 'none';
        if (registerModal) registerModal.style.display = 'flex';
    });
    
    // Register Logic
    document.getElementById('register-confirm')?.addEventListener('click', async () => {
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPass = document.getElementById('register-password-confirm').value;
        const errorEl = document.getElementById('register-error');

        if (password !== confirmPass) {
            if (errorEl) errorEl.textContent = "Passwords do not match";
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Registration failed');
            }

            // Auto login after register
            const formData = new FormData();
            formData.append('username', email);
            formData.append('password', password);
            
            const loginResp = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                body: formData
            });
            
            if (loginResp.ok) {
                const data = await loginResp.json();
                authToken = data.access_token;
                localStorage.setItem('access_token', authToken);
                updateUIState(); // Update UI after successful login
            }

            if (registerModal) registerModal.style.display = 'none';
            showMessage('Registration successful!', 'success');

        } catch (error) {
            if (errorEl) errorEl.textContent = error.message;
        }
    });
    
    document.getElementById('register-cancel')?.addEventListener('click', () => {
        if (registerModal) registerModal.style.display = 'none';
    });
}

// ===== PROGRESS MODAL FUNCTIONS =====

function showProgressModal(title = 'Processing Audio...') {
    const modal = document.getElementById('progress-modal');
    const titleElement = document.getElementById('progress-modal-title');
    const progressFill = document.getElementById('progress-fill-modal');
    const progressMessage = document.getElementById('progress-message-modal');

    titleElement.textContent = title;
    progressFill.style.width = '0%';
    progressMessage.textContent = 'Initializing...';
    modal.style.display = 'flex';

    // Prevent scrolling when modal is open
    document.body.style.overflow = 'hidden';
}

function hideProgressModal() {
    const modal = document.getElementById('progress-modal');
    modal.style.display = 'none';

    // Re-enable scrolling
    document.body.style.overflow = 'auto';

    // Clear any running intervals
    if (progressModalInterval) {
        clearInterval(progressModalInterval);
        progressModalInterval = null;
    }

    // Reset abort controller
    abortController = null;
}

function cancelAnalysis() {
    if (abortController) {
        abortController.abort();
        console.log('Analysis cancelled by user');
    }

    hideProgressModal();
    showMessage('Analysis cancelled', 'error');
}

function updateProgressModal(progress, message) {
    const progressFill = document.getElementById('progress-fill-modal');
    const progressMessage = document.getElementById('progress-message-modal');

    progressFill.style.width = progress + '%';
    progressMessage.textContent = message;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log("Wizard interface loaded");
    initializeWizard();
});

function initializeWizard() {
    console.log("Initializing Wizard...");
    try {
        // Initialize Auth first
        initializeAuth();

        // Initialize Mode Toggle (Standard vs AI)
        initializeModeToggle();

        // Step 1: Reference selection
        initializeReferenceSelection();

        // Step 2: User track upload
        initializeUserTrackUpload();
        initializeParameterSelection();

        // Step 3: Results
        initializeResults();

        // Navigation
        initializeNavigation();

        // Collapsible sections
        initializeCollapsibleSections();

        // Params Modal
        initializeParamsModal();

        // Progress Modal Cancel Button
        initializeProgressModalCancel();

        // Load presets if any (will be called by initializeAuth's updateUIState)
        // loadPresetsForWizard();
    } catch (error) {
        console.error("Wizard initialization failed:", error);
        alert("Wizard initialization failed. Please reload the page. Error: " + error.message);
    }
}

function initializeProgressModalCancel() {
    const cancelBtn = document.getElementById('cancel-analysis-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', cancelAnalysis);
    }
}

// ===== PARAMS MODAL =====
let currentParamsParent = null;
let currentParamsContainer = null;

function initializeParamsModal() {
    const modal = document.getElementById('params-modal');
    const closeBtn = document.getElementById('close-params-modal');
    const confirmBtn = document.getElementById('confirm-params-btn');
    const modalBody = document.getElementById('modal-params-container');

    if (!modal) return;

    const openModal = (sourceWrapperId) => {
        const wrapper = document.getElementById(sourceWrapperId);
        if (!wrapper) return;

        // Find the content to move (the .param-groups div or direct child)
        // In wizard html, the wrapper IS the container for params sometimes, 
        // or contains #playlist-param-groups
        
        let contentToMove = wrapper.querySelector('.param-groups');
        // If wrapper has param-groups class itself (not likely based on my html edit)
        
        // fallback for wizard generated content
        if (!contentToMove && wrapper.children.length > 0) {
             contentToMove = wrapper.firstElementChild; // likely #playlist-param-groups
        }

        if (contentToMove) {
            // Save state
            currentParamsContainer = contentToMove;
            currentParamsParent = wrapper;

            // Move to modal
            modalBody.innerHTML = '';
            modalBody.appendChild(contentToMove);
            
            // Show modal
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    };

    const closeModal = () => {
        if (currentParamsContainer && currentParamsParent) {
            currentParamsParent.appendChild(currentParamsContainer);
        }
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        currentParamsContainer = null;
        currentParamsParent = null;
    };

    // Attach listeners
    const btnPlaylist = document.getElementById('open-params-playlist');
    if (btnPlaylist) btnPlaylist.addEventListener('click', () => openModal('playlist-param-groups-container'));

    const btnUser = document.getElementById('open-params-user');
    if (btnUser) btnUser.addEventListener('click', () => openModal('wizard-param-groups-container'));

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (confirmBtn) confirmBtn.addEventListener('click', closeModal);

    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

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
                // Update collapse icon
                const icon = header.querySelector('.collapse-icon');
                if (icon) {
                    icon.textContent = header.classList.contains('active') ? '▼' : '▶';
                }
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

// ===== MODE TOGGLE (Standard vs AI) =====

function initializeModeToggle() {
    const modeButtons = document.querySelectorAll('.mode-btn');
    const aiModeInfo = document.getElementById('ai-mode-info');

    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            switchAnalysisMode(mode);
        });
    });
}

function switchAnalysisMode(mode) {
    analysisMode = mode;

    // Update toggle buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Show/hide AI Mode info
    const aiModeInfo = document.getElementById('ai-mode-info');
    if (aiModeInfo) {
        aiModeInfo.style.display = mode === 'ai' ? 'block' : 'none';
    }

    // Hide ALL parameter selection sections in AI Mode
    const parameterSelections = document.querySelectorAll('.parameter-selection-wizard');
    parameterSelections.forEach(section => {
        section.style.display = mode === 'ai' ? 'none' : 'block';
    });

    // Update compare button state
    updateCompareButton();

    console.log(`Switched to ${mode} mode`);
}

// ===== GATEKEEPER (AI MODE) FUNCTIONS =====

async function analyzePlaylistGatekeeper() {
    if (playlistFiles.length < 2 || playlistFiles.length > 30) {
        showMessage('Please upload 2-30 tracks for Gatekeeper analysis', 'error');
        return;
    }

    showProgressModal('Analyzing Playlist (AI Mode)...');
    updateProgressModal(5, 'Extracting Golden 8 parameters using native sample rate...');

    // Rotating messages to keep user engaged during long analysis
    const waitMessages = [
        '🎵 Extracting Golden 8 parameters using native sample rate...',
        '🔬 Analyzing audio features with high precision...',
        '📊 Processing spectral content...',
        '🎼 Detecting tempo and rhythm patterns...',
        '⚡ Computing energy distribution...',
        '🎹 Analyzing harmonic structure...',
        '📝 Creating final profile...',
        '🔄 Gathering full data...',
        '⏰ Be patient, just a moment...',
        '✨ Finalizing analysis...'
    ];

    let messageIndex = 0;
    if (progressModalInterval) clearInterval(progressModalInterval);
    progressModalInterval = setInterval(() => {
        const msg = waitMessages[messageIndex % waitMessages.length];
        updateProgressModal(10 + (messageIndex % 80), msg); // Progress 10-90%
        messageIndex++;
    }, 2500); // Change message every 2.5 seconds

    try {
        // Create abort controller for cancellation
        abortController = new AbortController();

        const formData = new FormData();
        playlistFiles.forEach(file => {
            formData.append('files', file);
        });

        const response = await fetch(`${API_BASE}/api/gatekeeper/analyze-playlist`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData,
            signal: abortController.signal
        });

        if (!response.ok) {
            if (handleAuthError(response)) return;
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Analysis failed: ${response.status}`);
        }

        const data = await response.json();

        sessionId = data.session_id;
        document.getElementById('session-id').textContent = sessionId;

        // Store playlist profile for preset saving
        // Wrap Gatekeeper data with mode identifier
        playlistProfile = {
            mode: 'gatekeeper',
            tracks: data.playlist_features
        };
        playlistAnalysis = data.playlist_features;

        // Update credits
        if (data.credits_remaining !== undefined) {
            updateCreditsDisplay(data.credits_remaining);
        }

        // Mark reference as ready
        referenceReady = true;
        document.getElementById('wizard-reference-ready').textContent = 'true';

        hideProgressModal();

        showMessage(`✓ Playlist analyzed! ${data.tracks_analyzed} tracks processed using Golden 8.`, 'success');

        // Show modal asking to save as preset
        setTimeout(() => {
            showSavePresetModalGatekeeper();
        }, 500);

    } catch (error) {
        hideProgressModal();

        if (error.name === 'AbortError') {
            console.log('Gatekeeper playlist analysis cancelled');
            showMessage('Analysis cancelled', 'error');
        } else {
            console.error('Gatekeeper playlist analysis error:', error);
            showMessage('Analysis failed: ' + error.message, 'error');
        }
    }
}

async function compareTrackGatekeeper() {
    if (!userTrackFile) {
        showMessage('Please upload your track first', 'error');
        return;
    }

    if (!sessionId) {
        showMessage('No active Gatekeeper session. Please analyze a playlist first.', 'error');
        return;
    }

    showProgressModal('Checking Track (AI Mode)...');
    updateProgressModal(5, 'Analyzing your track against playlist profile...');

    // Rotating messages to keep user engaged during analysis
    const waitMessages = [
        '🔬 Analyzing your track against playlist profile...',
        '📊 Extracting Golden 8 parameters...',
        '🎯 Finding nearest reference track...',
        '📝 Calculating weighted Z-scores...',
        '🔄 Processing comparisons...',
        '🤖 Generating LLM prompt...',
        '✨ Finalizing results...',
        '⏰ Be patient, just a moment...'
    ];

    let messageIndex = 0;
    if (progressModalInterval) clearInterval(progressModalInterval);
    progressModalInterval = setInterval(() => {
        const msg = waitMessages[messageIndex % waitMessages.length];
        updateProgressModal(10 + (messageIndex % 80), msg); // Progress 10-90%
        messageIndex++;
    }, 2500); // Change message every 2.5 seconds

    try {
        // Create abort controller for cancellation
        abortController = new AbortController();

        const formData = new FormData();
        formData.append('user_track', userTrackFile);
        formData.append('session_id', sessionId);

        const response = await fetch(`${API_BASE}/api/gatekeeper/check`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData,
            signal: abortController.signal
        });

        if (!response.ok) {
            if (handleAuthError(response)) return;
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Check failed: ${response.status}`);
        }

        const data = await response.json();

        // Store results
        gatekeeperResults = data;

        // Update credits
        if (data.credits_remaining !== undefined) {
            updateCreditsDisplay(data.credits_remaining);
        }

        hideProgressModal();

        // Display results
        displayGatekeeperResults(data);

        // Go to Step 3
        goToStep(3);

    } catch (error) {
        hideProgressModal();

        if (error.name === 'AbortError') {
            console.log('Gatekeeper track check cancelled');
            showMessage('Analysis cancelled', 'error');
        } else {
            console.error('Gatekeeper check error:', error);
            showMessage('Track check failed: ' + error.message, 'error');
        }
    }
}

function showSavePresetModalGatekeeper() {
    if (!playlistProfile) {
        // If no profile, just go to Step 2
        goToStep(2);
        return;
    }

    // Show the save preset modal (use 'flex' to center it)
    const modal = document.getElementById('save-preset-modal');
    modal.style.display = 'flex';

    // Override the cancel button to go to Step 2
    const cancelBtn = document.getElementById('preset-save-cancel-wizard');
    const confirmBtn = document.getElementById('preset-save-confirm-wizard');

    // Remove existing listeners and add new ones
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    newCancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        goToStep(2);
    });

    // Override confirm to save and then go to Step 2
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.addEventListener('click', async () => {
        await savePreset();
        // After saving, close modal and go to Step 2
        setTimeout(() => {
            goToStep(2);
        }, 500);
    });
}

function displayGatekeeperResults(data) {
    // Hide standard results, show AI mode results
    document.getElementById('results-container').style.display = 'none';
    document.getElementById('ai-mode-results-container').style.display = 'block';

    // Update analyzed filename display
    const filenameSpan = document.querySelector('#gatekeeper-filename-display span');
    if (filenameSpan && data.user_features && data.user_features.filename) {
        filenameSpan.textContent = data.user_features.filename;
    } else if (filenameSpan && userTrackFile) {
        // Fallback to client-side file name if backend doesn't return it
        filenameSpan.textContent = userTrackFile.name;
    }

    // Display critical alerts
    displayCriticalAlerts(data.critical_alerts);

    // Display Golden 8 comparison
    displayGolden8Comparison(data.user_features, data.nearest_reference, data.weighted_z_scores);

    // Display LLM prompt
    displayLLMPrompt(data.llm_prompt);

    // Setup copy button
    const copyBtn = document.getElementById('copy-prompt-btn');
    if (copyBtn) {
        copyBtn.onclick = () => copyLLMPrompt();
    }
}

function displayCriticalAlerts(alerts) {
    const container = document.getElementById('critical-alerts-list');
    if (!container) return;

    if (!alerts || alerts.length === 0) {
        container.innerHTML = '<div style="padding: 16px; background: rgba(29, 185, 84, 0.1); border: 1px solid rgba(29, 185, 84, 0.3); border-radius: 8px; color: #1DB954;">✓ No critical alerts detected</div>';
        return;
    }

    container.innerHTML = '';
    alerts.forEach(alert => {
        const alertDiv = document.createElement('div');
        const isCritical = alert.includes('CRITICAL');
        const bgColor = isCritical ? 'rgba(255, 107, 107, 0.1)' : 'rgba(255, 193, 7, 0.1)';
        const borderColor = isCritical ? 'rgba(255, 107, 107, 0.3)' : 'rgba(255, 193, 7, 0.3)';
        const textColor = isCritical ? '#ff6b6b' : '#ffc107';

        alertDiv.style.cssText = `
            padding: 12px 16px;
            background: ${bgColor};
            border: 1px solid ${borderColor};
            border-radius: 6px;
            color: ${textColor};
            font-size: 14px;
        `;
        alertDiv.textContent = alert;
        container.appendChild(alertDiv);
    });
}

function displayGolden8Comparison(userFeatures, refFeatures, zScores) {
    const container = document.getElementById('golden-8-comparison');
    if (!container) return;

    const golden8Order = [
        { key: 'bpm', label: 'BPM', unit: '' },
        { key: 'beat_strength', label: 'Beat Strength', unit: '' },
        { key: 'onset_rate', label: 'Onset Rate', unit: '/s' },
        { key: 'energy', label: 'Energy', unit: '' },
        { key: 'danceability', label: 'Danceability (Pulse Clarity)', unit: '' },
        { key: 'spectral_rolloff', label: 'Spectral Rolloff', unit: ' Hz' },
        { key: 'spectral_flatness', label: 'Spectral Flatness', unit: '' },
        { key: 'dynamic_range', label: 'Dynamic Range', unit: ' dB' }
    ];

    let html = '<table style="width: 100%; border-collapse: collapse;">';
    html += '<thead><tr style="border-bottom: 2px solid rgba(255,255,255,0.1);">';
    html += '<th style="padding: 12px; text-align: left; color: var(--text-secondary); font-size: 13px;">Parameter</th>';
    html += '<th style="padding: 12px; text-align: right; color: var(--text-secondary); font-size: 13px;">Your Track</th>';
    html += '<th style="padding: 12px; text-align: right; color: var(--text-secondary); font-size: 13px;">Reference</th>';
    html += '<th style="padding: 12px; text-align: right; color: var(--text-secondary); font-size: 13px;">Z-Score</th>';
    html += '</tr></thead><tbody>';

    golden8Order.forEach(param => {
        const userVal = userFeatures[param.key];
        const refVal = refFeatures[param.key];
        const zData = zScores[param.key];
        const weightedZ = zData.weighted_z;

        // Color based on weighted Z-score
        let zColor = '#1DB954'; // green
        if (Math.abs(weightedZ) > 2.0) zColor = '#ff6b6b'; // red
        else if (Math.abs(weightedZ) > 1.5) zColor = '#ffc107'; // yellow

        html += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">`;
        html += `<td style="padding: 12px; font-weight: 500;">${param.label}</td>`;
        html += `<td style="padding: 12px; text-align: right; font-family: var(--font-mono); color: var(--primary);">${userVal.toFixed(2)}${param.unit}</td>`;
        html += `<td style="padding: 12px; text-align: right; font-family: var(--font-mono);">${refVal.toFixed(2)}${param.unit}</td>`;
        html += `<td style="padding: 12px; text-align: right; font-family: var(--font-mono); font-weight: 600; color: ${zColor};">${weightedZ.toFixed(2)}</td>`;
        html += `</tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function displayLLMPrompt(prompt) {
    const textarea = document.getElementById('llm-prompt-text');
    if (textarea) {
        textarea.value = prompt;
    }
}

function copyLLMPrompt() {
    const textarea = document.getElementById('llm-prompt-text');
    const successMsg = document.getElementById('copy-success-message');

    if (textarea) {
        textarea.select();
        document.execCommand('copy');

        if (successMsg) {
            successMsg.style.display = 'block';
            setTimeout(() => {
                successMsg.style.display = 'none';
            }, 3000);
        }

        showMessage('✓ Prompt copied to clipboard!', 'success');
    }
}

// ===== STEP 1: REFERENCE SELECTION =====

function initializeReferenceSelection() {
    const cards = document.querySelectorAll('.reference-card');

    cards.forEach(card => {
        const selectBtn = card.querySelector('.select-reference-btn');
        const refType = card.dataset.reference;

        // Click on button
        selectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectReferenceType(refType);
        });

        // Click anywhere on card
        card.addEventListener('click', () => {
            selectReferenceType(refType);
        });
    });

    // Playlist upload
    const playlistUploadZone = document.getElementById('playlist-upload');
    const playlistFilesInput = document.getElementById('playlist-files');
    setupDragDrop(playlistUploadZone, playlistFilesInput, handlePlaylistFiles);

    // Single track reference upload
    const refUploadZone = document.getElementById('reference-track-upload');
    const refFileInput = document.getElementById('reference-track-file');
    setupDragDrop(refUploadZone, refFileInput, handleReferenceTrack);

    document.getElementById('confirm-reference-btn')?.addEventListener('click', confirmReferenceTrack);

    document.getElementById('analyze-playlist-btn')?.addEventListener('click', analyzePlaylist);

    // Import preset button
    const importPresetBtn = document.getElementById('import-preset-wizard-btn');
    const importPresetInput = document.getElementById('import-preset-wizard-file');
    if (importPresetBtn && importPresetInput) {
        importPresetBtn.addEventListener('click', () => importPresetInput.click());
        importPresetInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                importPresetFile(e.target.files[0]);
            }
        });
    }

    // Save preset button
    document.getElementById('save-playlist-preset-btn')?.addEventListener('click', showSavePresetModal);
    document.getElementById('export-preset-file-btn')?.addEventListener('click', exportPresetToFile);
    document.getElementById('preset-save-confirm-wizard')?.addEventListener('click', savePreset);
    document.getElementById('preset-save-cancel-wizard')?.addEventListener('click', () => {
        document.getElementById('save-preset-modal').style.display = 'none';
    });
}

function exportPresetToFile() {
    if (!playlistProfile) {
        showMessage('No playlist profile to export', 'error');
        return;
    }
    
    const data = {
        profile: playlistProfile,
        analysis: playlistAnalysis || [],
        exported_at: new Date().toISOString(),
        version: "2.0"
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preset_profile_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function selectReferenceType(type) {
    referenceType = type;

    // Update UI - mark selected card
    document.querySelectorAll('.reference-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`[data-reference="${type}"]`).classList.add('selected');

    // Hide all upload sections
    document.querySelectorAll('.reference-upload-section').forEach(section => {
        section.style.display = 'none';
    });

    // Show appropriate upload section and scroll to it
    let uploadSection = null;
    if (type === 'playlist') {
        uploadSection = document.getElementById('playlist-upload-section');
        uploadSection.style.display = 'block';
    } else if (type === 'preset') {
        uploadSection = document.getElementById('preset-load-section');
        uploadSection.style.display = 'block';
        renderPresetsInWizard();
    } else if (type === 'single') {
        uploadSection = document.getElementById('single-upload-section');
        uploadSection.style.display = 'block';
    }

    // Auto-scroll to the upload section
    if (uploadSection) {
        setTimeout(() => {
            uploadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100); // Small delay to ensure section is rendered
    }

    // Reset reference ready state
    referenceReady = false;
    document.getElementById('wizard-reference-ready').textContent = 'false';
}

function handlePlaylistFiles(files) {
    playlistFiles = Array.from(files);

    // Display file list
    const fileList = document.getElementById('playlist-file-list');
    fileList.innerHTML = '';

    playlistFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span class="file-name">🎵 ${file.name}</span>
            <button class="btn-remove" data-index="${index}">✕</button>
        `;
        fileList.appendChild(fileItem);

        fileItem.querySelector('.btn-remove').addEventListener('click', () => {
            playlistFiles.splice(index, 1);
            handlePlaylistFiles(playlistFiles);
        });
    });

    // Update analyze button state
    updateAnalyzeButton();

    // Auto-scroll to parameter selection or analyze button
    if (playlistFiles.length > 0) {
        setTimeout(() => {
            const paramSection = document.querySelector('.parameter-selection-wizard');
            if (paramSection) {
                paramSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }
}

async function analyzePlaylist() {
    if (!authToken) {
        showMessage('Please login to analyze a playlist.', 'error');
        return;
    }
    if (playlistFiles.length < 2) {
        showMessage('Please upload at least 2 tracks', 'error');
        return;
    }

    // Check if AI Mode is active
    if (analysisMode === 'ai') {
        return await analyzePlaylistGatekeeper();
    }

    // Show progress modal
    showProgressModal('Analyzing Playlist...');

    try {
        // Create abort controller
        abortController = new AbortController();

        updateProgressModal(0, `Starting upload of ${playlistFiles.length} files...`);

        // Upload files with progress
        const formData = new FormData();
        playlistFiles.forEach(file => formData.append('files', file));

        // Use XHR for upload progress
        const uploadResponse = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${API_BASE}/api/upload/playlist`);
            xhr.setRequestHeader('Authorization', getAuthHeaders().Authorization); // Add auth header

            // Handle abort signal
            if (abortController) {
                abortController.signal.addEventListener('abort', () => {
                    xhr.abort();
                    reject(new DOMException('Upload aborted', 'AbortError'));
                });
            }

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = (e.loaded / e.total) * 40; // Allocate 40% for upload
                    const mbLoaded = (e.loaded / 1024 / 1024).toFixed(1);
                    const mbTotal = (e.total / 1024 / 1024).toFixed(1);
                    updateProgressModal(percent, `Uploading: ${mbLoaded}MB / ${mbTotal}MB (${playlistFiles.length} files)`);
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    reject(new Error('Upload failed'));
                }
            };

            xhr.onerror = () => reject(new Error('Upload network error'));
            xhr.onabort = () => reject(new DOMException('Upload aborted', 'AbortError'));
            xhr.send(formData);
        });

        sessionId = uploadResponse.session_id;

        // Start simulated detailed progress
        const totalTracks = playlistFiles.length;
        let currentProgress = 40;

        // Simulation settings
        const analysisMessages = [
            "Extracting spectral features...",
            "Analyzing rhythm and beat...",
            "Calculating energy profiles...",
            "Detecting musical key...",
            "Measuring dynamic range...",
            "Aggregating sonic data...",
            "Finalizing playlist profile..."
        ];

        // Final waiting messages (rotate after reaching 95%)
        const finalWaitMessages = [
            "📝 Creating final profile...",
            "🔬 Gathering full data...",
            "🎯 Details extraction...",
            "⏰ Be patient, just a moment...",
            "🔄 Processing final calculations...",
            "✨ Finalizing analysis...",
            "🎼 Compiling results..."
        ];

        // Estimate 2 seconds per track for simulation speed
        const estimatedDuration = totalTracks * 2000;
        const intervalTime = 200;
        const totalSteps = estimatedDuration / intervalTime;
        const progressIncrement = (55 / totalSteps); // Move from 40% to 95%

        if (progressModalInterval) clearInterval(progressModalInterval);

        let finalMessageIndex = 0;
        progressModalInterval = setInterval(() => {
            currentProgress += progressIncrement;
            if (currentProgress > 95) {
                currentProgress = 95; // Cap at 95%

                // After reaching 95%, rotate through waiting messages
                const waitMsg = finalWaitMessages[finalMessageIndex % finalWaitMessages.length];
                updateProgressModal(96 + (finalMessageIndex % 2), waitMsg); // Alternate between 96-97%
                finalMessageIndex++;
                return;
            }

            // Calculate which track we are "analyzing" based on progress
            // Map 40-95% to 1-totalTracks
            const progressRatio = (currentProgress - 40) / 55;
            const currentTrackNum = Math.min(Math.ceil(progressRatio * totalTracks), totalTracks);

            // Cycle messages
            const msgIndex = Math.floor(progressRatio * analysisMessages.length);
            const detailMsg = analysisMessages[Math.min(msgIndex, analysisMessages.length - 1)];

            updateProgressModal(currentProgress, `[${currentTrackNum}/${totalTracks}] ${detailMsg}`);
        }, intervalTime);

        // Get selected parameters from playlist params
        const selectedParams = getPlaylistParameters();

        // Analyze playlist
        const analyzeResponse = await fetch(`${API_BASE}/api/analyze/playlist`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                session_id: sessionId,
                additional_params: selectedParams
            }),
            signal: abortController.signal
        });

        if (handleAuthError(analyzeResponse)) {
            hideProgressModal();
            return;
        }

        if (!analyzeResponse.ok) throw new Error('Analysis failed');

        const analyzeData = await analyzeResponse.json();
        playlistProfile = analyzeData.profile;
        playlistAnalysis = analyzeData.profile; // Store for preset saving

        // Update credits display if available in response
        if (analyzeData.credits_remaining !== undefined) {
            updateCreditsDisplay(analyzeData.credits_remaining);
        }

        updateProgressModal(100, 'Analysis complete!');

        // Hide modal with slight delay to show completion
        setTimeout(() => {
            hideProgressModal();

            // Mark reference as ready
            referenceReady = true;
            document.getElementById('wizard-reference-ready').textContent = 'true';

            // Display playlist profile
            displayPlaylistProfile(playlistProfile);

            // Show success and enable next step
            showMessage('Playlist analyzed successfully! You can now save it as a preset or proceed to Step 2 →', 'success');
            enableStep2Navigation();

            // Auto-scroll to results
            setTimeout(() => {
                const resultsSection = document.getElementById('playlist-results');
                if (resultsSection) {
                    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        }, 500);

    } catch (error) {
        hideProgressModal();

        if (error.name === 'AbortError') {
            showMessage('Analysis cancelled', 'error');
        } else {
            console.error('Analysis error:', error);
            showMessage('Analysis failed: ' + error.message, 'error');
        }
    }
}

function handleReferenceTrack(files) {
    if (files.length > 0) {
        referenceTrackFile = files[0];
        const nameContainer = document.getElementById('reference-track-name');
        nameContainer.innerHTML = '';

        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span class="file-name">🎵 ${referenceTrackFile.name}</span>
            <button class="btn-remove">✕</button>
        `;
        nameContainer.appendChild(fileItem);
        nameContainer.classList.add('has-file');
        document.getElementById('confirm-reference-btn').disabled = false;

        // Add remove functionality
        fileItem.querySelector('.btn-remove').addEventListener('click', () => {
            referenceTrackFile = null;
            nameContainer.innerHTML = '';
            nameContainer.classList.remove('has-file');
            document.getElementById('confirm-reference-btn').disabled = true;
        });

        // Auto-scroll to confirm button
        setTimeout(() => {
            const confirmBtn = document.getElementById('confirm-reference-btn');
            if (confirmBtn) {
                confirmBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    }
}

async function confirmReferenceTrack() {
    if (!referenceTrackFile) return;

    referenceReady = true;
    document.getElementById('wizard-reference-ready').textContent = 'true';

    // Automatically go to Step 2
    showMessage('Reference confirmed! Now upload your track', 'success');
    goToStep(2);
}

function displayPlaylistProfile(profile) {
    const resultsDiv = document.getElementById('playlist-results');
    const profileDisplay = document.getElementById('playlist-profile-display');

    if (!profile || !profileDisplay) return;

    let html = '';
    Object.entries(profile).forEach(([key, value]) => {
        if (key !== 'filename' && typeof value === 'object' && value.mean !== undefined) {
            html += `
                <div class="param-row">
                    <span class="param-name">${formatParamName(key)}</span>
                    <span class="param-value">${value.mean.toFixed(2)} ±${value.std.toFixed(2)}</span>
                </div>
            `;
        } else if (key !== 'filename' && typeof value !== 'object') {
            html += `
                <div class="param-row">
                    <span class="param-name">${formatParamName(key)}</span>
                    <span class="param-value">${typeof value === 'number' ? value.toFixed(2) : value}</span>
                </div>
            `;
        }
    });

    profileDisplay.innerHTML = html;
    resultsDiv.style.display = 'block';
}

function showSavePresetModal() {
    if (!playlistProfile) {
        showMessage('Please analyze a playlist first', 'error');
        return;
    }
    document.getElementById('save-preset-modal').style.display = 'flex';
}

async function savePreset() {
    const nameInput = document.getElementById('preset-name-input-wizard');
    const name = nameInput.value.trim();
    
    if (!name) {
        alert('Please enter a preset name');
        return;
    }
    
    if (!playlistProfile) {
        alert('No profile data to save');
        return;
    }

    if (!authToken) {
        showMessage('Please login to save presets to the cloud.', 'error');
        return;
    }
    
    const presetData = {
        name: name,
        profile: playlistProfile,
        // analysis: playlistAnalysis // analysis is not stored in cloud preset schema
    };

    try {
        const response = await fetch(`${API_BASE}/api/presets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(presetData)
        });

        if (handleAuthError(response)) return;
        if (!response.ok) throw new Error('Failed to save preset to cloud');

        // After saving, refresh the list to show new preset
        renderPresetsInWizard();
        showMessage(`Preset "${name}" saved to cloud!`, 'success');
        document.getElementById('save-preset-modal').style.display = 'none';
        nameInput.value = '';

    } catch (error) {
        console.error('Cloud save failed:', error);
        showMessage('Failed to save preset to cloud: ' + error.message, 'error');
    }
}

function enableStep2Navigation() {
    // Add a "Next" button if reference is ready
    const step1 = document.getElementById('step-1');
    let nextBtn = step1.querySelector('.next-to-step-2');

    if (!nextBtn) {
        nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn-primary next-to-step-2';
        nextBtn.textContent = 'Next: Upload Your Track →';
        nextBtn.style.marginTop = '30px';
        nextBtn.style.width = '100%';
        nextBtn.addEventListener('click', () => goToStep(2));
        step1.appendChild(nextBtn);
    }
}

// ===== STEP 2: USER TRACK UPLOAD =====

function initializeUserTrackUpload() {
    const uploadZone = document.getElementById('user-track-upload');
    const fileInput = document.getElementById('user-track-file');

    setupDragDrop(uploadZone, fileInput, handleUserTrack);

    document.getElementById('compare-now-btn')?.addEventListener('click', compareTrack);

    // Quick select buttons for Step 2
    document.getElementById('select-essential')?.addEventListener('click', selectEssentialParams);
    document.getElementById('select-all-params')?.addEventListener('click', selectAllParams);

    // Quick select buttons for Playlist Analysis
    document.getElementById('select-essential-playlist')?.addEventListener('click', selectEssentialPlaylistParams);
    document.getElementById('select-all-params-playlist')?.addEventListener('click', selectAllPlaylistParams);
}

function handleUserTrack(files) {
    if (files.length > 0) {
        userTrackFile = files[0];
        const nameContainer = document.getElementById('user-track-name');
        nameContainer.innerHTML = '';

        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span class="file-name">🎵 ${userTrackFile.name}</span>
            <button class="btn-remove">✕</button>
        `;
        nameContainer.appendChild(fileItem);
        nameContainer.classList.add('has-file');

        // Add remove functionality
        fileItem.querySelector('.btn-remove').addEventListener('click', () => {
            userTrackFile = null;
            nameContainer.innerHTML = '';
            nameContainer.classList.remove('has-file');
            updateCompareButton();
        });

        // Enable compare button if parameters selected
        updateCompareButton();

        // Auto-scroll to parameter selection
        setTimeout(() => {
            const paramSection = document.querySelector('.parameter-selection-wizard');
            if (paramSection) {
                paramSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }
}

function updateCompareButton() {
    const compareBtn = document.getElementById('compare-now-btn');
    const hasFile = userTrackFile !== null;

    // In AI Mode, parameters are automatic (Golden 8)
    if (analysisMode === 'ai') {
        compareBtn.disabled = !hasFile;
    } else {
        const hasParams = getSelectedParameters().length > 0;
        compareBtn.disabled = !(hasFile && hasParams);
    }
}

async function compareTrack() {
    if (!authToken) {
        showMessage('Please login to compare tracks.', 'error');
        return;
    }
    if (!userTrackFile || !referenceReady) {
        showMessage('Please complete all required fields', 'error');
        return;
    }

    // Check if AI Mode is active
    if (analysisMode === 'ai') {
        return await compareTrackGatekeeper();
    }

    // Show progress modal
    showProgressModal('Comparing Tracks...');

    // Dynamic progress messages
    const progressSteps = [
        { progress: 10, message: '🎵 Loading audio file...' },
        { progress: 20, message: '🔊 Extracting waveform data...' },
        { progress: 30, message: '📊 Analyzing spectral content...' },
        { progress: 45, message: '🎼 Detecting tempo & rhythm...' },
        { progress: 60, message: '🎹 Analyzing harmonic structure...' },
        { progress: 75, message: '⚡ Computing energy distribution...' },
        { progress: 85, message: '🔍 Comparing with reference...' },
        { progress: 92, message: '🤖 Generating recommendations...' },
        { progress: 96, message: '⏳ Almost complete...' }
    ];

    // Final waiting messages (rotate after reaching 96%)
    const finalWaitMessages = [
        '📝 Creating final profile...',
        '🔬 Gathering full data...',
        '🎯 Details extraction...',
        '⏰ Be patient, just a moment...',
        '🔄 Processing final calculations...',
        '✨ Finalizing analysis...',
        '🎼 Compiling results...'
    ];

    let currentStep = 0;
    let finalMessageIndex = 0;

    // Function to update progress
    const updateProgress = () => {
        if (currentStep < progressSteps.length) {
            const step = progressSteps[currentStep];
            updateProgressModal(step.progress, step.message);
            currentStep++;
        } else {
            // After reaching final step (96%), rotate through waiting messages
            const message = finalWaitMessages[finalMessageIndex % finalWaitMessages.length];
            updateProgressModal(97 + (finalMessageIndex % 2), message); // Alternate between 97-98%
            finalMessageIndex++;
        }
    };

    try {
        abortController = new AbortController();

        // Start initial progress
        updateProgress();

        const selectedParams = getSelectedParameters();
        const formData = new FormData();
        formData.append('user_track', userTrackFile);
        formData.append('additional_params', JSON.stringify(selectedParams));

        if (referenceType === 'playlist') {
            formData.append('mode', 'playlist');
            formData.append('session_id', sessionId);
        } else if (referenceType === 'single') {
            formData.append('mode', 'track');
            formData.append('reference_track', referenceTrackFile);
            formData.append('session_id', sessionId || 'null');
        } else if (referenceType === 'preset') {
            formData.append('mode', 'playlist');
            formData.append('session_id', sessionId);
        }

        // Start progress animation (update every 800ms)
        progressModalInterval = setInterval(updateProgress, 800);

        const response = await fetch(`${API_BASE}/api/compare/single`, {
            method: 'POST',
            body: formData,
            headers: getAuthHeaders(),
            signal: abortController.signal
        });

        if (handleAuthError(response)) {
            hideProgressModal();
            return;
        }

        // Clear interval - stops at ~96% "Almost complete..."
        if (progressModalInterval) {
            clearInterval(progressModalInterval);
            progressModalInterval = null;
        }

        if (!response.ok) throw new Error('Comparison failed');

        const results = await response.json();

        // Update credits display if available in response
        if (results.credits_remaining !== undefined) {
            updateCreditsDisplay(results.credits_remaining);
        }

        // Hide modal and immediately display results
        hideProgressModal();
        displayResults(results);
        goToStep(3);

    } catch (error) {
        hideProgressModal();

        if (error.name === 'AbortError') {
            showMessage('Comparison cancelled', 'error');
        } else {
            console.error('Comparison error:', error);
            showMessage('Comparison failed: ' + error.message, 'error');
        }
    }
}

// ===== STEP 3: RESULTS =====

function initializeResults() {
    document.getElementById('start-over-btn')?.addEventListener('click', startOver);
    document.getElementById('export-report-btn')?.addEventListener('click', exportReport);
}

function displayResults(results) {
    const summaryDiv = document.getElementById('comparison-summary');
    const recommendationsDiv = document.getElementById('ai-recommendations');

    // Update analyzed filename display
    const filenameSpan = document.querySelector('#analyzed-filename-display span');
    if (filenameSpan && results.user_track && results.user_track.filename) {
        filenameSpan.textContent = results.user_track.filename;
    } else if (filenameSpan && userTrackFile) {
        // Fallback to client-side file name if backend doesn't return it
        filenameSpan.textContent = userTrackFile.name;
    }

    // Display side-by-side comparison
    if (results.user_track) {
        const userTrack = results.user_track;
        const referenceData = results.reference_track || results.playlist_profile || {};

        let summaryHTML = `
            <div class="comparison-table">
                <div class="comparison-header">
                    <div class="header-cell param-name-header">Parameter</div>
                    <div class="header-cell reference-header">Reference</div>
                    <div class="header-cell user-header">Your Track</div>
                    <div class="header-cell diff-header">Difference</div>
                </div>
        `;

        Object.entries(userTrack).forEach(([key, userValue]) => {
            if (key !== 'filename' && typeof userValue !== 'object') {
                let refValue = referenceData[key];

                // Handle playlist profile object (extract mean)
                if (refValue && typeof refValue === 'object' && refValue.hasOwnProperty('mean')) {
                    refValue = refValue.mean;
                }

                const hasDiff = refValue !== undefined && refValue !== null;

                // Calculate difference (if both are numbers)
                let diffDisplay = '-';
                let diffClass = 'diff-neutral';

                if (hasDiff && typeof userValue === 'number' && typeof refValue === 'number') {
                    const diff = userValue - refValue;
                    const diffPercent = refValue !== 0 ? ((diff / refValue) * 100).toFixed(1) : 'N/A';

                    if (Math.abs(diff) < 0.01) {
                        diffDisplay = '≈ same';
                        diffClass = 'diff-neutral';
                    } else if (diff > 0) {
                        diffDisplay = `+${diff.toFixed(2)} (${diffPercent}%)`;
                        diffClass = 'diff-higher';
                    } else {
                        diffDisplay = `${diff.toFixed(2)} (${diffPercent}%)`;
                        diffClass = 'diff-lower';
                    }
                }

                summaryHTML += `
                    <div class="comparison-row">
                        <div class="param-name-cell">${formatParamName(key)}</div>
                        <div class="reference-cell">${hasDiff ? formatValue(refValue) : '-'}</div>
                        <div class="user-cell">${formatValue(userValue)}</div>
                        <div class="diff-cell ${diffClass}">${diffDisplay}</div>
                    </div>
                `;
            }
        });

        summaryHTML += '</div>';
        summaryDiv.innerHTML = summaryHTML;
    }

    // Display AI recommendations
    if (results.recommendations) {
        let recsHTML = '';

        Object.entries(results.recommendations).forEach(([category, recommendations]) => {
            if (recommendations && recommendations.length > 0) {
                recsHTML += `
                    <div class="recommendation-category">
                        <h4>${category.toUpperCase()}</h4>
                        <ul class="recommendation-list">
                `;

                recommendations.forEach(rec => {
                    recsHTML += `<li class="recommendation-item">💡 ${rec}</li>`;
                });

                recsHTML += `
                        </ul>
                    </div>
                `;
            }
        });

        if (recsHTML === '') {
            recsHTML = '<p class="no-recommendations">✓ Your track is well-matched to the reference!</p>';
        }

        recommendationsDiv.innerHTML = recsHTML;
    }
}

function startOver() {
    // Reset all state
    sessionId = null;
    referenceType = null;
    referenceReady = false;
    playlistFiles = [];
    referenceTrackFile = null;
    userTrackFile = null;
    playlistProfile = null;
    maxStepReached = 1; // Reset max step

    // Clear UI
    document.querySelectorAll('.reference-card').forEach(card => card.classList.remove('selected'));
    document.querySelectorAll('.reference-upload-section').forEach(section => section.style.display = 'none');
    document.getElementById('playlist-file-list').innerHTML = '';
    document.getElementById('user-track-name').textContent = '';
    document.getElementById('user-track-name').classList.remove('has-file');

    // Go back to step 1
    goToStep(1);

    showMessage('Ready for a new comparison!', 'success');
}

async function exportReport() {
    if (!sessionId) {
        showMessage('No session data available for report', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/report/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ session_id: sessionId })
        });

        if (handleAuthError(response)) return;

        if (!response.ok) throw new Error('Report generation failed');

        const data = await response.json();
        window.open(data.report_url, '_blank');
        showMessage('Report generated successfully!', 'success');

    } catch (error) {
        console.error('Report error:', error);
        showMessage('Report generation failed: ' + error.message, 'error');
    }
}

// ===== NAVIGATION =====

function initializeNavigation() {
    document.getElementById('back-to-step-1')?.addEventListener('click', () => goToStep(1));

    // Make progress steps clickable
    const progressSteps = document.querySelectorAll('.progress-step');
    progressSteps.forEach((step, index) => {
        const stepNumber = index + 1;

        step.addEventListener('click', () => {
            // Allow clicking on completed or active steps only
            if (step.classList.contains('completed') || step.classList.contains('active')) {
                goToStep(stepNumber);
            }
        });
    });
}

function goToStep(stepNumber) {
    // Update max step reached
    if (stepNumber > maxStepReached) {
        maxStepReached = stepNumber;
    }

    // Hide all steps
    document.querySelectorAll('.wizard-step').forEach(step => {
        step.style.display = 'none';
    });

    // Show target step
    document.getElementById(`step-${stepNumber}`).style.display = 'block';

    // Update progress indicator
    document.querySelectorAll('.progress-step').forEach((step, index) => {
        step.classList.remove('active', 'completed');
        const currentStep = index + 1;

        if (currentStep === stepNumber) {
            // Current step is active
            step.classList.add('active');
        } else if (currentStep <= maxStepReached) {
            // All steps up to max reached are completed (accessible)
            step.classList.add('completed');
        }
    });

    // If going to Step 2 in AI Mode, ensure ALL parameter selections are hidden
    if (stepNumber === 2 && analysisMode === 'ai') {
        const parameterSelections = document.querySelectorAll('.parameter-selection-wizard');
        parameterSelections.forEach(section => {
            section.style.display = 'none';
        });
    }

    // If going to Step 1 or Step 2 in Standard Mode, ensure parameter selections are visible
    if ((stepNumber === 1 || stepNumber === 2) && analysisMode === 'standard') {
        const parameterSelections = document.querySelectorAll('.parameter-selection-wizard');
        parameterSelections.forEach(section => {
            section.style.display = 'block';
        });
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== PARAMETER SELECTION =====

function initializeParameterSelection() {
    const params = {
        'Tier 0: Basic Stats (Fast)': ['bpm', 'key', 'loudness', 'energy', 'dynamic_range'],
        'Tier 1: Spectral (Fast)': ['spectral_rolloff', 'spectral_flatness', 'zero_crossing_rate'],
        'Tier 1B: Energy Distribution': ['low_energy', 'mid_energy', 'high_energy'],
        'Tier 2: Perceptual': ['danceability', 'beat_strength', 'sub_bass_presence', 'stereo_width', 'valence', 'key_confidence'],
        'Tier 3: Production': ['loudness_range', 'true_peak', 'crest_factor', 'spectral_contrast', 'transient_energy', 'harmonic_to_noise_ratio'],
        'Tier 4: Compositional': ['harmonic_complexity', 'melodic_range', 'rhythmic_density', 'arrangement_density', 'repetition_score', 'frequency_occupancy', 'timbral_diversity', 'vocal_instrumental_ratio', 'energy_curve', 'call_response_presence']
    };

    // Populate parameters for Step 2 (wizard-param-groups)
    const wizardParamGroups = document.getElementById('wizard-param-groups');
    if (wizardParamGroups) {
        let html = '';
        Object.entries(params).forEach(([group, paramList]) => {
            html += `<div class="param-group"><h4>${group}</h4>`;
            paramList.forEach(param => {
                html += `<label><input type="checkbox" name="wizard-param" value="${param}"> ${formatParamName(param)}</label>`;
            });
            html += `</div>`;
        });
        wizardParamGroups.innerHTML = html;

        // Add change listeners
        document.querySelectorAll('input[name="wizard-param"]').forEach(checkbox => {
            checkbox.addEventListener('change', updateCompareButton);
        });

        // Select essential params by default (without scrolling)
        const essentialParams = ['bpm', 'key', 'loudness', 'energy', 'dynamic_range', 'spectral_rolloff', 'low_energy', 'mid_energy', 'high_energy', 'danceability', 'beat_strength'];
        document.querySelectorAll('input[name="wizard-param"]').forEach(cb => {
            if (essentialParams.includes(cb.value)) cb.checked = true;
        });
    }

    // Populate parameters for Playlist Analysis (playlist-param-groups)
    const playlistParamGroups = document.getElementById('playlist-param-groups');
    if (playlistParamGroups) {
        let html = '';
        Object.entries(params).forEach(([group, paramList]) => {
            html += `<div class="param-group"><h4>${group}</h4>`;
            paramList.forEach(param => {
                html += `<label><input type="checkbox" name="playlist-param" value="${param}"> ${formatParamName(param)}</label>`;
            });
            html += `</div>`;
        });
        playlistParamGroups.innerHTML = html;

        // Add change listeners to update analyze button
        document.querySelectorAll('input[name="playlist-param"]').forEach(checkbox => {
            checkbox.addEventListener('change', updateAnalyzeButton);
        });

        // Select essential params by default (without scrolling)
        const essentialPlaylistParams = ['bpm', 'key', 'loudness', 'energy', 'dynamic_range', 'spectral_rolloff', 'low_energy', 'mid_energy', 'high_energy', 'danceability', 'beat_strength'];
        document.querySelectorAll('input[name="playlist-param"]').forEach(cb => {
            if (essentialPlaylistParams.includes(cb.value)) cb.checked = true;
        });
    }
}

function getSelectedParameters() {
    const checkboxes = document.querySelectorAll('input[name="wizard-param"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function selectEssentialParams() {
    const essential = ['spectral_rolloff', 'low_energy', 'mid_energy', 'high_energy', 'danceability', 'beat_strength'];
    document.querySelectorAll('input[name="wizard-param"]').forEach(cb => {
        cb.checked = essential.includes(cb.value);
    });
    updateCompareButton();
    highlightPresetButton('select-essential');

    // Auto-scroll to compare button
    setTimeout(() => {
        const compareBtn = document.getElementById('compare-now-btn');
        if (compareBtn && !compareBtn.disabled) {
            compareBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

function selectAllParams() {
    document.querySelectorAll('input[name="wizard-param"]').forEach(cb => {
        cb.checked = true;
    });
    updateCompareButton();
    highlightPresetButton('select-all-params');

    // Auto-scroll to compare button
    setTimeout(() => {
        const compareBtn = document.getElementById('compare-now-btn');
        if (compareBtn && !compareBtn.disabled) {
            compareBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

function selectEssentialPlaylistParams() {
    const essential = ['spectral_rolloff', 'low_energy', 'mid_energy', 'high_energy', 'danceability', 'beat_strength'];
    document.querySelectorAll('input[name="playlist-param"]').forEach(cb => {
        cb.checked = essential.includes(cb.value);
    });
    updateAnalyzeButton();
    highlightPresetButton('select-essential-playlist');

    // Auto-scroll to analyze button
    setTimeout(() => {
        const analyzeBtn = document.getElementById('analyze-playlist-btn');
        if (analyzeBtn && !analyzeBtn.disabled) {
            analyzeBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

function selectAllPlaylistParams() {
    document.querySelectorAll('input[name="playlist-param"]').forEach(cb => {
        cb.checked = true;
    });
    updateAnalyzeButton();
    highlightPresetButton('select-all-params-playlist');

    // Auto-scroll to analyze button
    setTimeout(() => {
        const analyzeBtn = document.getElementById('analyze-playlist-btn');
        if (analyzeBtn && !analyzeBtn.disabled) {
            analyzeBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

function updateAnalyzeButton() {
    const analyzeBtn = document.getElementById('analyze-playlist-btn');
    const hasFiles = playlistFiles.length >= 2 && playlistFiles.length <= 30;
    const hasParams = getPlaylistParameters().length > 0;
    if (analyzeBtn) {
        analyzeBtn.disabled = !(hasFiles && hasParams);
        // Visual feedback if files are ready but params are not?
        if (hasFiles && !hasParams) {
             // Maybe we should auto-select essential params if none selected?
             // checking this on click would be better, but for now let's just leave it.
        }
    }
}

function getPlaylistParameters() {
    const checkboxes = document.querySelectorAll('input[name="playlist-param"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// ===== PRESETS =====

const SYSTEM_PRESETS = [
    {
        id: 'sys_modern_pop',
        name: '🏆 Modern Pop Hit (2024)',
        type: 'system',
        timestamp: new Date().toISOString(),
        profile: {
            'bpm': { mean: 122.0, std: 4.0, min: 90, max: 160 },
            'energy': { mean: 0.72, std: 0.1, min: 0.4, max: 0.95 },
            'danceability': { mean: 0.75, std: 0.08, min: 0.5, max: 0.9 },
            'loudness': { mean: -6.5, std: 1.5, min: -10, max: -4 },
            'spectral_rolloff': { mean: 4500, std: 1200, min: 2000, max: 8000 },
            'low_energy': { mean: 25.0, std: 5.0, min: 10, max: 40 },
            'mid_energy': { mean: 45.0, std: 5.0, min: 30, max: 60 },
            'high_energy': { mean: 30.0, std: 5.0, min: 10, max: 50 },
            'beat_strength': { mean: 3.5, std: 0.5, min: 2, max: 5 },
            'dynamic_range': { mean: 6.0, std: 2.0, min: 3, max: 12 }
        }
    },
    {
        id: 'sys_techno_bunker',
        name: '🎹 Techno Bunker',
        type: 'system',
        timestamp: new Date().toISOString(),
        profile: {
            'bpm': { mean: 132.0, std: 2.0, min: 128, max: 135 },
            'energy': { mean: 0.85, std: 0.05, min: 0.7, max: 0.98 },
            'danceability': { mean: 0.78, std: 0.05, min: 0.6, max: 0.9 },
            'loudness': { mean: -5.5, std: 1.0, min: -8, max: -3 },
            'sub_bass_presence': { mean: 35.0, std: 8.0, min: 20, max: 60 },
            'repetition_score': { mean: 0.85, std: 0.1, min: 0.5, max: 1.0 },
            'stereo_width': { mean: 0.7, std: 0.15, min: 0.4, max: 0.9 }
        }
    },
    {
        id: 'sys_lofi_study',
        name: '☕ Lo-Fi Study Beats',
        type: 'system',
        timestamp: new Date().toISOString(),
        profile: {
            'bpm': { mean: 85.0, std: 5.0, min: 70, max: 95 },
            'energy': { mean: 0.4, std: 0.1, min: 0.2, max: 0.6 },
            'danceability': { mean: 0.6, std: 0.1, min: 0.4, max: 0.8 },
            'loudness': { mean: -12.0, std: 2.0, min: -16, max: -9 },
            'transient_energy': { mean: 15.0, std: 5.0, min: 5, max: 30 },
            'harmonic_to_noise_ratio': { mean: 8.0, std: 3.0, min: 0, max: 15 } // Lower HNR = more noise/texture
        }
    }
];

async function loadPresetsForWizard() {
    const systemPresets = SYSTEM_PRESETS;
    let userPresets = [];

    if (authToken) {
        // Fetch from cloud
        try {
            const response = await fetch(`${API_BASE}/api/presets`, { headers: getAuthHeaders() });
            if (handleAuthError(response)) return { system: systemPresets, user: [] }; // Handle re-login
            if (!response.ok) throw new Error('Failed to fetch cloud presets');
            userPresets = await response.json();
        } catch (error) {
            console.error('Error fetching cloud presets:', error);
            showMessage('Failed to load your cloud presets.', 'error');
        }
    } else {
        // If not logged in, user presets are empty (only system presets are shown)
        // User presets should not be loaded from localStorage if not logged in,
        // as the expectation is cloud-based storage when authenticated.
    }
    return { system: systemPresets, user: userPresets };
}

function renderPresetsInWizard() {
    const { system, user } = loadPresetsForWizard();
    // Wait for promise if needed, but loadPresetsForWizard is async now
    // We should call it and then render. 
    // BUT since we can't await easily in top-level or here without major refactor, 
    // let's handle the promise inside.
    
    loadPresetsForWizard().then(({ system, user }) => {
        const listDiv = document.getElementById('preset-list-display');

        if (system.length === 0 && user.length === 0) {
            listDiv.innerHTML = '<p class="placeholder">No presets available</p>';
            return;
        }

        let html = '<div class="presets-split-view">';

        // LEFT COLUMN: User Presets
        html += '<div class="presets-column user-column">';
        html += '<h4 class="preset-group-title">👤 Your Presets</h4>';
        html += '<div class="preset-list-content">';
        if (user.length > 0) {
            user.forEach((preset) => { 
                html += createPresetHTML(preset, 'user');
            });
        } else {
            if (authToken) {
                html += '<p class="placeholder small">You haven\'t saved any presets to the cloud yet.</p>';
            } else {
                html += '<p class="placeholder small">Please login to see and save your cloud presets.</p>';
            }
        }
        html += '</div>';
        // Integrated Footer Button
        html += '<button id="integrated-import-btn" class="preset-import-footer-btn">IMPORT PRESET FILE</button>';
        html += '</div>'; // Close column

        // RIGHT COLUMN: System Presets
        html += '<div class="presets-column system-column">';
        html += '<h4 class="preset-group-title">🏆 Official Algorithms</h4>';
        html += '<div class="preset-list-content">';
        if (system.length > 0) {
            system.forEach((preset) => {
                html += createPresetHTML(preset, 'system');
            });
        }
        html += '</div></div>'; // Close content and column

        html += '</div>'; // Close split view

        listDiv.innerHTML = html;

        // Re-attach import listener to the new integrated button
        const newImportBtn = document.getElementById('integrated-import-btn');
        const importInput = document.getElementById('import-preset-wizard-file');
        if (newImportBtn && importInput) {
            newImportBtn.addEventListener('click', () => importInput.click());
        }

        // Add click handlers for LOAD
        listDiv.querySelectorAll('.preset-btn.load').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.dataset.type;
                let preset;
                if (type === 'system') {
                    preset = system.find(p => p.id === e.target.dataset.id);
                } else { // type === 'user'
                    // For user presets, we need to fetch it from the backend list by id
                    const presetId = parseInt(e.target.dataset.id);
                    preset = user.find(p => p.id === presetId);
                }
                if (preset) {
                    loadPresetInWizard(preset);
                } else {
                    showMessage('Preset not found!', 'error');
                }
            });
        });

        // Add click handlers for DELETE (User only)
        listDiv.querySelectorAll('.preset-btn.delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!authToken) {
                    showMessage('Please login to delete your presets.', 'error');
                    return;
                }
                if (confirm('Are you sure you want to delete this preset?')) {
                    const presetId = parseInt(e.target.dataset.id); // Get ID from data-id attribute

                    try {
                        const response = await fetch(`${API_BASE}/api/presets/${presetId}`, {
                            method: 'DELETE',
                            headers: getAuthHeaders()
                        });
                        if (handleAuthError(response)) return;
                        if (!response.ok) throw new Error('Failed to delete cloud preset');

                        renderPresetsInWizard(); // Re-render list
                        showMessage('Preset deleted successfully from cloud.', 'success');
                    } catch (error) {
                        console.error('Cloud delete failed:', error);
                        showMessage('Failed to delete preset from cloud: ' + error.message, 'error');
                    }
                }
            });
        });
    });
}

function createPresetHTML(preset, type) { // Removed index, using ID for cloud
    const isSystem = type === 'system';
    const dateStr = new Date(preset.timestamp).toLocaleDateString();
    
    // For user presets, data-id will be backend ID
    // For system presets, data-id is system ID (string)
    const loadDataAttrs = isSystem ? `data-type="system" data-id="${preset.id}"` : `data-type="user" data-id="${preset.id}"`; 
    
    let actionsHTML = `<button class="preset-btn load" ${loadDataAttrs}>Load</button>`;
    
    if (!isSystem) {
        actionsHTML += `<button class="preset-btn delete" data-id="${preset.id}" title="Delete Preset">✕</button>`;
    } else {
        actionsHTML += `<span class="system-badge" title="Official Preset">🔒</span>`;
    }

    return `
        <div class="preset-item wizard-preset ${isSystem ? 'system-preset' : ''}">
            <div class="preset-info">
                <span class="preset-name">${preset.name}</span>
                <span class="preset-date">${isSystem ? 'Official Algorithm' : dateStr}</span>
            </div>
            <div class="preset-actions">
                ${actionsHTML}
            </div>
        </div>
    `;
}

async function loadPresetInWizard(preset) {
    try {
        // Send preset to backend
        const response = await fetch(`${API_BASE}/api/preset/load`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                profile: preset.profile,
                analysis: preset.analysis || [] // analysis might be empty for cloud-saved
            })
        });

        if (handleAuthError(response)) return;

        if (!response.ok) throw new Error('Failed to load preset');

        const data = await response.json();
        sessionId = data.session_id;
        playlistProfile = preset.profile;

        referenceReady = true;
        document.getElementById('wizard-reference-ready').textContent = 'true';

        showMessage(`Preset "${preset.name}" loaded! Proceed to Step 2 →`, 'success');
        enableStep2Navigation();

        // Auto-scroll to next button
        setTimeout(() => {
            const nextBtn = document.querySelector('.next-to-step-2');
            if (nextBtn) {
                nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 200);

    } catch (error) {
        console.error('Preset load error:', error);
        showMessage('Failed to load preset', 'error');
    }
}

function showSavePresetModal() {
    if (!playlistProfile) {
        showMessage('Please analyze a playlist first', 'error');
        return;
    }
    document.getElementById('save-preset-modal').style.display = 'flex';
}

async function savePreset() {
    const nameInput = document.getElementById('preset-name-input-wizard');
    const name = nameInput.value.trim();
    
    if (!name) {
        alert('Please enter a preset name');
        return;
    }
    
    if (!playlistProfile) {
        alert('No profile data to save');
        return;
    }

    if (!authToken) {
        showMessage('Please login to save presets to the cloud.', 'error');
        return;
    }
    
    const presetData = {
        name: name,
        profile: playlistProfile,
        // analysis: playlistAnalysis // analysis is not stored in cloud preset schema
    };

    try {
        const response = await fetch(`${API_BASE}/api/presets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(presetData)
        });

        if (handleAuthError(response)) return;
        if (!response.ok) throw new Error('Failed to save preset to cloud');

        // After saving, refresh the list to show new preset
        renderPresetsInWizard();
        showMessage(`Preset "${name}" saved to cloud!`, 'success');
        document.getElementById('save-preset-modal').style.display = 'none';
        nameInput.value = '';

    } catch (error) {
        console.error('Cloud save failed:', error);
        showMessage('Failed to save preset to cloud: ' + error.message, 'error');
    }
}

async function importPresetFile(file) {
    const reader = new FileReader();
    reader.onload = async (e) => { // Make this async
        try {
            const preset = JSON.parse(e.target.result);

            // 1. Validation
            if (!preset || typeof preset !== 'object') {
                throw new Error('File content is not a valid JSON object');
            }

            // Check for critical data
            if (!preset.profile || Object.keys(preset.profile).length === 0) {
                throw new Error('Preset is missing valid playlist profile data');
            }

            // Ensure name and ID exist
            if (!preset.name) {
                preset.name = file.name.replace(/\.json$/i, '');
            }

            // For imported, always use a new ID if saving to cloud
            preset.id = 'imported_' + Date.now();

            if (!authToken) {
                showMessage('Please login to import and save presets to the cloud.', 'error');
                // Reset file input
                const importInput = document.getElementById('import-preset-wizard-file');
                if (importInput) importInput.value = '';
                return;
            }

            // Save imported preset to cloud
            const presetData = {
                name: preset.name,
                profile: preset.profile
            };

            const response = await fetch(`${API_BASE}/api/presets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(presetData)
            });

            if (handleAuthError(response)) {
                // Reset file input
                const importInput = document.getElementById('import-preset-wizard-file');
                if (importInput) importInput.value = '';
                return;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Failed to import and save preset to cloud');
            }

            // After saving, refresh the list to show new preset
            renderPresetsInWizard();
            showMessage(`Preset "${preset.name}" imported and saved to cloud!`, 'success');

            // Load it into the wizard immediately
            loadPresetInWizard(preset);

            // Reset file input
            const importInput = document.getElementById('import-preset-wizard-file');
            if (importInput) importInput.value = '';

        } catch (error) {
            console.error('Import error:', error);
            showMessage('Invalid preset file: ' + error.message, 'error');
            // Reset file input even on error
            const importInput = document.getElementById('import-preset-wizard-file');
            if (importInput) importInput.value = '';
        }
    };

    reader.onerror = () => {
        showMessage('Failed to read file', 'error');
        // Reset file input
        const importInput = document.getElementById('import-preset-wizard-file');
        if (importInput) importInput.value = '';
    };

    reader.readAsText(file);
}

// ===== UTILITIES =====

function setupDragDrop(dropZone, fileInput, callback) {
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        callback(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
        callback(e.target.files);
    });
}

function formatParamName(key) {
    return key.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

function formatValue(value) {
    if (typeof value === 'number') {
        return value.toFixed(2);
    }
    return value;
}

function showMessage(text, type = 'success') {
    const message = document.createElement('div');
    message.className = `wizard-message ${type}`;
    message.textContent = text;

    const container = document.querySelector('.wizard-step[style*="display: block"]') || document.querySelector('.wizard-step');
    if (container) { // Ensure container exists
        container.insertBefore(message, container.firstChild);
    } else {
        // Fallback for messages if wizard not visible (e.g., login screen)
        document.body.appendChild(message);
    }

    setTimeout(() => message.remove(), 5000);
}

function highlightPresetButton(selectedButtonId) {
    // Find the parent quick select container
    const parentContainer = document.getElementById(selectedButtonId).closest('.param-quick-select');
    if (parentContainer) {
        // Remove active class from all buttons in this container
        parentContainer.querySelectorAll('button.btn').forEach(btn => {
            btn.classList.remove('active-preset-btn');
        });
        // Add active class to the selected button
        document.getElementById(selectedButtonId)?.classList.add('active-preset-btn');
    }
}

// ===== CREDITS SYSTEM =====

async function fetchCredits() {
    if (!authToken) return;

    try {
        const response = await fetch(`${API_BASE}/api/credits/balance`, {
            headers: getAuthHeaders()
        });

        if (handleAuthError(response)) return;

        if (response.ok) {
            const data = await response.json();
            updateCreditsDisplay(data.credits);
        }
    } catch (error) {
        console.error('Failed to fetch credits:', error);
    }
}

function updateCreditsDisplay(credits) {
    const creditsAmountEl = document.getElementById('credits-amount');
    const creditsDisplayEl = document.getElementById('credits-display');

    if (creditsAmountEl) {
        creditsAmountEl.textContent = credits;
    }

    // Show/hide credits display based on auth
    if (creditsDisplayEl) {
        creditsDisplayEl.style.display = authToken ? 'block' : 'none';
    }
}

// Initialize coupon modal
function initializeCouponModal() {
    const addCreditsBtn = document.getElementById('add-credits-btn');
    const couponModal = document.getElementById('coupon-modal');
    const couponCancelBtn = document.getElementById('coupon-cancel-btn');
    const redeemCouponBtn = document.getElementById('redeem-coupon-btn');
    const couponCodeInput = document.getElementById('coupon-code-input');
    const couponMessageEl = document.getElementById('coupon-message');

    // Open modal
    addCreditsBtn?.addEventListener('click', () => {
        if (couponModal) {
            couponModal.style.display = 'flex';
            couponCodeInput.value = '';
            couponMessageEl.style.display = 'none';
            couponMessageEl.textContent = '';
        }
    });

    // Close modal
    couponCancelBtn?.addEventListener('click', () => {
        if (couponModal) couponModal.style.display = 'none';
    });

    // Redeem coupon
    redeemCouponBtn?.addEventListener('click', async () => {
        const code = couponCodeInput?.value.trim();

        if (!code) {
            showCouponMessage('Please enter a coupon code', 'error');
            return;
        }

        if (!authToken) {
            showCouponMessage('Please login first', 'error');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/credits/redeem`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({ code: code.toUpperCase() })
            });

            const data = await response.json();

            if (response.ok) {
                // Success!
                showCouponMessage(data.message, 'success');
                updateCreditsDisplay(data.new_balance);

                // Clear input and close modal after 2s
                setTimeout(() => {
                    if (couponModal) couponModal.style.display = 'none';
                    couponCodeInput.value = '';
                }, 2000);

            } else {
                // Error
                showCouponMessage(data.detail || 'Failed to redeem coupon', 'error');
            }

        } catch (error) {
            showCouponMessage('Failed to redeem coupon', 'error');
            console.error('Coupon redemption error:', error);
        }
    });

    function showCouponMessage(message, type) {
        if (!couponMessageEl) return;

        couponMessageEl.textContent = message;
        couponMessageEl.style.display = 'block';

        if (type === 'success') {
            couponMessageEl.style.backgroundColor = '#1DB954';
            couponMessageEl.style.color = '#fff';
        } else {
            couponMessageEl.style.backgroundColor = '#ff4444';
            couponMessageEl.style.color = '#fff';
        }
    }
}

// Call this on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeCouponModal();
});