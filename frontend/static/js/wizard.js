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

    document.getElementById('analyze-playlist-btn')?.addEventListener('click', analyzePlaylist);

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

        updateProgressModal(40, `Analyzing ${playlistFiles.length} tracks... This may take a minute.`);

        // Get selected parameters from playlist params
        const selectedParams = getPlaylistParameters();

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
            signal: abortController.signal
        });

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
    }
}

function getPlaylistParameters() {
    const checkboxes = document.querySelectorAll('input[name="playlist-param"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
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
