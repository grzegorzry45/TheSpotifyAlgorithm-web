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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log("Wizard interface loaded");
    initializeWizard();
});

function initializeWizard() {
    // Step 1: Reference selection
    initializeReferenceSelection();

    // Step 2: User track upload
    initializeUserTrackUpload();
    initializeParameterSelection();

    // Step 3: Results
    initializeResults();

    // Navigation
    initializeNavigation();

    // Load presets if any
    loadPresetsForWizard();
}

// ===== STEP 1: REFERENCE SELECTION =====

function initializeReferenceSelection() {
    const cards = document.querySelectorAll('.reference-card');

    cards.forEach(card => {
        const selectBtn = card.querySelector('.select-reference-btn');
        const refType = card.dataset.reference;

        selectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectReferenceType(refType);
        });
    });

    // Playlist upload
    const playlistUploadZone = document.getElementById('playlist-upload');
    const playlistFilesInput = document.getElementById('playlist-files');
    setupDragDrop(playlistUploadZone, playlistFilesInput, handlePlaylistFiles);

    document.getElementById('analyze-playlist-btn')?.addEventListener('click', analyzePlaylist);

    // Preset loading
    document.getElementById('import-preset-wizard-btn')?.addEventListener('click', () => {
        document.getElementById('import-preset-wizard-file').click();
    });

    document.getElementById('import-preset-wizard-file')?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            importPresetFile(e.target.files[0]);
        }
    });

    // Single reference track
    const referenceUploadZone = document.getElementById('reference-track-upload');
    const referenceFileInput = document.getElementById('reference-track-file');
    setupDragDrop(referenceUploadZone, referenceFileInput, handleReferenceTrack);

    document.getElementById('confirm-reference-btn')?.addEventListener('click', confirmReferenceTrack);
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

    // Show appropriate upload section
    if (type === 'playlist') {
        document.getElementById('playlist-upload-section').style.display = 'block';
    } else if (type === 'preset') {
        document.getElementById('preset-load-section').style.display = 'block';
        renderPresetsInWizard();
    } else if (type === 'single') {
        document.getElementById('single-upload-section').style.display = 'block';
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

    // Enable/disable analyze button
    const analyzeBtn = document.getElementById('analyze-playlist-btn');
    analyzeBtn.disabled = playlistFiles.length < 2 || playlistFiles.length > 30;
}

async function analyzePlaylist() {
    if (playlistFiles.length < 2) {
        showMessage('Please upload at least 2 tracks', 'error');
        return;
    }

    // Show progress
    const progressContainer = document.getElementById('playlist-progress');
    const progressFill = document.getElementById('playlist-progress-fill');
    const progressText = document.getElementById('playlist-progress-text');

    progressContainer.style.display = 'block';
    progressText.textContent = 'Uploading files...';
    progressFill.style.width = '10%';

    try {
        // Create abort controller
        abortController = new AbortController();

        // Upload files
        const formData = new FormData();
        playlistFiles.forEach(file => formData.append('files', file));

        const uploadResponse = await fetch(`${API_BASE}/api/upload/playlist`, {
            method: 'POST',
            body: formData,
            signal: abortController.signal
        });

        if (!uploadResponse.ok) throw new Error('Upload failed');

        const uploadData = await uploadResponse.json();
        sessionId = uploadData.session_id;

        progressFill.style.width = '40%';
        progressText.textContent = 'Analyzing audio features...';

        // Get selected parameters
        const selectedParams = getSelectedParameters();

        // Analyze playlist
        const analyzeResponse = await fetch(`${API_BASE}/api/analyze/playlist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: sessionId,
                additional_params: selectedParams
            }),
            signal: abortController.signal
        });

        if (!analyzeResponse.ok) throw new Error('Analysis failed');

        const analyzeData = await analyzeResponse.json();
        playlistProfile = analyzeData.profile;

        progressFill.style.width = '100%';
        progressText.textContent = 'Analysis complete!';

        // Mark reference as ready
        referenceReady = true;
        document.getElementById('wizard-reference-ready').textContent = 'true';

        // Show success and enable next step
        setTimeout(() => {
            showMessage('Playlist analyzed successfully! Proceed to Step 2 →', 'success');
            enableStep2Navigation();
        }, 500);

    } catch (error) {
        if (error.name === 'AbortError') {
            progressText.textContent = 'Cancelled';
        } else {
            console.error('Analysis error:', error);
            showMessage('Analysis failed: ' + error.message, 'error');
        }
        progressFill.style.width = '0%';
    }
}

function handleReferenceTrack(files) {
    if (files.length > 0) {
        referenceTrackFile = files[0];
        const nameContainer = document.getElementById('reference-track-name');
        nameContainer.textContent = referenceTrackFile.name;
        nameContainer.classList.add('has-file');
        document.getElementById('confirm-reference-btn').disabled = false;
    }
}

async function confirmReferenceTrack() {
    if (!referenceTrackFile) return;

    showMessage('Reference track confirmed! Proceed to Step 2 →', 'success');
    referenceReady = true;
    document.getElementById('wizard-reference-ready').textContent = 'true';
    enableStep2Navigation();
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

    // Quick select buttons
    document.getElementById('select-essential')?.addEventListener('click', selectEssentialParams);
    document.getElementById('select-all-params')?.addEventListener('click', selectAllParams);
}

function handleUserTrack(files) {
    if (files.length > 0) {
        userTrackFile = files[0];
        const nameContainer = document.getElementById('user-track-name');
        nameContainer.textContent = userTrackFile.name;
        nameContainer.classList.add('has-file');

        // Enable compare button if parameters selected
        updateCompareButton();
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

    const progressContainer = document.getElementById('comparison-progress');
    const progressFill = document.getElementById('comparison-progress-fill');
    const progressText = document.getElementById('comparison-progress-text');

    progressContainer.style.display = 'block';
    progressText.textContent = 'Analyzing your track...';
    progressFill.style.width = '30%';

    try {
        abortController = new AbortController();

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

        progressFill.style.width = '60%';
        progressText.textContent = 'Comparing parameters...';

        const response = await fetch(`${API_BASE}/api/compare/single`, {
            method: 'POST',
            body: formData,
            signal: abortController.signal
        });

        if (!response.ok) throw new Error('Comparison failed');

        const results = await response.json();

        progressFill.style.width = '100%';
        progressText.textContent = 'Complete!';

        // Display results
        setTimeout(() => {
            displayResults(results);
            goToStep(3);
        }, 500);

    } catch (error) {
        console.error('Comparison error:', error);
        showMessage('Comparison failed: ' + error.message, 'error');
        progressFill.style.width = '0%';
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

    // Display comparison summary
    if (results.user_track) {
        let summaryHTML = '<div class="param-comparison-grid">';

        Object.entries(results.user_track).forEach(([key, value]) => {
            if (key !== 'filename' && typeof value !== 'object') {
                summaryHTML += `
                    <div class="param-row">
                        <span class="param-name">${formatParamName(key)}</span>
                        <span class="param-value">${formatValue(value)}</span>
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId })
        });

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
}

