// =================================================================================
// Beis Anytime - Complete Single Page Application
// Version: REVISED FOR SIMPLIFIED UPLOAD WORKFLOW
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
    // IMPORTANT: Make sure this URL is correct for your deployed worker.
    const API_BASE_URL = 'https://beis-anytime-api.beisanytime.workers.dev';
    const ADMIN_EMAIL = 'beisanytime@gmail.com'; // Your admin email
    const UPLOAD_PASSWORD = 'beis24/7'; // Your upload password
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
        if (rabbiId.toLowerCase() === 'guests') return 'Guest Speakers';
        return rabbiId.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    };

    // --- 4. API & DATA FETCHING ---
    const fetchApi = async (endpoint, options = {}) => {
        try {
            // Add Authorization header for admin requests
            if (endpoint.startsWith('/api/admin')) {
                const secret = sessionStorage.getItem('adminSecret'); // Use the secret from admin login
                if (secret) {
                    options.headers = { ...options.headers, 'Authorization': `Bearer ${secret}` };
                }
            }

            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            if (!response.ok) {
                 const errorBody = await response.json().catch(() => ({error: 'An unknown API error occurred.'}));
                 throw new Error(errorBody.error || `API Error ${response.status}`);
            }
            if (response.status === 204 || response.headers.get('content-length') === '0') return null;
            return await response.json();
        } catch (error) {
            console.error(`Failed to fetch from ${endpoint}:`, error);
            // Don't overwrite the whole page, just show an alert for API errors
            alert(`Error: ${error.message}`);
            return null;
        }
    };

    const getAllShiurim = async (forceRefresh = false) => {
        if (allShiurimCache.length > 0 && !forceRefresh) return allShiurimCache;
        // This is a public endpoint, no auth needed.
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
                <img src="${video.thumbnailDataUrl || 'https://via.placeholder.com/300x169.png?text=Thumbnail'}" alt="${video.title}" class="video-thumbnail">
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
            const allShiurim = await getAllShiurim();
            if (!allShiurim) return;
            const filteredShiurim = allShiurim.filter(shiur =>
                shiur.rabbi && params.rabbi && shiur.rabbi.toLowerCase() === params.rabbi.toLowerCase()
            );
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
                <a href="#" class="btn-back"><i class="fas fa-arrow-left"></i> Back to Videos</a>
                <div class="shiur-player-container">
                    <div class="video-player-wrapper">
                        <video controls autoplay poster="${shiur.thumbnailDataUrl}" src="${shiur.playbackUrl}"></video>
                    </div>
                    <div class="shiur-details">
                        <h1>${shiur.title}</h1>
                        <p class="shiur-details-meta">By ${rabbiName} on ${videoDate}</p>
                        <p>${shiur.description || ''}</p>
                    </div>
                </div>`;
        },
        admin: async () => {
             // Use the same password auth as the upload page
            if (sessionStorage.getItem('uploadAuthorized') !== 'true') {
                return renderPasswordModal('admin');
            }
            // Fetch with admin credentials
            const allShiurim = await fetchApi('/api/admin/all-shiurim');
            contentArea.innerHTML = `<h1 class="page-title">Admin Panel - All Shiurim</h1><div class="admin-table-container"><table class="admin-table"><thead><tr><th>Thumbnail</th><th>Title</th><th>Speaker</th><th>Date</th><th>Actions</th></tr></thead><tbody></tbody></table></div>`;
            const tbody = contentArea.querySelector('tbody');
            if (allShiurim) {
                allShiurim.forEach(shiur => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><img src="${shiur.thumbnailDataUrl || ''}" style="width: 60px; border-radius: 4px;"></td>
                        <td>${shiur.title}</td>
                        <td>${formatRabbiName(shiur.rabbi)}</td>
                        <td>${new Date(shiur.date || Date.now()).toLocaleDateString()}</td>
                        <td><button class="btn btn-danger" data-delete-id="${shiur.id}" data-delete-title="${shiur.title}">Delete</button></td>`;
                    tbody.appendChild(tr);
                });
            }
        },
        upload: () => {
            if (sessionStorage.getItem('uploadAuthorized') !== 'true') {
                renderPasswordModal('upload');
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
            // Admin link is always visible for simplicity; access is controlled by password
            document.getElementById('adminLink').style.display = 'flex';
        } else {
            googleSignInBtn.style.display = 'block';
            profileDropdown.style.display = 'none';
        }
    }

    // --- 8. UPLOAD FORM & PASSWORD LOGIC ---
    function renderPasswordModal(targetPage = 'upload') {
        contentArea.innerHTML = `
            <h1 class="page-title">Admin Access Required</h1>
            <form class="upload-form" id="passwordForm">
                <div class="input-group">
                    <label for="password">Enter Admin Password</label>
                    <input type="password" id="password" required>
                    <p id="passwordError" style="color: var(--color-danger); display: none;">Incorrect password.</p>
                </div>
                <div class="form-actions"><button type="submit" class="btn btn-primary">Submit</button></div>
            </form>`;
        document.getElementById('passwordForm').addEventListener('submit', e => {
            e.preventDefault();
            const passwordInput = document.getElementById('password');
            if (passwordInput.value === UPLOAD_PASSWORD) {
                // This secret will be used for API calls
                sessionStorage.setItem('adminSecret', passwordInput.value);
                sessionStorage.setItem('uploadAuthorized', 'true');
                loadPage(targetPage);
            } else {
                document.getElementById('passwordError').style.display = 'block';
                passwordInput.value = '';
            }
        });
    }

    function renderUploadForm() {
        contentArea.innerHTML = `
            <h1 class="page-title">Upload a Shiur</h1>
            <form class="upload-form" id="uploadForm">
                <div class="form-grid">
                    <div class="input-group"><label for="rabbi">Speaker</label><select id="rabbi" required><option value="" disabled selected>Select...</option><option value="Rabbi_Hartman">Rabbi Hartman</option><option value="Rabbi_Rosenfeld">Rabbi Rosenfeld</option><option value="Rabbi_Golker">Rabbi Golker</option><option value="guests">Guest Speakers</option></select></div>
                    <div class="input-group"><label for="title">Title</label><input type="text" id="title" required></div>
                    <div class="input-group"><label for="date">Date</label><input type="date" id="date" required></div>
                    <div class="input-group"><label for="description">Description (Optional)</label><textarea id="description"></textarea></div>
                    <div class="input-group"><label>Thumbnail Image (Required)</label><input type="file" id="thumbnailInput" accept="image/jpeg,image/png" required></div>
                    <div class="input-group"><label>Video/Audio File (Required)</label><input type="file" id="fileInput" accept="video/*,audio/*" required></div>
                </div>
                <div class="progress-bar" id="progressBar" style="display: none;"><div class="progress-bar-inner" id="progressBarInner"></div></div>
                <div class="form-actions"><button type="button" class="btn btn-secondary" id="cancelBtn">Cancel</button><button type="submit" class="btn btn-primary" id="uploadBtn">Upload Shiur</button></div>
            </form>`;
        document.getElementById('date').valueAsDate = new Date();
        attachUploadFormListeners();
    }

    function attachUploadFormListeners() {
        const form = document.getElementById('uploadForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const uploadBtn = document.getElementById('uploadBtn');
            const mediaFile = document.getElementById('fileInput').files[0];
            const thumbnailFile = document.getElementById('thumbnailInput').files[0];

            if (!mediaFile || !thumbnailFile || !document.getElementById('rabbi').value || !document.getElementById('title').value) {
                alert('Please fill in all required fields and select both a media file and a thumbnail.'); return;
            }

            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Preparing...';

            // Use FormData to easily send all data, including files, to the worker.
            const formData = new FormData();
            formData.append('title', document.getElementById('title').value);
            formData.append('rabbi', document.getElementById('rabbi').value);
            formData.append('date', document.getElementById('date').value);
            formData.append('description', document.getElementById('description').value);
            formData.append('thumbnail', thumbnailFile);
            formData.append('file', mediaFile);

            try {
                // STEP 1: Send all metadata and files to the worker.
                // The worker will save metadata and return a signed URL for the main media file.
                const prepareResponse = await fetchApi('/api/admin/add-shiur', {
                    method: 'POST',
                    body: formData, // FormData sets the correct Content-Type header automatically
                });

                if (!prepareResponse || !prepareResponse.signedUrl) {
                    throw new Error("Failed to prepare the upload. The server didn't provide an upload URL.");
                }

                // STEP 2: The metadata is now saved. Upload the video file to the URL the worker gave us.
                const { signedUrl } = prepareResponse;
                const progressBar = document.getElementById('progressBar'), progressBarInner = document.getElementById('progressBarInner');
                progressBar.style.display = 'block';

                await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('PUT', signedUrl, true);
                    // IMPORTANT: R2 requires the correct content type for the file being uploaded.
                    xhr.setRequestHeader('Content-Type', mediaFile.type);

                    xhr.upload.onprogress = event => {
                        if (event.lengthComputable) {
                            const percent = (event.loaded / event.total) * 100;
                            progressBarInner.style.width = `${percent}%`;
                            uploadBtn.textContent = `Uploading... ${Math.round(percent)}%`;
                        }
                    };

                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve();
                        } else {
                            reject(new Error(`File upload failed with status ${xhr.status}.`));
                        }
                    };
                    xhr.onerror = () => reject(new Error('A network error occurred during the file upload.'));
                    xhr.send(mediaFile);
                });

                // If we reach here, the upload was successful.
                uploadBtn.textContent = 'Upload Complete!';
                alert('Shiur uploaded successfully!');
                allShiurimCache = []; // Clear cache to fetch new data
                setTimeout(() => loadPage('home'), 1500);

            } catch (error) {
                alert(`Upload failed: ${error.message}`);
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload Shiur';
                progressBar.style.display = 'none';
            }
        });

        document.getElementById('cancelBtn').addEventListener('click', () => loadPage('home'));
    }


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
        sessionStorage.removeItem('uploadAuthorized');
        sessionStorage.removeItem('adminSecret');
        if (window.google && google.accounts && google.accounts.id) {
            google.accounts.id.disableAutoSelect();
        }
        profileDropdown.classList.remove('is-active');
        updateLoginUI(null);
        loadPage('home');
    });

    profileToggle.addEventListener('click', () => profileDropdown.classList.toggle('is-active'));
    document.addEventListener('click', (e) => { if (profileDropdown && !profileDropdown.contains(e.target)) profileDropdown.classList.remove('is-active'); });

    contentArea.addEventListener('click', async (e) => {
        const videoCard = e.target.closest('.video-card');
        if (videoCard) { e.preventDefault(); loadPage('view_shiur', { id: videoCard.dataset.shiurId }); }

        const backButton = e.target.closest('.btn-back');
        if (backButton) { e.preventDefault(); window.history.back(); }

        const deleteButton = e.target.closest('[data-delete-id]');
        if (deleteButton) {
            e.preventDefault();
            const shiurId = deleteButton.dataset.deleteId;
            const shiurTitle = deleteButton.dataset.deleteTitle;
            if (confirm(`Are you sure you want to permanently delete "${shiurTitle}"?`)) {
                try {
                    await fetchApi(`/api/admin/shiurim/${shiurId}`, { method: 'DELETE' });
                    alert('Shiur deleted successfully.');
                    allShiurimCache = []; // Invalidate cache
                    loadPage('admin'); // Refresh the admin page
                } catch (error) {
                    alert(`Failed to delete shiur: ${error.message}`);
                }
            }
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