// =================================================================================
// Beis Anytime - Complete Single Page Application
// Version: FINAL (All Features and Fixes Integrated)
// =================================================================================

// The callback for Google Sign-In MUST be on the global `window` object.
window.handleCredentialResponse = (response) => {
    try {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        const currentUser = { name: payload.name, email: payload.email, picture: payload.picture };
        localStorage.setItem('googleUser', JSON.stringify(currentUser));
        // Use a custom event to securely notify our main application that sign-in was successful.
        window.dispatchEvent(new CustomEvent('google-signin-success', { detail: currentUser }));
    } catch (e) {
        console.error("Error decoding Google credential:", e);
    }
};


document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GLOBAL CONFIGURATION & STATE ---
    const API_BASE_URL = 'https://beis-anytime-api.beisanytime.workers.dev';
    const ADMIN_EMAIL = 'beisanytime@gmail.com';
    const UPLOAD_PASSWORD = 'beis24/7'; // The password for the upload section
    let allShiurimCache = [];
    let currentUser = null;

    // --- 2. DOM ELEMENT SELECTORS ---
    const contentArea = document.getElementById('app-content');
    const navLinks = document.querySelectorAll('.nav-link');
    const themeToggle = document.getElementById('theme-toggle');
    const googleSignInBtn = document.querySelector('.g_id_signin');
    const profileDropdown = document.getElementById('profileDropdown');
    const profileToggle = document.getElementById('profileToggle');
    const signOutBtn = document.getElementById('signOutBtn');

    // --- 3. HELPER FUNCTIONS ---
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    };

    const formatRabbiName = (rabbiId) => {
        if (!rabbiId) return 'Unknown';
        return rabbiId.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    };

    // --- 4. API & DATA FETCHING ---
    const fetchApi = async (endpoint, options = {}) => {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            if (!response.ok) throw new Error(`API Error ${response.status}: ${await response.text()}`);
            if (response.status === 204 || response.headers.get('content-length') === '0') return null;
            return await response.json();
        } catch (error) {
            console.error(`Failed to fetch from ${endpoint}:`, error);
            contentArea.innerHTML = `<p class="info-message">Could not load content. Please check connection.</p>`;
            return null;
        }
    };

    const getAllShiurim = async (forceRefresh = false) => {
        if (allShiurimCache.length > 0 && !forceRefresh) return allShiurimCache;
        const data = await fetchApi('/api/all-shiurim');
        if (data) {
            data.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            allShiurimCache = data;
        }
        return data;
    };

    // --- 5. PAGE RENDERERS ---
    const renderLoading = () => contentArea.innerHTML = `<p class="loading">Loading...</p>`;

    function renderVideoGrid(videos, container) {
        if (!videos || videos.length === 0) {
            container.innerHTML = `<p class="info-message">No shiurim found.</p>`;
            return;
        }
        container.innerHTML = '';
        videos.forEach(video => {
            const card = document.createElement('div');
            card.className = 'video-card';
            card.dataset.shiurId = video.id;
            const rabbiName = formatRabbiName(video.rabbi);
            const videoDate = video.date ? new Date(video.date).toLocaleDateString() : 'N/A';
            card.innerHTML = `
                <img src="${video.thumbnailUrl || 'https://via.placeholder.com/300x169.png?text=Thumbnail'}" alt="${video.title}" class="video-thumbnail">
                <div class="video-info">
                    <h3 class="video-title">${video.title}</h3>
                    <p class="video-meta">${rabbiName} &bull; ${videoDate}</p>
                </div>`;
            container.appendChild(card);
        });
    }

    const pages = {
        home: async () => {
            const allShiurim = await getAllShiurim();
            if (!allShiurim) return;
            const recentShiurim = allShiurim.slice(0, 10);
            contentArea.innerHTML = `<h1 class="page-title">Most Recent Shiurim</h1><div class="video-grid"></div>`;
            renderVideoGrid(recentShiurim, contentArea.querySelector('.video-grid'));
        },
        all: async () => {
            const allShiurim = await getAllShiurim();
            if (!allShiurim) return;
            contentArea.innerHTML = `<h1 class="page-title">All Shiurim</h1><div class="video-grid"></div>`;
            renderVideoGrid(allShiurim, contentArea.querySelector('.video-grid'));
        },
        speaker: async (params) => {
            const apiRabbiId = params.rabbi.toLowerCase();
            const filteredShiurim = await fetchApi(`/api/shiurim/${apiRabbiId}`);
            if (!filteredShiurim) return;
            const displayRabbiName = formatRabbiName(params.rabbi);
            contentArea.innerHTML = `
                <div class="rabbi-header" id="rabbiHeader">
                    <h1>Shiurim from ${displayRabbiName}</h1>
                    <p>${filteredShiurim.length} shiurim available</p>
                </div>
                <div class="video-grid"></div>`;
            renderVideoGrid(filteredShiurim, contentArea.querySelector('.video-grid'));
        },
        view_shiur: async (params) => {
            const shiur = await fetchApi(`/api/shiurim/id/${params.id}`);
            if (!shiur) return;
            const rabbiName = formatRabbiName(shiur.rabbi);
            const videoDate = shiur.date ? new Date(shiur.date).toLocaleDateString() : 'N/A';
            contentArea.innerHTML = `
                <div class="shiur-player-container">
                    <div class="video-player-wrapper">
                        <video controls autoplay src="${shiur.playbackUrl}" poster="${shiur.thumbnailUrl}"></video>
                    </div>
                    <div class="shiur-details">
                        <h1>${shiur.title}</h1>
                        <p class="shiur-details-meta">By ${rabbiName} on ${videoDate}</p>
                        <p class="shiur-description">${shiur.description || 'No description available.'}</p>
                    </div>
                </div>`;
        },
        admin: async () => {
            if (!currentUser || currentUser.email !== ADMIN_EMAIL) return loadPage('home');
            const allShiurim = await getAllShiurim(true);
            contentArea.innerHTML = `<h1 class="page-title">Admin Panel - All Shiurim</h1><div class="admin-table-container"><table class="admin-table"><thead><tr><th>Title</th><th>Speaker</th><th>Date</th><th>Actions</th></tr></thead><tbody></tbody></table></div>`;
            const tbody = contentArea.querySelector('tbody');
            if (allShiurim) {
                allShiurim.forEach(shiur => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${shiur.title}</td>
                        <td>${formatRabbiName(shiur.rabbi)}</td>
                        <td>${new Date(shiur.date || Date.now()).toLocaleDateString()}</td>
                        <td><button class="btn btn-danger" data-delete-id="${shiur.id}">Delete</button></td>`;
                    tbody.appendChild(tr);
                });
            }
        },
        upload: () => {
            if (sessionStorage.getItem('uploadAuthorized') !== 'true') {
                renderPasswordModal();
            } else {
                renderUploadForm();
            }
        }
    };

    // --- 6. NAVIGATION & ROUTING ---
    const loadPage = (page, params = {}) => {
        renderLoading();
        const handler = pages[page] || pages.home;
        handler(params);
        window.location.hash = `${page}${params.id ? `/${params.id}` : ''}${params.rabbi ? `/${params.rabbi}` : ''}`;
        navLinks.forEach(l => l.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-link[data-page="${page}"]` + (params.rabbi ? `[data-rabbi="${params.rabbi}"]` : ''));
        if (activeLink) activeLink.classList.add('active');
    };

    // --- 7. GOOGLE LOGIN & UI ---
    function updateLoginUI(user) {
        currentUser = user;
        if (currentUser) {
            googleSignInBtn.style.display = 'none';
            profileDropdown.style.display = 'block';
            document.getElementById('userAvatar').src = currentUser.picture;
            document.getElementById('userName').textContent = currentUser.name;
            document.getElementById('userEmail').textContent = currentUser.email;
            document.getElementById('adminLink').style.display = currentUser.email === ADMIN_EMAIL ? 'flex' : 'none';
        } else {
            googleSignInBtn.style.display = 'block';
            profileDropdown.style.display = 'none';
        }
    }
    
    // --- 8. UPLOAD FORM & PASSWORD LOGIC (Helper functions below) ---

    // --- 9. EVENT LISTENERS & INITIALIZATION ---
    themeToggle.addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            loadPage(link.dataset.page, { rabbi: link.dataset.rabbi });
        });
    });

    signOutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        currentUser = null;
        localStorage.removeItem('googleUser');
        if (window.google && google.accounts && google.accounts.id) {
            google.accounts.id.disableAutoSelect();
        }
        profileDropdown.classList.remove('is-active');
        updateLoginUI(null);
        loadPage('home');
    });
    
    profileToggle.addEventListener('click', () => profileDropdown.classList.toggle('is-active'));
    document.addEventListener('click', (e) => { if (!profileDropdown.contains(e.target)) profileDropdown.classList.remove('is-active'); });
    
    document.getElementById('app-content-wrapper').addEventListener('click', e => {
        const videoCard = e.target.closest('.video-card');
        if (videoCard) {
            e.preventDefault();
            loadPage('view_shiur', { id: videoCard.dataset.shiurId });
        }
    });

    document.getElementById('adminLink').addEventListener('click', (e) => {
        e.preventDefault();
        loadPage('admin');
        profileDropdown.classList.remove('is-active');
    });
    
    window.addEventListener('google-signin-success', (event) => {
        updateLoginUI(event.detail);
    });

    function initialize() {
        applyTheme(localStorage.getItem('theme') || 'light');
        const savedUser = localStorage.getItem('googleUser');
        if (savedUser) {
            updateLoginUI(JSON.parse(savedUser));
        }
        const hash = window.location.hash.slice(1);
        const [page, param] = hash.split('/');
        if (page && pages[page]) {
            const params = page === 'speaker' ? { rabbi: param } : { id: param };
            loadPage(page, params);
        } else {
            loadPage('home');
        }
    }
    
    initialize();
});


