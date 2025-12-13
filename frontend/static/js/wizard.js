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

// ===== AUTHENTICATION =====
let authToken = localStorage.getItem('access_token');

function getAuthHeaders() {
    return authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
}

function handleAuthError(response) {
    if (response.status === 401) {
        showMessage('Session expired. Please login again.', 'error');
        authToken = null;
        localStorage.removeItem('access_token');
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.textContent = 'Login';
            loginBtn.classList.replace('btn-primary', 'btn-secondary');
        }
        const loginModal = document.getElementById('login-modal');
        if (loginModal) loginModal.style.display = 'flex';
        return true;
    }
    return false;
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
    // const loginBtn = document.getElementById('login-btn'); // Removed as per user request
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    
    // UI Elements for Auth State
    const mainAppContent = document.getElementById('main-app-content');
    const landingHero = document.getElementById('landing-hero');
    const logoutBtnHeader = document.getElementById('logout-btn-header'); // New button

    function updateUIState() {
        if (authToken) {
            // Logged In
            if (mainAppContent) mainAppContent.style.display = 'block';
            if (landingHero) landingHero.style.display = 'none';
            if (logoutBtnHeader) logoutBtnHeader.style.display = 'inline-block'; // Show logout
        } else {
            // Logged Out
            if (mainAppContent) mainAppContent.style.display = 'none';
            if (landingHero) landingHero.style.display = 'block';
            if (logoutBtnHeader) logoutBtnHeader.style.display = 'none'; // Hide logout
        }
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

    // New Logout Button in Header
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
            
            updateUIState();
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
                updateUIState();
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

        // Load presets if any
        loadPresetsForWizard();
    } catch (error) {
        console.error("Wizard initialization failed:", error);
        alert("Wizard initialization failed. Please reload the page. Error: " + error.message);
    }
}

// ===== COLLAPSIBLE SECTIONS =====
function initializeCollapsibleSections() {
    // Use event delegation for robustness
    document.addEventListener('click', (e) => {
        const header = e.target.closest('.collapsible-header');
        if (!header) return;

        const targetId = header.dataset.target;
        const content = document.getElementById(targetId);
        
        if (content) {
            e.preventDefault(); // Prevent text selection or other defaults
            
            header.classList.toggle('active');
            content.classList.toggle('collapsed');
            
            // Update collapse icon
            const icon = header.querySelector('.collapse-icon');
            if (icon) {
                icon.textContent = header.classList.contains('active') ? '▼' : '▶';
            }
            
            // Adjust max-height
            if (content.classList.contains('collapsed')) {
                content.style.maxHeight = null;
            } else {
                // Ensure we get a value even if slightly off
                const height = content.scrollHeight || 1000;
                content.style.maxHeight = height + "px";
            }
        }
    });
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
    if (playlistFiles.length < 2) {
        showMessage('Please upload at least 2 tracks', 'error');
        return;
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
        
        // Estimate 2 seconds per track for simulation speed
        const estimatedDuration = totalTracks * 2000; 
        const intervalTime = 200;
        const totalSteps = estimatedDuration / intervalTime;
        const progressIncrement = (55 / totalSteps); // Move from 40% to 95%

        if (progressModalInterval) clearInterval(progressModalInterval);
        
        progressModalInterval = setInterval(() => {
            currentProgress += progressIncrement;
            if (currentProgress > 95) currentProgress = 95; // Cap at 95% until done

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
        nameContainer.innerHTML = `
            <span class="file-name">🎵 ${referenceTrackFile.name}</span>
            <button class="btn-remove">✕</button>
        `;
        nameContainer.classList.add('has-file');
        document.getElementById('confirm-reference-btn').disabled = false;

        // Add remove functionality
        nameContainer.querySelector('.btn-remove').addEventListener('click', () => {
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
    const modal = document.getElementById('save-preset-modal');
    const input = document.getElementById('preset-name-input-wizard');
    const saveBtn = document.getElementById('preset-save-confirm-wizard');
    const cancelBtn = document.getElementById('preset-save-cancel-wizard');

    modal.style.display = 'flex';
    input.value = '';
    input.focus();

    // Handle save
    const handleSave = () => {
        const name = input.value.trim();
        if (!name) {
            showMessage('Please enter a preset name', 'error');
            return;
        }

        savePlaylistPreset(name);
        modal.style.display = 'none';
        saveBtn.removeEventListener('click', handleSave);
        cancelBtn.removeEventListener('click', handleCancel);
    };

    // Handle cancel
    const handleCancel = () => {
        modal.style.display = 'none';
        saveBtn.removeEventListener('click', handleSave);
        cancelBtn.removeEventListener('click', handleCancel);
    };

    saveBtn.addEventListener('click', handleSave);
    cancelBtn.addEventListener('click', handleCancel);

    // Enter key to save
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSave();
        }
    });
}

function savePlaylistPreset(name) {
    if (!playlistProfile || !playlistAnalysis) {
        showMessage('No playlist data to save', 'error');
        return;
    }

    const preset = {
        name: name,
        timestamp: Date.now(),
        profile: playlistProfile,
        analysis: playlistAnalysis
    };

    // Get existing presets
    let presets = JSON.parse(localStorage.getItem('audio_presets') || '[]');

    // Add new preset
    presets.unshift(preset); // Add to beginning

    // Save to localStorage
    localStorage.setItem('audio_presets', JSON.stringify(presets));

    showMessage(`Preset "${name}" saved successfully! ✓`, 'success');

    // Refresh preset list if visible
    renderPresetsInWizard();
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
        nameContainer.innerHTML = `
            <span class="file-name">🎵 ${userTrackFile.name}</span>
            <button class="btn-remove">✕</button>
        `;
        nameContainer.classList.add('has-file');

        // Add remove functionality
        nameContainer.querySelector('.btn-remove').addEventListener('click', () => {
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
    const hasParams = getSelectedParameters().length > 0;
    compareBtn.disabled = !(hasFile && hasParams);
}

async function compareTrack() {
    if (!userTrackFile || !referenceReady) {
        showMessage('Please complete all required fields', 'error');
        return;
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

    let currentStep = 0;

    // Function to update progress
    const updateProgress = () => {
        if (currentStep < progressSteps.length) {
            const step = progressSteps[currentStep];
            updateProgressModal(step.progress, step.message);
            currentStep++;
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

        // Hide modal and immediately display results
        hideProgressModal();
        displayResults(results);
        goToStep(3);

    } catch (error) {
        hideProgressModal();
        console.error('Comparison error:', error);
        showMessage('Comparison failed: ' + error.message, 'error');
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

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== PARAMETER SELECTION =====

function initializeParameterSelection() {
    const params = {
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
        const essentialParams = ['spectral_rolloff', 'low_energy', 'mid_energy', 'high_energy', 'danceability', 'beat_strength'];
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
        const essentialPlaylistParams = ['spectral_rolloff', 'low_energy', 'mid_energy', 'high_energy', 'danceability', 'beat_strength'];
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

function loadPresetsForWizard() {
    // Load from localStorage
    const userPresets = JSON.parse(localStorage.getItem('audio_presets') || '[]');
    // Return both system (first) and user presets
    return { system: SYSTEM_PRESETS, user: userPresets };
}

function renderPresetsInWizard() {
    const { system, user } = loadPresetsForWizard();
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
        user.forEach((preset, index) => {
            html += createPresetHTML(preset, 'user', index);
        });
    } else {
        html += '<p class="placeholder small">You haven\'t saved any presets yet.</p>';
    }
    html += '</div></div>'; // Close content and column

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

    // Add click handlers for LOAD
    listDiv.querySelectorAll('.preset-btn.load').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.target.dataset.type;
            let preset;
            if (type === 'system') {
                preset = system.find(p => p.id === e.target.dataset.id);
            } else {
                preset = user[parseInt(e.target.dataset.index)];
            }
            loadPresetInWizard(preset);
        });
    });

    // Add click handlers for DELETE (User only)
    listDiv.querySelectorAll('.preset-btn.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this preset?')) {
                const index = parseInt(e.target.dataset.index);
                const currentPresets = JSON.parse(localStorage.getItem('audio_presets') || '[]');
                currentPresets.splice(index, 1);
                localStorage.setItem('audio_presets', JSON.stringify(currentPresets));
                renderPresetsInWizard(); // Re-render list
                showMessage('Preset deleted successfully.', 'success');
            }
        });
    });
}

