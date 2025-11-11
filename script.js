// =================================================================================
// Beis Anytime - Complete Single Page Application
// Version: WITH VIDEO SCRUBBER & WORKER UPLOAD
// =================================================================================

// The callback for Google Sign-In MUST be on the global `window` object.
window.handleCredentialResponse = (response) => {
    try {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        const currentUser = { name: payload.name, email: payload.email, picture: payload.picture };
        localStorage.setItem('googleUser', JSON.stringify(currentUser));
        window.dispatchEvent(new CustomEvent('google-signin-success', { detail: currentUser }));
    } catch (e) {
        console.error("Error decoding Google credential:", e);
    }
};

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GLOBAL CONFIGURATION & STATE ---
    const API_BASE_URL = 'https://beis-anytime-api.beisanytime.workers.dev';
    const ADMIN_EMAIL = 'beisanytime@gmail.com';
    const UPLOAD_PASSWORD = 'beis24/7';
    let allShiurimCache = [];
    let currentUser = null;
    let capturedThumbnailDataUrl = null; // Store captured thumbnail

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

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return mins + ':' + (secs < 10 ? '0' : '') + secs;
    };

    // --- 4. API & DATA FETCHING ---
    const fetchApi = async (endpoint, options = {}) => {
        try {
            if (endpoint.startsWith('/api/admin')) {
                const secret = sessionStorage.getItem('adminSecret');
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
            alert(`Error: ${error.message}`);
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
            if (sessionStorage.getItem('uploadAuthorized') !== 'true') {
                return renderPasswordModal('admin');
            }
            const allShiurim = await fetchApi('/api/admin/shiurim');
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
                    <div class="input-group">
                        <label for="rabbi">Speaker</label>
                        <select id="rabbi" required>
                            <option value="" disabled selected>Select...</option>
                            <option value="Rabbi_Hartman">Rabbi Hartman</option>
                            <option value="Rabbi_Rosenfeld">Rabbi Rosenfeld</option>
                            <option value="Rabbi_Golker">Rabbi Golker</option>
                            <option value="guests">Guest Speakers</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label for="title">Title</label>
                        <input type="text" id="title" required>
                    </div>
                    <div class="input-group">
                        <label for="date">Date</label>
                        <input type="date" id="date" required>
                    </div>
                    <div class="input-group">
                        <label for="description">Description (Optional)</label>
                        <textarea id="description"></textarea>
                    </div>
                    
                    <!-- Video File Upload -->
                    <div class="input-group" style="grid-column: 1 / -1;">
                        <label>Video/Audio File (Required)</label>
                        <input type="file" id="fileInput" accept="video/*,audio/*" required>
                        
                        <!-- Video Preview & Scrubber -->
                        <div id="videoPreviewContainer" style="display: none; margin-top: 15px;">
                            <video id="videoPreview" controls style="width: 100%; max-height: 300px; background: #000; border-radius: 4px;"></video>
                            <div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 4px; border: 1px solid #e0e0e0;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Select Thumbnail Frame</label>
                                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; margin-bottom: 10px;">
                                    <span id="currentTime">0:00</span>
                                    <span id="duration">0:00</span>
                                </div>
                                <input type="range" id="videoScrubber" min="0" max="100" value="0" step="0.1" style="width: 100%; margin-bottom: 10px;">
                                <button type="button" class="btn btn-primary" id="captureThumbnailBtn">📸 Capture This Frame</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Thumbnail Preview -->
                    <div class="input-group" style="grid-column: 1 / -1;">
                        <label>Thumbnail Preview</label>
                        <div id="thumbnailPreview" style="display: none; margin-top: 10px;">
                            <img id="thumbnailImg" src="" alt="Thumbnail" style="max-width: 300px; border-radius: 4px; border: 1px solid #e0e0e0;">
                            <p style="font-size: 12px; color: #059669; margin-top: 5px;">✓ Thumbnail captured</p>
                        </div>
                        <p style="font-size: 12px; color: #dc2626; margin-top: 5px; display: none;" id="thumbnailRequired">⚠ Please capture a thumbnail before uploading</p>
                    </div>
                </div>
                
                <div class="progress-bar" id="progressBar" style="display: none;">
                    <div class="progress-bar-inner" id="progressBarInner"></div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="cancelBtn">Cancel</button>
                    <button type="submit" class="btn btn-primary" id="uploadBtn">Upload Shiur</button>
                </div>
            </form>`;
        
        document.getElementById('date').valueAsDate = new Date();
        attachUploadFormListeners();
    }

    function attachUploadFormListeners() {
        const form = document.getElementById('uploadForm');
        const fileInput = document.getElementById('fileInput');
        const videoPreviewContainer = document.getElementById('videoPreviewContainer');
        const videoPreview = document.getElementById('videoPreview');
        const videoScrubber = document.getElementById('videoScrubber');
        const captureThumbnailBtn = document.getElementById('captureThumbnailBtn');
        
        if (!form) return;

        // Handle video file selection
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Clean up previous blob URL if exists
            if (videoPreview.src && videoPreview.src.startsWith('blob:')) {
                URL.revokeObjectURL(videoPreview.src);
            }
            
            // Show preview if it's a video
            if (file.type.startsWith('video/')) {
                const videoUrl = URL.createObjectURL(file);
                videoPreview.src = videoUrl;
                videoPreviewContainer.style.display = 'block';
                
                // Remove old event listeners to prevent memory leaks
                const newVideoPreview = videoPreview.cloneNode(true);
                videoPreview.parentNode.replaceChild(newVideoPreview, videoPreview);
                const videoPreview = newVideoPreview;
                
                videoPreview.addEventListener('loadedmetadata', () => {
                    videoScrubber.max = videoPreview.duration;
                    document.getElementById('duration').textContent = formatTime(videoPreview.duration);
                }, { once: true });
            } else {
                videoPreviewContainer.style.display = 'none';
                capturedThumbnailDataUrl = null;
                document.getElementById('thumbnailPreview').style.display = 'none';
            }
        });

        // Video scrubber control
        videoScrubber.addEventListener('input', (e) => {
            videoPreview.currentTime = e.target.value;
        });

        videoPreview.addEventListener('timeupdate', () => {
            document.getElementById('currentTime').textContent = formatTime(videoPreview.currentTime);
            videoScrubber.value = videoPreview.currentTime;
        });

        // Capture thumbnail from video
        captureThumbnailBtn.addEventListener('click', () => {
            const canvas = document.createElement('canvas');
            canvas.width = videoPreview.videoWidth;
            canvas.height = videoPreview.videoHeight;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoPreview, 0, 0, canvas.width, canvas.height);
            
            capturedThumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            
            document.getElementById('thumbnailImg').src = capturedThumbnailDataUrl;
            document.getElementById('thumbnailPreview').style.display = 'block';
            document.getElementById('thumbnailRequired').style.display = 'none';
        });

        // Form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const uploadBtn = document.getElementById('uploadBtn');
            const mediaFile = fileInput.files[0];

            if (!mediaFile) {
                alert('Please select a media file.');
                return;
            }

            // Require thumbnail for videos
            if (mediaFile.type.startsWith('video/') && !capturedThumbnailDataUrl) {
                document.getElementById('thumbnailRequired').style.display = 'block';
                alert('Please capture a thumbnail from the video before uploading.');
                return;
            }

            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Uploading...';

            try {
                // Create FormData with all fields
                const formData = new FormData();
                formData.append('file', mediaFile);
                formData.append('title', document.getElementById('title').value);
                formData.append('rabbi', document.getElementById('rabbi').value);
                formData.append('date', document.getElementById('date').value);
                formData.append('description', document.getElementById('description').value);
                
                if (capturedThumbnailDataUrl) {
                    formData.append('thumbnailDataUrl', capturedThumbnailDataUrl);
                }

                // Upload with progress tracking
                const progressBar = document.getElementById('progressBar');
                const progressBarInner = document.getElementById('progressBarInner');
                progressBar.style.display = 'block';

                await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    
                    xhr.upload.addEventListener('progress', (event) => {
                        if (event.lengthComputable) {
                            const percent = (event.loaded / event.total) * 100;
                            progressBarInner.style.width = `${percent}%`;
                            uploadBtn.textContent = `Uploading... ${Math.round(percent)}%`;
                        }
                    });
                    
                    xhr.addEventListener('load', () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve(JSON.parse(xhr.responseText));
                        } else {
                            reject(new Error(`Upload failed with status ${xhr.status}`));
                        }
                    });
                    
                    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
                    
                    xhr.open('POST', `${API_BASE_URL}/api/admin/upload`);
                    xhr.send(formData);
                });

                uploadBtn.textContent = 'Upload Complete!';
                alert('Shiur uploaded successfully!');
                
                // Clean up
                if (videoPreview.src) {
                    URL.revokeObjectURL(videoPreview.src);
                }
                capturedThumbnailDataUrl = null;
                allShiurimCache = [];
                
                setTimeout(() => loadPage('home'), 1500);

            } catch (error) {
                alert(`Upload failed: ${error.message}`);
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload Shiur';
                document.getElementById('progressBar').style.display = 'none';
            }
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            if (videoPreview.src) {
                URL.revokeObjectURL(videoPreview.src);
            }
            capturedThumbnailDataUrl = null;
            loadPage('home');
        });
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
    document.addEventListener('click', (e) => { 
        if (profileDropdown && !profileDropdown.contains(e.target)) profileDropdown.classList.remove('is-active'); 
    });

    contentArea.addEventListener('click', async (e) => {
        const videoCard = e.target.closest('.video-card');
        if (videoCard) { 
            e.preventDefault(); 
            loadPage('view_shiur', { id: videoCard.dataset.shiurId }); 
        }

        const backButton = e.target.closest('.btn-back');
        if (backButton) { 
            e.preventDefault(); 
            window.history.back(); 
        }

        const deleteButton = e.target.closest('[data-delete-id]');
        if (deleteButton) {
            e.preventDefault();
            const shiurId = deleteButton.dataset.deleteId;
            const shiurTitle = deleteButton.dataset.deleteTitle;
            if (confirm(`Are you sure you want to permanently delete "${shiurTitle}"?`)) {
                try {
                    await fetchApi(`/api/admin/shiurim/${shiurId}`, { method: 'DELETE' });
                    alert('Shiur deleted successfully.');
                    allShiurimCache = [];
                    loadPage('admin');
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