// =================================================================================
// ALL HELPER FUNCTIONS
// =================================================================================

function renderPasswordModal() {
    const contentArea = document.getElementById('app-content');
    contentArea.innerHTML = `
        <h1 class="page-title">Upload Access Required</h1>
        <form class="upload-form" id="passwordForm">
            <div class="input-group">
                <label for="password">Enter Password</label>
                <input type="password" id="password" required>
                <p id="passwordError" style="color: var(--color-danger); display: none;">Incorrect password.</p>
            </div>
            <div class="form-actions"><button type="submit" class="btn btn-primary">Submit</button></div>
        </form>`;
    document.getElementById('passwordForm').addEventListener('submit', e => {
        e.preventDefault();
        const passwordInput = document.getElementById('password');
        if (passwordInput.value === 'beis24/7') {
            sessionStorage.setItem('uploadAuthorized', 'true');
            renderUploadForm();
        } else {
            document.getElementById('passwordError').style.display = 'block';
            passwordInput.value = '';
        }
    });
}

function renderUploadForm() {
    const contentArea = document.getElementById('app-content');
    contentArea.innerHTML = `
        <h1 class="page-title">Upload a Shiur</h1>
        <form class="upload-form" id="uploadForm">
            <div class="form-grid">
                <div class="input-group"><label for="rabbi">Speaker</label><select id="rabbi" required><option value="" disabled selected>Select...</option><option value="Rabbi_Hartman">Rabbi Hartman</option><option value="Rabbi_Rosenfeld">Rabbi Rosenfeld</option><option value="Rabbi_Golker">Rabbi Golker</option><option value="Guest_Speakers">Guest Speakers</option></select></div>
                <div class="input-group"><label for="title">Title</label><input type="text" id="title" required></div>
                <div class="input-group"><label for="uploaderName">Uploader Name</label><input type="text" id="uploaderName"></div>
                <div class="input-group"><label for="date">Date</label><input type="date" id="date" required></div>
                <div class="input-group"><label for="description">Description</label><textarea id="description"></textarea></div>
                <div class="input-group"><label>Video/Audio File</label><div class="file-drop-zone" id="dropZone"><p>Drag & drop file here, or click to browse</p><p id="fileName"></p><img id="thumbnailPreview" src=""><div id="thumbnail-controls"><label>Adjust Thumbnail:</label><input type="range" id="thumbnailScrubber" min="0" max="100" value="0" step="0.1"></div></div><input type="file" id="fileInput" accept="video/*,audio/*" style="display: none;"><div class="progress-bar" id="progressBar"><div class="progress-bar-inner" id="progressBarInner"></div></div></div>
            </div>
            <div class="form-actions"><button type="button" class="btn btn-secondary" id="cancelBtn">Cancel</button><button type="submit" class="btn btn-primary" id="uploadBtn">Upload Shiur</button></div>
        </form>`;
    document.getElementById('date').valueAsDate = new Date();
    attachUploadFormListeners();
}