function createPresetHTML(preset, type, index = null) {
    const isSystem = type === 'system';
    const dateStr = new Date(preset.timestamp).toLocaleDateString();
    const loadDataAttrs = isSystem ? `data-type="system" data-id="${preset.id}"` : `data-type="user" data-index="${index}"`;
    
    let actionsHTML = `<button class="preset-btn load" ${loadDataAttrs}>Load</button>`;
    
    if (!isSystem) {
        actionsHTML += `<button class="preset-btn delete" data-index="${index}" title="Delete Preset">✕</button>`;
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
                analysis: preset.analysis
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
    document.getElementById('save-preset-modal').style.display = 'block';
}

function savePreset() {
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
    
    const preset = {
        id: Date.now().toString(),
        name: name,
        timestamp: new Date().toISOString(),
        profile: playlistProfile,
        analysis: playlistAnalysis || []
    };
    
    // Save to localStorage
    const currentPresets = JSON.parse(localStorage.getItem('audio_presets') || '[]');
    currentPresets.push(preset);
    localStorage.setItem('audio_presets', JSON.stringify(currentPresets));
    
    // Close modal
    document.getElementById('save-preset-modal').style.display = 'none';
    nameInput.value = '';
    
    // Refresh list if visible
    renderPresetsInWizard();
    
    showMessage(`Preset "${name}" saved successfully!`, 'success');
}

function importPresetFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
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
            
            // Generate new ID if missing or collision risk (though we check duplicates)
            if (!preset.id) {
                preset.id = 'imported_' + Date.now();
            }

            // 2. Save to LocalStorage (if not already present)
            const currentPresets = JSON.parse(localStorage.getItem('audio_presets') || '[]');
            
            // Check for duplicate ID
            const index = currentPresets.findIndex(p => p.id === preset.id);
            
            if (index === -1) {
                // Add new
                currentPresets.push(preset);
                localStorage.setItem('audio_presets', JSON.stringify(currentPresets));
                
                // 3. Refresh List UI
                renderPresetsInWizard();
                showMessage(`Preset "${preset.name}" imported and saved to list!`, 'success');
            } else {
                // Update existing? Or just notify. Let's just notify.
                showMessage(`Preset "${preset.name}" updated in list.`, 'success');
                currentPresets[index] = preset; // Update content just in case
                localStorage.setItem('audio_presets', JSON.stringify(currentPresets));
                renderPresetsInWizard();
            }

            // Load it into the wizard immediately
            loadPresetInWizard(preset);

        } catch (error) {
            console.error('Import error:', error);
            showMessage('Invalid preset file: ' + error.message, 'error');
        }
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
    container.insertBefore(message, container.firstChild);

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
