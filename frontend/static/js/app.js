// The Algorithm - Frontend JavaScript
// Handles all UI interactions and API communication

const API_BASE = '';  // Same origin
let sessionId = null;
let playlistFiles = [];
let userTrackFiles = [];
let userSingleFile = null;
let referenceFile = null;

// Abort controllers for cancelling operations
let playlistAbortController = null;
let batchAbortController = null;
let compareAbortController = null;

// Track if any operation is in progress
let isProcessing = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    initializeParameterSelection();
    initializePlaylistUpload();
    initializeUserTracksUpload();
    initializeSingleCompare();
    initializeRecommendations();
    initializeCancelButtons();
    initializeUnloadWarning();
});

// Warn user before leaving page during processing
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
        <button class="remove-track">×</button>
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
const PARAM_PRESETS = {
    essential: [],
    standard: ['spectral_rolloff', 'spectral_flatness', 'zero_crossing_rate', 'low_energy', 'mid_energy', 'high_energy'],
    advanced: ['spectral_rolloff', 'spectral_flatness', 'zero_crossing_rate', 'low_energy', 'mid_energy', 'high_energy',
               'danceability', 'beat_strength', 'sub_bass_presence', 'stereo_width', 'valence', 'key_confidence'],
    full: ['spectral_rolloff', 'spectral_flatness', 'zero_crossing_rate', 'low_energy', 'mid_energy', 'high_energy',
           'danceability', 'beat_strength', 'sub_bass_presence', 'stereo_width', 'valence', 'key_confidence',
           'loudness_range', 'true_peak', 'crest_factor', 'spectral_contrast', 'transient_energy', 'harmonic_to_noise_ratio',
           'harmonic_complexity', 'melodic_range', 'rhythmic_density', 'arrangement_density', 'repetition_score',
           'frequency_occupancy', 'timbral_diversity', 'vocal_instrumental_ratio', 'energy_curve', 'call_response_presence'],
    custom: []
};

function initializeParameterSelection() {
    // Initialize for Analyze Playlist tab
    const presetBtns = document.querySelectorAll('.preset-btn');
    const paramGroups = document.getElementById('param-groups');
    const checkboxes = document.querySelectorAll('input[name="param"]');

    // Preset button handlers
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;

            // Update active button
            presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Show/hide custom checkboxes
            if (preset === 'custom') {
                paramGroups.style.display = 'block';
            } else {
                paramGroups.style.display = 'none';
                applyPreset(preset, 'param');
            }
        });
    });

    // Checkbox change handler - switch to custom when user clicks
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            presetBtns.forEach(b => b.classList.remove('active'));
            document.querySelector('[data-preset="custom"]').classList.add('active');
            paramGroups.style.display = 'block';
        });
    });

    // Initialize for Compare tab
    const presetBtnsCompare = document.querySelectorAll('.preset-btn-compare');
    const paramGroupsCompare = document.getElementById('param-groups-compare');
    const checkboxesCompare = document.querySelectorAll('input[name="param-compare"]');

    // Preset button handlers for Compare
    presetBtnsCompare.forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;

            // Update active button
            presetBtnsCompare.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Show/hide custom checkboxes
            if (preset === 'custom') {
                paramGroupsCompare.style.display = 'block';
            } else {
                paramGroupsCompare.style.display = 'none';
                applyPreset(preset, 'param-compare');
            }
        });
    });

    // Checkbox change handler - switch to custom when user clicks
    checkboxesCompare.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            presetBtnsCompare.forEach(b => b.classList.remove('active'));
            const customBtn = document.querySelector('.preset-btn-compare[data-preset="custom"]');
            if (customBtn) customBtn.classList.add('active');
            paramGroupsCompare.style.display = 'block';
        });
    });
}

function applyPreset(preset, checkboxName) {
    const params = PARAM_PRESETS[preset];
    const checkboxes = document.querySelectorAll(`input[name="${checkboxName}"]`);

    checkboxes.forEach(checkbox => {
        checkbox.checked = params.includes(checkbox.value);
    });
}