function attachUploadFormListeners() {
    const form = document.getElementById('uploadForm');
    if (!form) return;
    const fileInput = document.getElementById('fileInput'), dropZone = document.getElementById('dropZone'), fileNameEl = document.getElementById('fileName');
    const thumbnailPreview = document.getElementById('thumbnailPreview'), thumbnailControls = document.getElementById('thumbnail-controls'), thumbnailScrubber = document.getElementById('thumbnailScrubber');
    const cancelBtn = document.getElementById('cancelBtn');
    let currentVideoFile = null, generatedThumbnailDataUrl = '';

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault(); dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; handleFileSelect(e.dataTransfer.files[0]); }
    });
    fileInput.addEventListener('change', () => fileInput.files.length && handleFileSelect(fileInput.files[0]));
    cancelBtn.addEventListener('click', () => {
        // Use the same custom event system for navigation to keep things consistent
        window.dispatchEvent(new CustomEvent('loadpage', { detail: { page: 'home' } }));
    });

    function handleFileSelect(file) {
        currentVideoFile = file;
        fileNameEl.textContent = `Selected: ${file.name}`;
        if (file.type.startsWith('video/')) {
            const url = URL.createObjectURL(file);
            const videoProcessor = document.getElementById('video-processor');
            videoProcessor.src = url;
            videoProcessor.addEventListener('loadeddata', () => {
                thumbnailControls.style.display = 'block';
                captureFrame(videoProcessor.duration * 0.1);
            }, { once: true });
        }
    }

    function captureFrame(time) {
        const videoProcessor = document.getElementById('video-processor');
        const canvasProcessor = document.getElementById('canvas-processor');
        if (!videoProcessor.src || videoProcessor.readyState < 2) return;
        videoProcessor.currentTime = time;
        videoProcessor.addEventListener('seeked', () => {
            canvasProcessor.width = videoProcessor.videoWidth;
            canvasProcessor.height = videoProcessor.videoHeight;
            canvasProcessor.getContext('2d').drawImage(videoProcessor, 0, 0, canvasProcessor.width, canvasProcessor.height);
            generatedThumbnailDataUrl = canvasProcessor.toDataURL('image/jpeg', 0.8);
            thumbnailPreview.src = generatedThumbnailDataUrl;
            thumbnailPreview.style.display = 'block';
        }, { once: true });
    }
    
    thumbnailScrubber.addEventListener('input', () => {
        const videoProcessor = document.getElementById('video-processor');
        if (!videoProcessor.duration) return;
        const seekTime = (thumbnailScrubber.value / 100) * videoProcessor.duration;
        captureFrame(seekTime);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const uploadBtn = document.getElementById('uploadBtn');
        if (!currentVideoFile || !document.getElementById('rabbi').value || !document.getElementById('title').value) {
            alert('Please fill in all required fields and select a file.'); return;
        }
        uploadBtn.disabled = true; uploadBtn.textContent = 'Preparing...';
        const metadata = {
            title: document.getElementById('title').value, 
            rabbi: document.getElementById('rabbi').value.toLowerCase(), // Standardize to lowercase
            fileName: currentVideoFile.name, uploaderName: document.getElementById('uploaderName').value,
            date: document.getElementById('date').value, description: document.getElementById('description').value,
            thumbnailDataUrl: generatedThumbnailDataUrl,
        };
        const API_BASE_URL = 'https://beis-anytime-api.beisanytime.workers.dev';
        const prepareResponse = await fetch(`${API_BASE_URL}/api/prepare-upload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metadata) });
        if (!prepareResponse.ok) { alert('Could not prepare upload.'); uploadBtn.disabled = false; uploadBtn.textContent = 'Upload Shiur'; return; }
        const { signedUrl } = await prepareResponse.json();
        const progressBar = document.getElementById('progressBar'), progressBarInner = document.getElementById('progressBarInner');
        progressBar.style.display = 'block';
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', signedUrl, true);
        xhr.setRequestHeader('Content-Type', currentVideoFile.type);
        xhr.upload.onprogress = event => {
            if (event.lengthComputable) {
                const percent = (event.loaded / event.total) * 100;
                progressBarInner.style.width = `${percent}%`;
                uploadBtn.textContent = `Uploading... ${Math.round(percent)}%`;
            }
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                uploadBtn.textContent = 'Upload Complete!';
                window.allShiurimCache = [];
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('loadpage', { detail: { page: 'home' } }));
                }, 1500);
            } else {
                alert(`Upload failed.`); uploadBtn.disabled = false; uploadBtn.textContent = 'Upload Shiur';
            }
        };
        xhr.onerror = () => { alert('A network error occurred.'); uploadBtn.disabled = false; uploadBtn.textContent = 'Upload Shiur'; };
        xhr.send(currentVideoFile);
    });
}