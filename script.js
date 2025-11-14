// =================================================================================
// Beis Anytime - Complete Single Page Application (Optimized)
// =================================================================================

// Lazy loading images with Intersection Observer
const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        }
    });
}, {
    rootMargin: '50px'
});

// Google Sign-In callback MUST be on window object
window.handleCredentialResponse = (response) => {
    try {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        const currentUser = {
            name: payload.name,
            email: payload.email,
            picture: payload.picture
        };
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
    let capturedThumbnailDataUrl = null;

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
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
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
    const renderLoading = () => {
        contentArea.innerHTML = `<div class="loading-skeleton"><p class="loading">Loading...</p></div>`;
    };

    function renderVideoGrid(videos, container) {
        if (!videos || videos.length === 0) {
            container.innerHTML = `<p class="info-message">No shiurim found.</p>`;
            return;
        }

        const fragment = document.createDocumentFragment();

        videos.forEach(video => {
            const card = document.createElement('div');
            card.className = 'video-card';
            card.dataset.shiurId = video.id;

            if (video.rabbi) {
                card.setAttribute('data-rabbi', video.rabbi);
            }

            const rabbiName = formatRabbiName(video.rabbi);
            const videoDate = video.date ? new Date(video.date).toLocaleDateString() : 'N/A';
            const thumbnailUrl = video.thumbnailDataUrl || video.thumbnailUrl || '';

            card.innerHTML = `
            <img data-src="${thumbnailUrl}" 
                 src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='169'%3E%3Crect width='300' height='169' fill='%23e5e7eb'/%3E%3C/svg%3E" 
                 alt="${video.title}" 
                 class="video-thumbnail" 
                 loading="lazy">
            <div class="video-info">
                <h3 class="video-title">${video.title}</h3>
                <p class="video-meta">${rabbiName} • ${videoDate}</p>
            </div>`;

            fragment.appendChild(card);
        });

        container.innerHTML = '';
        container.appendChild(fragment);

        container.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }

    const pages = {
        home: async () => {
            const allShiurim = await getAllShiurim();
            if (!allShiurim) return;
            const recentShiurim = allShiurim.slice(0, 10);

            contentArea.innerHTML = `
                <section class="hero">
                    <div class="hero-inner">
                        <h1 class="hero-title">Welcome to Beis Anytime</h1>
                        <p class="hero-sub">Watch shiurim from our rabbis anytime — new talks added regularly. Browse recent shiurim below or explore all shiurim.</p>
                        <div class="hero-actions">
                            <button id="browseAllBtn" class="btn-ghost">Browse All Shiurim</button>
                        </div>
                    </div>
                </section>

                <section class="recent-videos">
                    <h2 class="page-title">Most Recent Shiurim</h2>
                    <div class="video-grid"></div>
                </section>
            `;

            // Wire hero CTA
            const browseAllBtn = document.getElementById('browseAllBtn');
            if (browseAllBtn) browseAllBtn.addEventListener('click', (e) => { e.preventDefault(); loadPage('all'); });

            renderVideoGrid(recentShiurim, contentArea.querySelector('.video-grid'));
        },
        all: async () => {
            const allShiurim = await getAllShiurim();
            if (!allShiurim) return;
            contentArea.innerHTML = `<h1 class="page-title">All Shiurim</h1><div class="video-grid"></div>`;
            renderVideoGrid(allShiurim, contentArea.querySelector('.video-grid'));
        },
        speakers: async () => {
            const speakers = [
                { id: 'Rabbi_Hartman', name: 'Rabbi Hartman', icon: 'fa-user-tie' },
                { id: 'Rabbi_Rosenfeld', name: 'Rabbi Rosenfeld', icon: 'fa-user-tie' },
                { id: 'Rabbi_Golker', name: 'Rabbi Golker', icon: 'fa-user-tie' },
                { id: 'guests', name: 'Guest Speakers', icon: 'fa-users' }
            ];

            contentArea.innerHTML = `
                <h1 class="page-title">Our Speakers</h1>
                <div class="speakers-grid"></div>`;
            
            const speakersGrid = contentArea.querySelector('.speakers-grid');
            const fragment = document.createDocumentFragment();

            speakers.forEach(speaker => {
                const card = document.createElement('a');
                card.href = '#';
                card.className = 'speaker-card';
                card.dataset.page = 'speaker';
                card.dataset.rabbi = speaker.id;

                card.innerHTML = `
                    <div class="speaker-card-icon">
                        <i class="fas ${speaker.icon}"></i>
                    </div>
                    <div class="speaker-card-content">
                        <span class="speaker-name">${speaker.name}</span>
                    </div>`;

                fragment.appendChild(card);
            });

            speakersGrid.appendChild(fragment);

            // Add click event listeners to speaker cards
            speakersGrid.querySelectorAll('.speaker-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    e.preventDefault();
                    const rabbi = card.dataset.rabbi;
                    loadPage('speaker', { rabbi: rabbi });
                });
            });
        },
        speaker: async (params) => {
            const allShiurim = await getAllShiurim();
            if (!allShiurim) return;
            const filteredShiurim = allShiurim.filter(shiur =>
                shiur.rabbi && params.rabbi && shiur.rabbi.toLowerCase() === params.rabbi.toLowerCase()
            );
            const displayRabbiName = formatRabbiName(params.rabbi);
            contentArea.innerHTML = `
                <div class="rabbi-header" data-rabbi="${params.rabbi}">
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
                        <video controls autoplay poster="${shiur.thumbnailDataUrl || shiur.thumbnailUrl || ''}" src="${shiur.playbackUrl}"></video>
                    </div>
                    <div class="shiur-details" data-rabbi="${shiur.rabbi}">
                        <h1>${shiur.title}</h1>
                        <p class="shiur-details-meta">By ${rabbiName} on ${videoDate}</p>
                        <p class="shiur-description">${shiur.description || ''}</p>
                    </div>
                </div>`;
        },
        admin: async () => {
            if (sessionStorage.getItem('uploadAuthorized') !== 'true') {
                return renderPasswordModal('admin');
            }
            const allShiurim = await fetchApi('/api/admin/shiurim');
            contentArea.innerHTML = `
                <h1 class="page-title">Admin Panel - All Shiurim</h1>
                <div class="admin-table-container">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>Thumbnail</th>
                                <th>Title</th>
                                <th>Speaker</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>`;
            const tbody = contentArea.querySelector('tbody');
            if (allShiurim) {
                allShiurim.forEach(shiur => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><img src="${shiur.thumbnailDataUrl || ''}" style="width: 60px; border-radius: 4px;" loading="lazy"></td>
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
        const adminLink = document.getElementById('adminLink');
        const uploadLink = document.getElementById('uploadLink');

        if (currentUser) {
            if (googleSignInBtn) googleSignInBtn.style.display = 'none';
            profileDropdown.style.display = 'block';
            document.getElementById('userAvatar').src = currentUser.picture;
            document.getElementById('userName').textContent = currentUser.name;
            document.getElementById('userEmail').textContent = currentUser.email;

            if (adminLink) adminLink.style.display = 'flex';

            if (currentUser.email === ADMIN_EMAIL) {
                if (uploadLink) uploadLink.style.display = 'flex';
            } else {
                if (uploadLink) uploadLink.style.display = 'none';
            }
        } else {
            if (googleSignInBtn) googleSignInBtn.style.display = 'block';
            profileDropdown.style.display = 'none';
            if (adminLink) adminLink.style.display = 'none';
            if (uploadLink) uploadLink.style.display = 'none';
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
                    
                    <div class="input-group" style="grid-column: 1 / -1;">
                        <label>Video/Audio File (Required)</label>
                        <input type="file" id="fileInput" accept="video/*,audio/*" required>
                        
                        <div id="videoPreviewContainer" style="display: none; margin-top: 15px;">
                            <video id="videoPreview" controls style="width: 100%; max-height: 300px; background: #000; border-radius: 4px;"></video>
                            <div style="margin-top: 15px; padding: 15px; background: var(--color-background); border-radius: 4px; border: 1px solid var(--color-border);">
                                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Select Thumbnail Frame</label>
                                <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--color-text-secondary); margin-bottom: 10px;">
                                    <span id="currentTime">0:00</span>
                                    <span id="duration">0:00</span>
                                </div>
                                <input type="range" id="videoScrubber" min="0" max="100" value="0" step="0.1" style="width: 100%; margin-bottom: 10px;">
                                <button type="button" class="btn btn-primary" id="captureThumbnailBtn">📸 Capture This Frame</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="input-group" style="grid-column: 1 / -1;">
                        <label>Thumbnail Preview</label>
                        <div id="thumbnailPreview" style="display: none; margin-top: 10px;">
                            <img id="thumbnailImg" src="" alt="Thumbnail" style="max-width: 300px; border-radius: 4px; border: 1px solid var(--color-border);">
                            <p style="font-size: 12px; color: var(--color-success); margin-top: 5px;">✓ Thumbnail captured</p>
                        </div>
                        <p style="font-size: 12px; color: var(--color-danger); margin-top: 5px; display: none;" id="thumbnailRequired">⚠ Please capture a thumbnail before uploading</p>
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
        let videoPreview = document.getElementById('videoPreview');
        const videoScrubber = document.getElementById('videoScrubber');
        const captureThumbnailBtn = document.getElementById('captureThumbnailBtn');

        if (!form) return;

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (videoPreview.src && videoPreview.src.startsWith('blob:')) {
                URL.revokeObjectURL(videoPreview.src);
            }

            if (file.type.startsWith('video/')) {
                const videoUrl = URL.createObjectURL(file);
                videoPreviewContainer.style.display = 'block';

                const newVideoPreview = videoPreview.cloneNode(true);
                newVideoPreview.src = videoUrl;
                videoPreview.parentNode.replaceChild(newVideoPreview, videoPreview);
                videoPreview = newVideoPreview;

                videoPreview.addEventListener('loadedmetadata', () => {
                    videoScrubber.max = videoPreview.duration;
                    document.getElementById('duration').textContent = formatTime(videoPreview.duration);
                }, { once: true });

                videoPreview.addEventListener('timeupdate', () => {
                    document.getElementById('currentTime').textContent = formatTime(videoPreview.currentTime);
                    videoScrubber.value = videoPreview.currentTime;
                });

            } else {
                videoPreviewContainer.style.display = 'none';
                capturedThumbnailDataUrl = null;
                document.getElementById('thumbnailPreview').style.display = 'none';
            }
        });

        videoScrubber.addEventListener('input', (e) => {
            videoPreview.currentTime = e.target.value;
        });

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

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const uploadBtn = document.getElementById('uploadBtn');
            const mediaFile = fileInput.files[0];

            if (!mediaFile) {
                alert('Please select a media file.');
                return;
            }

            if (mediaFile.type.startsWith('video/') && !capturedThumbnailDataUrl) {
                document.getElementById('thumbnailRequired').style.display = 'block';
                alert('Please capture a thumbnail from the video before uploading.');
                return;
            }

            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Preparing...';

            try {
                const prepareResponse = await fetch(`${API_BASE_URL}/api/admin/prepare-upload`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: document.getElementById('title').value,
                        rabbi: document.getElementById('rabbi').value,
                        date: document.getElementById('date').value,
                        description: document.getElementById('description').value,
                        thumbnailDataUrl: capturedThumbnailDataUrl || '',
                        fileName: mediaFile.name
                    })
                });

                if (!prepareResponse.ok) {
                    const error = await prepareResponse.json();
                    throw new Error(error.error || 'Failed to prepare upload');
                }

                const { signedUrl, shiurId } = await prepareResponse.json();

                const progressBar = document.getElementById('progressBar');
                const progressBarInner = document.getElementById('progressBarInner');
                progressBar.style.display = 'block';
                uploadBtn.textContent = 'Uploading...';

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
                            resolve();
                        } else {
                            reject(new Error(`Upload failed with status ${xhr.status}`));
                        }
                    });

                    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));

                    xhr.open('PUT', signedUrl);
                    xhr.setRequestHeader('Content-Type', mediaFile.type);
                    xhr.send(mediaFile);
                });

                uploadBtn.textContent = 'Upload Complete!';
                alert('Shiur uploaded successfully!');

                if (videoPreview.src) {
                    URL.revokeObjectURL(videoPreview.src);
                }
                capturedThumbnailDataUrl = null;
                allShiurimCache = [];

                setTimeout(() => loadPage('home'), 1500);

            } catch (error) {
                console.error('Upload error:', error);
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
    themeToggle.addEventListener('click', () => {
        applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

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
        if (window.google && google.accounts && google.accounts.id) {
            google.accounts.id.disableAutoSelect();
        }
        profileDropdown.classList.remove('is-active');
        updateLoginUI(null);
        loadPage('home');
    });

    profileToggle.addEventListener('click', () => {
        profileDropdown.classList.toggle('is-active');
    });

    document.addEventListener('click', (e) => {
        if (profileDropdown && !profileDropdown.contains(e.target)) {
            profileDropdown.classList.remove('is-active');
        }
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

    function initializeRouting() {
        const hash = window.location.hash.slice(1);
        const [page, param] = hash.split('/');
        if (page && pages[page]) {
            const params = page === 'speaker' ? { rabbi: param } : { id: param };
            loadPage(page, params);
        } else {
            loadPage('home');
        }
    }

    function initialize() {
        applyTheme(localStorage.getItem('theme') || 'light');
        const savedUser = localStorage.getItem('googleUser');

        // Create upload link dynamically
        const dropdownMenu = document.getElementById('profileDropdownMenu');
        if (dropdownMenu && !document.getElementById('uploadLink')) {
            const uploadLink = document.createElement('a');
            uploadLink.href = '#';
            uploadLink.className = 'dropdown-item';
            uploadLink.id = 'uploadLink';
            uploadLink.innerHTML = '<i class="fas fa-upload fa-fw"></i> Upload Shiur';
            uploadLink.style.display = 'none';

            dropdownMenu.insertBefore(uploadLink, signOutBtn);

            uploadLink.addEventListener('click', (e) => {
                e.preventDefault();
                loadPage('upload');
                profileDropdown.classList.remove('is-active');
            });
        }

        if (savedUser) {
            updateLoginUI(JSON.parse(savedUser));
        }

        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => initializeRouting());
        } else {
            setTimeout(initializeRouting, 1);
        }
    }

    initialize();
});