function getSelectedParameters() {
    const activePreset = document.querySelector('.preset-btn.active').dataset.preset;

    if (activePreset !== 'custom') {
        return PARAM_PRESETS[activePreset];
    }

    // Custom selection
    const checkboxes = document.querySelectorAll('input[name="param"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function getSelectedParametersCompare() {
    const activePreset = document.querySelector('.preset-btn-compare.active');
    if (!activePreset) {
        return [];
    }

    const preset = activePreset.dataset.preset;

    if (preset !== 'custom') {
        return PARAM_PRESETS[preset];
    }

    // Custom selection
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
    const analyzeBtn = document.getElementById('analyze-playlist-btn');

    fileList.innerHTML = '';

    playlistFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <span>${file.name}</span>
            <button class="remove-file" data-index="${index}">×</button>
        `;
        fileList.appendChild(item);

        item.querySelector('.remove-file').addEventListener('click', (e) => {
            e.stopPropagation();
            playlistFiles.splice(index, 1);
            handlePlaylistFiles(playlistFiles);
        });
    });

    // Enable/disable analyze button
    analyzeBtn.disabled = playlistFiles.length < 15 || playlistFiles.length > 30;

    if (playlistFiles.length > 0 && playlistFiles.length < 15) {
        showError('Please upload at least 15 tracks');
    } else if (playlistFiles.length > 30) {
        showError('Maximum 30 tracks allowed');
    }
}

async function analyzePlaylist() {
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
            signal: playlistAbortController.signal
        });

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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: sessionId,
                additional_params: selectedParams
            }),
            signal: playlistAbortController.signal
        });

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

    const params = [
        { label: 'BPM', value: profile.bpm?.toFixed(1) },
        { label: 'Energy', value: profile.energy?.toFixed(2) },
        { label: 'Loudness', value: profile.loudness?.toFixed(1) + ' LUFS' },
        { label: 'Brightness', value: profile.spectral_centroid?.toFixed(0) + ' Hz' },
        { label: 'Dynamic Range', value: profile.dynamic_range?.toFixed(1) + ' dB' },
        { label: 'Danceability', value: profile.danceability?.toFixed(2) },
        { label: 'Low Energy', value: (profile.low_energy * 100)?.toFixed(1) + '%' },
        { label: 'Mid Energy', value: (profile.mid_energy * 100)?.toFixed(1) + '%' },
        { label: 'High Energy', value: (profile.high_energy * 100)?.toFixed(1) + '%' },
    ];

    params.forEach(param => {
        if (param.value && param.value !== 'undefined' && param.value !== 'NaN') {
            const item = document.createElement('div');
            item.className = 'profile-item';
            item.innerHTML = `
                <div class="label">${param.label}</div>
                <div class="value">${param.value}</div>
            `;
            container.appendChild(item);
        }
    });
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
            <button class="remove-file" data-index="${index}">×</button>
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
            signal: batchAbortController.signal
        });

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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: sessionId,
                additional_params: selectedParams
            }),
            signal: batchAbortController.signal
        });

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
    if (!sessionId && document.querySelector('input[name="compare-mode"]:checked').value === 'playlist') {
        // Create session if comparing vs playlist
        const formData = new FormData();
        const dummyFile = new File([''], 'dummy.mp3');
        for (let i = 0; i < 15; i++) formData.append('files', dummyFile);

        try {
            const response = await fetch(`${API_BASE}/api/upload/playlist`, {
                method: 'POST',
                body: formData
            });
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
            signal: compareAbortController.signal
        });

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

    // Create comparison rows for key parameters
    const params = [
        { key: 'bpm', label: 'BPM', format: (v) => v.toFixed(1) },
        { key: 'energy', label: 'Energy', format: (v) => v.toFixed(2) },
        { key: 'loudness', label: 'Loudness', format: (v) => v.toFixed(1) + ' LUFS' },
        { key: 'spectral_centroid', label: 'Brightness', format: (v) => v.toFixed(0) + ' Hz' },
        { key: 'dynamic_range', label: 'Dynamic Range', format: (v) => v.toFixed(1) + ' dB' },
        { key: 'danceability', label: 'Danceability', format: (v) => v.toFixed(2) },
    ];

    params.forEach(param => {
        if (userTrack[param.key] !== undefined && refData[param.key] !== undefined) {
            const diff = userTrack[param.key] - refData[param.key];
            const diffPercent = (diff / refData[param.key] * 100).toFixed(1);

            const row = document.createElement('div');
            row.className = 'comparison-row';
            row.innerHTML = `
                <div class="param-name">${param.label}</div>
                <div class="param-value">Your: ${param.format(userTrack[param.key])}</div>
                <div class="param-value">Target: ${param.format(refData[param.key])}</div>
                <div class="param-diff ${diff > 0 ? 'positive' : 'negative'}">
                    ${diff > 0 ? '+' : ''}${diffPercent}%
                </div>
            `;
            container.appendChild(row);
        }
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId })
        });

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