function goToStep(stepNumber) {
    // Hide all steps
    document.querySelectorAll('.wizard-step').forEach(step => {
        step.style.display = 'none';
    });

    // Show target step
    document.getElementById(`step-${stepNumber}`).style.display = 'block';

    // Update progress indicator
    document.querySelectorAll('.progress-step').forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index + 1 === stepNumber) {
            step.classList.add('active');
        } else if (index + 1 < stepNumber) {
            step.classList.add('completed');
        }
    });

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== PARAMETER SELECTION =====

function initializeParameterSelection() {
    const paramGroups = document.getElementById('wizard-param-groups');

    // Populate parameter groups (same as original)
    const params = {
        'Tier 1: Spectral (Fast)': ['spectral_rolloff', 'spectral_flatness', 'zero_crossing_rate'],
        'Tier 1B: Energy Distribution': ['low_energy', 'mid_energy', 'high_energy'],
        'Tier 2: Perceptual': ['danceability', 'beat_strength', 'sub_bass_presence', 'stereo_width', 'valence', 'key_confidence'],
        'Tier 3: Production': ['loudness_range', 'true_peak', 'crest_factor', 'spectral_contrast', 'transient_energy', 'harmonic_to_noise_ratio'],
        'Tier 4: Compositional': ['harmonic_complexity', 'melodic_range', 'rhythmic_density', 'arrangement_density', 'repetition_score', 'frequency_occupancy', 'timbral_diversity', 'vocal_instrumental_ratio', 'energy_curve', 'call_response_presence']
    };

    let html = '';
    Object.entries(params).forEach(([group, paramList]) => {
        html += `<div class="param-group"><h4>${group}</h4>`;
        paramList.forEach(param => {
            html += `<label><input type="checkbox" name="wizard-param" value="${param}"> ${formatParamName(param)}</label>`;
        });
        html += `</div>`;
    });

    paramGroups.innerHTML = html;

    // Add change listeners
    document.querySelectorAll('input[name="wizard-param"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateCompareButton);
    });
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
}

function selectAllParams() {
    document.querySelectorAll('input[name="wizard-param"]').forEach(cb => {
        cb.checked = true;
    });
    updateCompareButton();
}

// ===== PRESETS =====

function loadPresetsForWizard() {
    // Load from localStorage
    const presets = JSON.parse(localStorage.getItem('audio_presets') || '[]');
    return presets;
}

function renderPresetsInWizard() {
    const presets = loadPresetsForWizard();
    const listDiv = document.getElementById('preset-list-display');

    if (presets.length === 0) {
        listDiv.innerHTML = '<p class="placeholder">No presets saved yet</p>';
        return;
    }

    let html = '';
    presets.forEach((preset, index) => {
        html += `
            <div class="preset-item wizard-preset" data-index="${index}">
                <div class="preset-info">
                    <span class="preset-name">${preset.name}</span>
                    <span class="preset-date">${new Date(preset.timestamp).toLocaleDateString()}</span>
                </div>
                <button class="preset-btn load" data-index="${index}">Load</button>
            </div>
        `;
    });

    listDiv.innerHTML = html;

    // Add click handlers
    listDiv.querySelectorAll('.preset-btn.load').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = e.target.dataset.index;
            loadPresetInWizard(presets[index]);
        });
    });
}

async function loadPresetInWizard(preset) {
    try {
        // Send preset to backend
        const response = await fetch(`${API_BASE}/api/preset/load`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                profile: preset.profile,
                analysis: preset.analysis
            })
        });

        if (!response.ok) throw new Error('Failed to load preset');

        const data = await response.json();
        sessionId = data.session_id;
        playlistProfile = preset.profile;

        referenceReady = true;
        document.getElementById('wizard-reference-ready').textContent = 'true';

        showMessage(`Preset "${preset.name}" loaded! Proceed to Step 2 →`, 'success');
        enableStep2Navigation();

    } catch (error) {
        console.error('Preset load error:', error);
        showMessage('Failed to load preset', 'error');
    }
}

function importPresetFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const preset = JSON.parse(e.target.result);
            loadPresetInWizard(preset);
        } catch (error) {
            showMessage('Invalid preset file', 'error');
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
