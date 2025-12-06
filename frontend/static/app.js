// The Algorithm - Frontend JavaScript
// Handles all UI interactions and API communication

const API_BASE = '';  // Same origin
let sessionId = null;
let playlistFiles = [];
let userTrackFiles = [];
let userSingleFile = null;
let referenceFile = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    initializePlaylistUpload();
    initializeUserTracksUpload();
    initializeSingleCompare();
    initializeRecommendations();
});

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

    analyzeBtn.disabled = true;
    progressContainer.style.display = 'block';
    resultsPanel.style.display = 'none';

    try {
        // Upload files
        progressText.textContent = 'Uploading files...';
        progressFill.style.width = '20%';

        const formData = new FormData();
        playlistFiles.forEach(file => formData.append('files', file));

        const uploadResponse = await fetch(`${API_BASE}/api/upload/playlist`, {
            method: 'POST',
            body: formData
        });

        if (!uploadResponse.ok) {
            throw new Error('Upload failed');
        }

        const uploadData = await uploadResponse.json();
        sessionId = uploadData.session_id;
        document.getElementById('session-id').textContent = sessionId;

        // Analyze playlist
        progressText.textContent = 'Analyzing tracks...';
        progressFill.style.width = '60%';

        const analyzeResponse = await fetch(`${API_BASE}/api/analyze/playlist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId })
        });

        if (!analyzeResponse.ok) {
            throw new Error('Analysis failed');
        }

        const analyzeData = await analyzeResponse.json();

        // Complete
        progressFill.style.width = '100%';
        progressText.textContent = 'Analysis complete!';

        // Show results
        displayPlaylistProfile(analyzeData.profile);
        document.getElementById('has-playlist-profile').textContent = 'true';

        setTimeout(() => {
            progressContainer.style.display = 'none';
            resultsPanel.style.display = 'block';
        }, 500);

    } catch (error) {
        console.error('Error:', error);
        progressText.textContent = 'Error: ' + error.message;
        progressFill.style.width = '0%';
    } finally {
        analyzeBtn.disabled = false;
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

    compareBtn.disabled = true;
    progressContainer.style.display = 'block';

    try {
        // Upload user tracks
        progressText.textContent = 'Uploading your tracks...';
        progressFill.style.width = '25%';

        const formData = new FormData();
        userTrackFiles.forEach(file => formData.append('files', file));
        formData.append('session_id', sessionId);

        const uploadResponse = await fetch(`${API_BASE}/api/upload/user-tracks?session_id=${sessionId}`, {
            method: 'POST',
            body: formData
        });

        if (!uploadResponse.ok) {
            throw new Error('Upload failed');
        }

        // Compare tracks
        progressText.textContent = 'Analyzing and comparing...';
        progressFill.style.width = '70%';

        const compareResponse = await fetch(`${API_BASE}/api/compare/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId })
        });

        if (!compareResponse.ok) {
            throw new Error('Comparison failed');
        }

        const compareData = await compareResponse.json();

        // Complete
        progressFill.style.width = '100%';
        progressText.textContent = 'Comparison complete!';

        // Show recommendations
        displayRecommendations(compareData.recommendations);

        // Switch to recommendations tab
        setTimeout(() => {
            progressContainer.style.display = 'none';
            document.querySelector('[data-tab="recommendations"]').click();
        }, 500);

    } catch (error) {
        console.error('Error:', error);
        progressText.textContent = 'Error: ' + error.message;
        progressFill.style.width = '0%';
    } finally {
        compareBtn.disabled = false;
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
            document.getElementById('user-single-name').textContent = userSingleFile.name;
            updateCompareBtnState();
        }
    });
    setupDragDrop(userUploadZone, (files) => {
        if (files.length > 0) {
            userSingleFile = files[0];
            document.getElementById('user-single-name').textContent = userSingleFile.name;
            updateCompareBtnState();
        }
    });

    // Reference track upload
    refUploadZone.addEventListener('click', () => refFileInput.click());
    refFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            referenceFile = e.target.files[0];
            document.getElementById('reference-name').textContent = referenceFile.name;
            updateCompareBtnState();
        }
    });
    setupDragDrop(refUploadZone, (files) => {
        if (files.length > 0) {
            referenceFile = files[0];
            document.getElementById('reference-name').textContent = referenceFile.name;
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

    compareBtn.disabled = true;
    progressContainer.style.display = 'block';
    resultsPanel.style.display = 'none';

    try {
        progressText.textContent = 'Analyzing tracks...';
        progressFill.style.width = '50%';

        const formData = new FormData();
        formData.append('user_track', userSingleFile);
        if (mode === 'track' && referenceFile) {
            formData.append('reference_track', referenceFile);
        }

        // Build URL with query params
        let url = `${API_BASE}/api/compare/single?mode=${mode}`;
        if (sessionId && sessionId !== 'null') {
            url += `&session_id=${sessionId}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Comparison failed');
        }

        const data = await response.json();

        progressFill.style.width = '100%';
        progressText.textContent = 'Comparison complete!';

        // Display results
        displaySingleComparison(data);

        setTimeout(() => {
            progressContainer.style.display = 'none';
            resultsPanel.style.display = 'block';
        }, 500);

    } catch (error) {
        console.error('Error:', error);
        progressText.textContent = 'Error: ' + error.message;
        progressFill.style.width = '0%';
    } finally {
        compareBtn.disabled = false;
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
