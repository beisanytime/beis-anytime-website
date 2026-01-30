// =================================================================================
// Beis Anytime - Application Logic
// =================================================================================

// --- Lazy Loading ---
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
}, { rootMargin: '200px' });

// --- Google Auth ---
window.handleCredentialResponse = (response) => {
    try {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        const currentUser = { name: payload.name, email: payload.email, picture: payload.picture };
        localStorage.setItem('googleUser', JSON.stringify(currentUser));
        window.dispatchEvent(new CustomEvent('google-signin-success', { detail: currentUser }));
    } catch (e) { console.error(e); }
};

document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const MAIN_API_URL = 'https://beis-anytime-api.beisanytime.workers.dev';

    // 1. API for Community Feed (The new D1 Worker)
    const COMMUNITY_API_URL = 'https://beis-social-worker.beisanytime.workers.dev'; // UPDATE THIS!

    // 2. API for Video Likes/Comments (The original KV Worker)
    const VIDEO_API_URL = 'https://beis-anytime-viewsapi.beisanytime.workers.dev';

    const ADMIN_EMAIL = 'beisanytime@gmail.com';
    const UPLOAD_PASSWORD = 'beis24/7';

    // --- State ---
    let allShiurimCache = [];
    let currentUser = null;
    let capturedThumbnailDataUrl = null;

    // --- DOM ---
    const contentArea = document.getElementById('app-content');
    const navItems = document.querySelectorAll('.nav-item, .bottom-nav-item');
    const themeToggle = document.getElementById('theme-toggle');

    // --- Helpers ---
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        const icon = themeToggle.querySelector('i');
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    };

    const formatRabbiName = (id) => {
        if (!id) return 'Unknown';
        if (id.toLowerCase() === 'guests') return 'Guest Speakers';
        return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const fetchMain = async (endpoint, options = {}) => {
        try {
            const res = await fetch(`${MAIN_API_URL}${endpoint}`, options);
            if (!res.ok) throw new Error('API Error');
            if (res.status === 204) return null;
            return await res.json();
        } catch (e) { console.error(e); return null; }
    };

    // Generic Fetcher for the two worker APIs
    const workerFetch = async (baseUrl, endpoint, options = {}) => {
        try {
            const res = await fetch(`${baseUrl}${endpoint}`, options);
            if (!res.ok) throw new Error('Worker Error');
            if (res.status === 204) return null;
            return await res.json();
        } catch (e) { return null; }
    };

    // --- Toast Helper ---
    const showToast = (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">${message}</div>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    // --- Bookmark Logic ---
    const getBookmarks = () => JSON.parse(localStorage.getItem('bookmarks') || '[]');
    const isBookmarked = (id) => getBookmarks().includes(id);
    const toggleBookmark = (id, e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        let marks = getBookmarks();
        if (marks.includes(id)) {
            marks = marks.filter(m => m !== id);
            showToast('Removed from Watch Later', 'success');
        } else {
            marks.push(id);
            showToast('Added to Watch Later', 'success');
        }
        localStorage.setItem('bookmarks', JSON.stringify(marks));
        // Refresh UI if on bookmarks page
        if (document.body.getAttribute('data-page-context') === 'bookmarks') loadPage('bookmarks');
        else if (e) {
            const btn = e.target.closest('.bookmark-btn');
            if (btn) btn.classList.toggle('active');
        }
    };

    const checkLatestPost = async () => {
        try {
            const posts = await workerFetch(COMMUNITY_API_URL, '/api/posts');
            if (posts && posts.length > 0) {
                const latest = posts[0];
                const lastId = localStorage.getItem('lastSeenPostId');
                if (lastId != latest.id.toString()) {
                    document.getElementById('community-badge').style.display = 'block';
                    document.getElementById('community-badge-mobile').style.display = 'block';
                    showPostNotification(latest);
                }
            }
        } catch (e) { console.error("Notif error:", e); }
    };

    // --- Search Logic ---
    const filterAllPage = (query) => {
        const grid = document.querySelector('.grid-videos');
        if (!grid) return;

        const filtered = allShiurimCache.filter(s => {
            const q = query.toLowerCase();
            return (s.title && s.title.toLowerCase().includes(q)) ||
                (s.rabbi && s.rabbi.toLowerCase().replace('_', ' ').includes(q)) ||
                (s.description && s.description.toLowerCase().includes(q));
        });

        if (filtered.length === 0) {
            grid.innerHTML = renderEmptyState(`No results for "${query}"`);
        } else {
            renderVideoGrid(filtered, grid);
        }
    };

    // --- Global Search Listener ---
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            // If user types, ensure we are on 'all' page or specific search view
            if (query.length > 0 && document.body.getAttribute('data-page-context') !== 'all') {
                loadPage('all');
            }
            // If on 'all' page, filter immediately
            if (document.body.getAttribute('data-page-context') === 'all') {
                // If query is empty, show all. If has text, filter.
                if (query.length === 0) {
                    renderVideoGrid(allShiurimCache, document.querySelector('.grid-videos'));
                } else {
                    filterAllPage(query);
                }
            }
        });
    }

    const showPostNotification = (post) => {
        const toast = document.createElement('div');
        toast.className = 'post-notification';
        toast.innerHTML = `
            <div class="notification-header">
                <img src="${post.avatar_url}" class="notif-avatar">
                <div class="notif-info">
                    <strong>Latest Announcement</strong>
                    <span>${post.display_name}</span>
                </div>
                <button class="notif-close">&times;</button>
            </div>
            <div class="notif-body">${post.content.length > 100 ? post.content.substring(0, 97) + '...' : post.content}</div>
            <button class="btn-notif" onclick="loadPage('community'); this.parentElement.classList.add('hide'); setTimeout(()=>this.parentElement.remove(), 300);">Read Full Post</button>
        `;
        document.body.appendChild(toast);
        toast.querySelector('.notif-close').onclick = () => {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 300);
        };
        setTimeout(() => { if (toast.parentElement) { toast.classList.add('hide'); setTimeout(() => toast.remove(), 300); } }, 10000);
    };

    const getAllShiurim = async (force = false) => {
        if (allShiurimCache.length > 0 && !force) return allShiurimCache;
        const data = await fetchMain('/api/all-shiurim');
        if (data) {
            data.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            allShiurimCache = data;
        }
        return data;
    };

    // --- Components Renderers ---
    const renderEmptyState = (msg) => `
<div class="empty-state">
    <div class="empty-icon"><i class="fas fa-search"></i></div>
    <h3>No Items Found</h3>
    <p style="color:var(--text-muted);">${msg}</p>
</div>
`;

    const renderVideoGrid = (videos, container) => {
        if (!videos || videos.length === 0) {
            container.innerHTML = renderEmptyState("Try checking back later.");
            return;
        }
        const frag = document.createDocumentFragment();
        videos.forEach(v => {
            const card = document.createElement('a');
            card.href = '#';
            card.className = 'video-card';
            card.dataset.shiurId = v.id;
            if (v.rabbi) card.setAttribute('data-rabbi', v.rabbi);

            const thumb = v.thumbnailDataUrl || v.thumbnailUrl || '';
            const progress = parseFloat(localStorage.getItem(`vid_progress_${v.id}`) || 0);
            const duration = parseFloat(localStorage.getItem(`vid_duration_${v.id}`) || 0);
            const percent = (progress && duration) ? (progress / duration) * 100 : 0;
            const bookmarked = isBookmarked(v.id);

            card.innerHTML = `
        <div class="thumb-wrapper">
            <img data-src="${thumb}" class="thumb-img" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9' fill='%23f3f4f6'%3E%3C/svg%3E" alt="Thumbnail" loading="lazy">
            <div class="rabbi-badge">
                <span class="rabbi-dot"></span>
                ${formatRabbiName(v.rabbi)}
            </div>
            ${percent > 0 ? `
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${percent}%"></div>
                </div>
            ` : ''}
            <button class="bookmark-btn ${bookmarked ? 'active' : ''}" title="Watch Later">
                <i class="${bookmarked ? 'fas' : 'far'} fa-bookmark"></i>
            </button>
        </div>
        <div class="card-content">
            <h3 class="card-title">${v.title}</h3>
            ${v.tags ? v.tags.map(t => `<span class="tag-badge">${t}</span>`).join('') : ''}
            <span class="card-date">${v.date ? new Date(v.date).toLocaleDateString() : ''}</span>
        </div>
    `;
            card.querySelector('.bookmark-btn').onclick = (e) => toggleBookmark(v.id, e);
            frag.appendChild(card);
        });
        container.innerHTML = '';
        container.appendChild(frag);
        container.querySelectorAll('img[data-src]').forEach(img => imageObserver.observe(img));
    };

    // --- Page Logic ---
    const pages = {
        home: async () => {
            const data = await getAllShiurim();
            if (!data) return;
            const recent = data.slice(0, 8);

            contentArea.innerHTML = `
        <section class="hero-card">
            <h1>Torah Anytime, Anywhere.</h1>
            <p style="max-width: 600px; font-size: 1.1rem; opacity: 0.8;">Explore a vast library of Shiurim from our esteemed Rabbis. Watch, listen, and grow.</p>
            <div class="hero-actions">
                <button class="btn btn-primary" onclick="loadPage('all')">Browse Library</button>
            </div>
        </section>
        
        <h2 style="margin-bottom: 24px;">Latest Shiurim</h2>
        <div class="grid-videos"></div>
    `;
            renderVideoGrid(recent, contentArea.querySelector('.grid-videos'));
        },

        all: async () => {
            const data = await getAllShiurim();
            contentArea.innerHTML = `
                <div class="mobile-search-container">
                    <div class="search-wrapper">
                        <i class="fas fa-search"></i>
                        <input type="text" id="mobileSearch" class="search-input" placeholder="Search shiurim..." value="${document.getElementById('globalSearch')?.value || ''}">
                    </div>
                </div>
                <h1 style="margin-bottom:30px;">All Shiurim</h1>
                <div class="grid-videos"></div>
            `;

            // Link mobile search to global search
            const mSearch = document.getElementById('mobileSearch');
            if (mSearch) {
                mSearch.oninput = (e) => {
                    const val = e.target.value;
                    const gSearch = document.getElementById('globalSearch');
                    if (gSearch) gSearch.value = val;
                    filterAllPage(val);
                };
            }

            const searchVal = document.getElementById('globalSearch')?.value.trim();
            if (searchVal) {
                filterAllPage(searchVal);
            } else {
                renderVideoGrid(data, contentArea.querySelector('.grid-videos'));
            }
        },

        bookmarks: async () => {
            const marks = getBookmarks();
            const data = await getAllShiurim();
            const filtered = data.filter(s => marks.includes(s.id));
            contentArea.innerHTML = `<h1 style="margin-bottom:30px;">Watch Later</h1><div class="grid-videos"></div>`;
            renderVideoGrid(filtered, contentArea.querySelector('.grid-videos'));
        },

        community: async () => {
            const isAdmin = currentUser && currentUser.email === ADMIN_EMAIL;

            contentArea.innerHTML = `
        <div class="feed-container">
            <div style="margin-bottom:30px; display:flex; justify-content:space-between; align-items:center;">
                <h1>Community Feed</h1>
                <button class="btn btn-secondary" onclick="loadPage('community')"><i class="fas fa-sync"></i> Refresh</button>
            </div>
            
            ${isAdmin ? `
            <div class="post-composer">
                <h3 style="margin-top:0; margin-bottom:12px; font-size:1rem;">Post Announcement</h3>
                <div style="display:flex; gap:12px; margin-bottom:12px;">
                    <img src="${currentUser.picture}" style="width:40px; height:40px; border-radius:50%;">
                    <textarea id="postInput" placeholder="Write an official announcement..." style="flex:1; border:none; background:transparent; resize:none; font-size:1rem; outline:none;" rows="3"></textarea>
                </div>
                <div style="display:flex; justify-content:flex-end;">
                    <button id="postSubmitBtn" class="btn btn-primary">Post</button>
                </div>
            </div>
            ` : `
            <div style="margin-bottom:20px; padding:15px; background:var(--bg-surface-hover); border-radius:8px; border:1px solid var(--border-light); text-align:center; color:var(--text-muted); font-size:0.9rem;">
                <i class="fas fa-bullhorn"></i> Official Announcements and Updates
            </div>
            `}
            
            <div id="postsList">
                <div class="skeleton" style="height:150px; margin-bottom:20px;"></div>
                <div class="skeleton" style="height:150px; margin-bottom:20px;"></div>
            </div>
        </div>
    `;

            if (isAdmin) {
                document.getElementById('postSubmitBtn').onclick = async () => {
                    const txt = document.getElementById('postInput').value.trim();
                    if (!txt) return;

                    const btn = document.getElementById('postSubmitBtn');
                    btn.disabled = true;
                    btn.textContent = "Posting...";

                    await workerFetch(COMMUNITY_API_URL, '/api/posts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: txt, user: currentUser })
                    });

                    loadPage('community');
                };
            }

            const posts = await workerFetch(COMMUNITY_API_URL, '/api/posts');
            const list = document.getElementById('postsList');

            if (posts && posts.length > 0) {
                localStorage.setItem('lastSeenPostId', posts[0].id.toString());
                document.getElementById('community-badge').style.display = 'none';
                document.getElementById('community-badge-mobile').style.display = 'none';
            }

            if (!posts || !posts.length) {
                list.innerHTML = renderEmptyState("No announcements yet.");
                return;
            }

            list.innerHTML = posts.map(p => `
        <div class="post-card">
            <div class="post-header">
                <img src="${p.avatar_url}" class="post-avatar">
                <div class="post-meta">
                    <span class="post-author">${p.display_name} <i class="fas fa-check-circle" style="color:var(--color-accent); font-size:0.8rem; margin-left:4px;" title="Verified Admin"></i></span>
                    <span class="post-time">${new Date(p.created_at * 1000).toLocaleString()}</span>
                </div>
            </div>
            <div class="post-content">${p.content}</div>
            ${(isAdmin) ? `
                <div class="post-actions">
                     <button class="btn btn-secondary" style="color:red; font-size:0.8rem; padding:6px 12px;" onclick="deletePost(${p.id})">Delete</button>
                </div>
            ` : ''}
        </div>
    `).join('');

            window.deletePost = async (id) => {
                if (confirm('Delete post?')) {
                    await workerFetch(COMMUNITY_API_URL, `/api/posts/${id}`, { method: 'DELETE', headers: { 'X-User-Email': currentUser.email } });
                    loadPage('community');
                }
            };
        },

        speakers: async () => {
            const speakers = [
                { id: 'Rabbi_Hartman', name: 'Rabbi Hartman', icon: 'fa-user-tie' },
                { id: 'Rabbi_Rosenfeld', name: 'Rabbi Rosenfeld', icon: 'fa-user-tie' },
                { id: 'Rabbi_Golker', name: 'Rabbi Golker', icon: 'fa-user-tie' },
                { id: 'guests', name: 'Guest Speakers', icon: 'fa-users' }
            ];

            contentArea.innerHTML = `<h1 style="margin-bottom:30px;">Speakers</h1><div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap:24px;" id="speakerGrid"></div>`;

            const grid = document.getElementById('speakerGrid');
            speakers.forEach(s => {
                const el = document.createElement('a');
                el.href = '#';
                el.className = 'video-card';
                el.style.alignItems = 'center';
                el.style.padding = '40px';
                el.style.textAlign = 'center';
                el.setAttribute('data-rabbi', s.id);
                el.innerHTML = `
            <div style="width:80px; height:80px; background:var(--bg-surface-hover); border-radius:50%; display:flex; align-items:center; justify-content:center; margin-bottom:16px; font-size:2rem; color:var(--text-muted);">
                <i class="fas ${s.icon}"></i>
            </div>
            <h3 style="margin:0;">${s.name}</h3>
        `;
                el.onclick = (e) => { e.preventDefault(); loadPage('speaker', { rabbi: s.id }); };
                grid.appendChild(el);
            });
        },

        speaker: async (params) => {
            const data = await getAllShiurim();
            const filtered = data.filter(s => s.rabbi && s.rabbi.toLowerCase() === params.rabbi.toLowerCase());
            contentArea.innerHTML = `
        <div style="margin-bottom: 30px;">
            <h1>${formatRabbiName(params.rabbi)}</h1>
            <p>${filtered.length} Shiurim available</p>
        </div>
        <div class="grid-videos"></div>
    `;
            renderVideoGrid(filtered, contentArea.querySelector('.grid-videos'));
        },

        view_shiur: async (params) => {
            const shiur = await fetchMain(`/api/shiurim/id/${params.id}`);
            if (!shiur) { contentArea.innerHTML = renderEmptyState("Shiur unavailable."); return; }

            contentArea.innerHTML = `
        <div style="max-width:1300px; margin:0 auto; display:grid; grid-template-columns: 1fr 350px; gap:40px;">
            <div class="main-video-column">
                <div class="flex-between" style="margin-bottom:20px;">
                    <button class="btn btn-secondary" onclick="window.history.back()">
                        <i class="fas fa-arrow-left"></i> Back
                    </button>
                    <div style="display:flex; gap:12px;">
                        <button class="btn btn-secondary" id="shareBtn" title="Share">
                            <i class="fas fa-share"></i> Share
                        </button>
                        <button class="btn btn-secondary" id="cinemaToggle" title="Cinema Mode">
                            <i class="fas fa-expand"></i>
                        </button>
                    </div>
                </div>
                
                <div class="video-container">
                    <video id="player-video" controls autoplay poster="${shiur.thumbnailDataUrl || ''}" src="${shiur.playbackUrl}" style="width:100%; height:100%;"></video>
                </div>
                
                <div class="video-details" id="vDetails">
                    <div class="flex-between" style="flex-wrap:wrap; gap:16px; margin-bottom:16px;">
                        <div>
                            <h1 style="font-size:1.5rem; margin-bottom:8px; color:var(--text-main);">${shiur.title}</h1>
                            <div style="display:flex; gap:12px; align-items:center;">
                                <span class="rabbi-badge" style="position:static; margin:0;">
                                    <span class="rabbi-dot"></span>${formatRabbiName(shiur.rabbi)}
                                </span>
                                <span style="color:var(--text-muted); font-size:0.9rem;">${new Date(shiur.date).toLocaleDateString()}</span>
                                <span id="views-count" style="color:var(--text-muted); font-size:0.9rem; margin-left:8px; display:none;"><i class="fas fa-eye"></i> <span id="views-num">0</span></span>
                            </div>
                        </div>
                        <button id="likeBtn" class="btn btn-secondary">
                            <i class="far fa-thumbs-up"></i> <span id="likes-count" style="margin-left:6px;">0</span>
                        </button>
                    </div>
                    <p style="color:var(--text-muted); line-height:1.6;">${shiur.description || 'No description provided.'}</p>
                    <div style="margin-top:12px;">
                        ${shiur.tags ? shiur.tags.map(t => `<span class="tag-badge">${t}</span>`).join('') : ''}
                    </div>
                </div>

                <div class="video-comments-area" id="vComments">
                    <h2 style="font-size:1.2rem; margin-bottom:20px;">Comments</h2>
                    
                    ${currentUser ? `
                    <div class="comment-composer">
                        <div style="display:flex; gap:12px;">
                            <img src="${currentUser.picture}" class="comment-avatar">
                            <div style="flex:1;">
                                <textarea id="commentInput" placeholder="Add a comment..." style="width:100%; border:1px solid var(--border-light); background:var(--bg-body); resize:none; font-size:0.9rem; outline:none; border-radius:8px; padding:10px;" rows="2"></textarea>
                                <div style="text-align:right; margin-top:8px;">
                                    <button id="commentSubmitBtn" class="btn btn-primary" style="font-size:0.8rem; padding:6px 16px;">Post</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : `
                    <div style="padding:20px; text-align:center; color:var(--text-muted); border:1px dashed var(--border-light); border-radius:8px; margin-bottom:20px;">
                        Sign in to join the conversation.
                    </div>
                    `}

                    <div id="commentsList">
                        <div class="skeleton" style="height:60px; margin-bottom:12px;"></div>
                    </div>
                </div>
            </div>

            <aside class="related-column">
                <h3 style="margin-top:0; margin-bottom:20px; font-size:1.1rem;">Up Next</h3>
                <div id="relatedList" class="related-shiurim-container">
                    <div class="skeleton" style="height:80px;"></div>
                    <div class="skeleton" style="height:80px;"></div>
                </div>
            </aside>
        </div>
    `;

            // --- Enhanced Video Player Logic ---
            const vid = document.getElementById('player-video');

            vid.onloadedmetadata = () => {
                localStorage.setItem(`vid_duration_${params.id}`, vid.duration);
            };

            // 1. Resume Playback
            const savedTime = localStorage.getItem(`vid_progress_${params.id}`);
            if (savedTime) {
                vid.currentTime = parseFloat(savedTime);
            }

            vid.addEventListener('timeupdate', () => {
                localStorage.setItem(`vid_progress_${params.id}`, vid.currentTime);
            });

            // 2. Share
            document.getElementById('shareBtn').onclick = () => {
                const url = window.location.href;
                const shareModal = document.createElement('div');
                shareModal.className = 'share-modal-overlay';
                shareModal.innerHTML = `
                    <div class="share-modal">
                        <h3 style="margin-top:0;">Share Shiur</h3>
                        <p style="font-size:0.9rem; color:var(--text-muted);">Copy link to share this Torah.</p>
                        <input type="text" value="${url}" readonly style="margin-bottom:12px;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:20px;">
                            <input type="checkbox" id="shareAtTime" style="width:auto;">
                            <label for="shareAtTime" style="font-size:0.85rem;">Start at ${Math.floor(vid.currentTime)}s</label>
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:12px;">
                            <button class="btn btn-secondary" onclick="this.closest('.share-modal-overlay').remove()">Cancel</button>
                            <button class="btn btn-primary" id="copyShareLink">Copy Link</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(shareModal);

                document.getElementById('copyShareLink').onclick = () => {
                    let finalUrl = url;
                    if (document.getElementById('shareAtTime').checked) {
                        const connector = finalUrl.includes('?') ? '&' : '?';
                        finalUrl += `${connector}t=${Math.floor(vid.currentTime)}`;
                    }
                    navigator.clipboard.writeText(finalUrl);
                    showToast('Link copied to clipboard');
                    shareModal.remove();
                };
            };

            // Check for timestamp in URL
            const urlParams = new URLSearchParams(window.location.search);
            const startTime = urlParams.get('t');
            if (startTime) vid.currentTime = parseFloat(startTime);

            // 3. Cinema Mode
            const cinemaBtn = document.getElementById('cinemaToggle');
            if (cinemaBtn) {
                cinemaBtn.onclick = () => {
                    document.body.classList.toggle('cinema-mode');
                    const isCinema = document.body.classList.contains('cinema-mode');
                    cinemaBtn.innerHTML = isCinema ? '<i class="fas fa-compress"></i>' : '<i class="fas fa-expand"></i>';
                };
            }

            // 4. Related & Up Next
            const allData = await getAllShiurim();
            const related = allData
                .filter(s => s.id !== params.id)
                .sort((a, b) => (a.rabbi === shiur.rabbi ? -1 : 1) - (b.rabbi === shiur.rabbi ? -1 : 1))
                .slice(0, 10);

            const rList = document.getElementById('relatedList');
            if (rList) {
                rList.innerHTML = related.map(r => `
                <a href="#" class="related-card" onclick="loadPage('view_shiur', {id:'${r.id}'}); return false;">
                    <img data-src="${r.thumbnailDataUrl || r.thumbnailUrl}" class="related-thumb" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9' fill='%23f3f4f6'%3E%3C/svg%3E">
                    <div class="related-info">
                        <h4>${r.title}</h4>
                        <span>${formatRabbiName(r.rabbi)}</span>
                    </div>
                </a>
            `).join('');
                rList.querySelectorAll('img[data-src]').forEach(img => imageObserver.observe(img));
            }

            // 5. Shortcuts
            const handleShortcuts = (e) => {
                if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
                switch (e.key.toLowerCase()) {
                    case ' ': case 'k': e.preventDefault(); vid.paused ? vid.play() : vid.pause(); break;
                    case 'arrowright': case 'l': vid.currentTime += 5; break;
                    case 'arrowleft': case 'j': vid.currentTime -= 5; break;
                    case 'f': if (document.fullscreenElement) document.exitFullscreen(); else vid.requestFullscreen(); break;
                }
            };
            document.addEventListener('keydown', handleShortcuts);

            // 6. Views
            const getViews = async () => workerFetch(VIDEO_API_URL, `/api/views/${encodeURIComponent(params.id)}`);
            const viewRes = await getViews();
            if (viewRes && viewRes.count !== undefined) {
                document.getElementById('views-count').style.display = 'inline-block';
                document.getElementById('views-num').textContent = viewRes.count;
            }

            vid.addEventListener('play', () => {
                workerFetch(VIDEO_API_URL, '/api/views/increment', {
                    method: 'POST',
                    body: JSON.stringify({ id: params.id }),
                    headers: { 'Content-Type': 'application/json' }
                });
            }, { once: true });

            // 2. Likes
            const getLikes = async () => workerFetch(VIDEO_API_URL, `/api/likes/${encodeURIComponent(params.id)}`);
            const toggleLike = async () => {
                if (!currentUser) return showToast('Please sign in', 'error');
                await workerFetch(VIDEO_API_URL, `/api/likes/${encodeURIComponent(params.id)}`, {
                    method: 'POST',
                    headers: { 'X-User-Email': currentUser.email }
                });
            };

            const refreshLikes = async () => {
                const likeData = await getLikes();
                if (likeData) {
                    const btn = document.getElementById('likeBtn');
                    document.getElementById('likes-count').textContent = likeData.count;
                    if (likeData.userLiked) {
                        btn.style.color = 'var(--color-accent)';
                        btn.querySelector('i').className = 'fas fa-thumbs-up';
                    } else {
                        btn.style.color = 'inherit';
                        btn.querySelector('i').className = 'far fa-thumbs-up';
                    }
                }
            };
            refreshLikes();

            document.getElementById('likeBtn').onclick = async function () {
                await toggleLike();
                refreshLikes();
            };

            // 3. Comments
            const getComments = async () => workerFetch(VIDEO_API_URL, `/api/comments/${encodeURIComponent(params.id)}`);

            const refreshComments = async () => {
                const res = await getComments();
                const list = document.getElementById('commentsList');
                list.innerHTML = '';

                if (!res || !res.comments || res.comments.length === 0) {
                    list.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">No comments yet.</p>`;
                    return;
                }

                list.innerHTML = res.comments.map(c => `
            <div class="comment-item" style="padding:16px;">
                <div class="comment-header" style="margin-bottom:8px;">
                    <div style="font-weight:700; font-size:0.9rem; color:var(--text-main);">${c.displayName || c.email}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${new Date(c.createdAt).toLocaleDateString()}</div>
                </div>
                <div class="comment-text" style="font-size:0.95rem;">${c.text}</div>
                ${(currentUser && currentUser.email === ADMIN_EMAIL) ? `
                    <button onclick="deleteComment('${c.id}')" style="background:none; border:none; color:red; font-size:0.75rem; cursor:pointer; margin-top:8px;">Delete</button>
                ` : ''}
            </div>
        `).join('');
            };

            if (currentUser) {
                document.getElementById('commentSubmitBtn').onclick = async () => {
                    const txt = document.getElementById('commentInput').value.trim();
                    if (!txt) return;

                    await workerFetch(VIDEO_API_URL, `/api/comments/${encodeURIComponent(params.id)}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-User-Email': currentUser.email },
                        body: JSON.stringify({ text: txt })
                    });

                    document.getElementById('commentInput').value = '';
                    refreshComments();
                };
            }

            window.deleteComment = async (cid) => {
                if (confirm('Delete comment?')) {
                    await workerFetch(VIDEO_API_URL, `/api/comments/${encodeURIComponent(params.id)}/${cid}`, {
                        method: 'DELETE',
                        headers: { 'X-User-Email': currentUser.email }
                    });
                    refreshComments();
                }
            };

            refreshComments();
        },

        admin: async () => {
            if (sessionStorage.getItem('uploadAuthorized') !== 'true') return renderPasswordModal('admin');
            const data = await fetchMain('/api/admin/shiurim');
            contentArea.innerHTML = `
        <div class="flex-between" style="margin-bottom:24px;">
            <h1>Admin Dashboard</h1>
            <button class="btn btn-primary" onclick="loadPage('upload')">Upload New</button>
        </div>
        <div style="background:var(--bg-surface-solid); border:1px solid var(--border-light); border-radius:12px; overflow:hidden;">
            ${data && data.length ? data.map(s => `
                <div style="padding:16px; border-bottom:1px solid var(--border-light); display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; gap:12px; align-items:center;">
                        <img src="${s.thumbnailDataUrl || ''}" style="width:60px; height:34px; object-fit:cover; border-radius:4px;">
                        <div>
                            <div style="font-weight:600;">${s.title}</div>
                            <div style="font-size:0.8rem; color:var(--text-muted);">${formatRabbiName(s.rabbi)}</div>
                        </div>
                    </div>
                    <button class="btn btn-secondary" style="padding:6px 12px; color:red; border-color:transparent;" data-del="${s.id}">Delete</button>
                </div>
            `).join('') : '<div style="padding:20px;">No shiurim.</div>'}
        </div>
    `;
            contentArea.querySelectorAll('[data-del]').forEach(b => {
                b.onclick = async () => {
                    if (confirm('Delete?')) {
                        await fetchMain(`/api/admin/shiurim/${b.dataset.del}`, { method: 'DELETE' });
                        loadPage('admin');
                    }
                }
            });
        },

        upload: () => {
            if (sessionStorage.getItem('uploadAuthorized') !== 'true') return renderPasswordModal('upload');
            contentArea.innerHTML = `
        <div style="max-width:600px; margin:0 auto; background:var(--bg-surface-solid); padding:32px; border-radius:var(--radius-lg); border:1px solid var(--border-light);">
            <h2 style="margin-bottom:24px;">Upload Shiur</h2>
            <form id="upForm" style="display:grid; gap:16px;">
                <div><label>Speaker</label><select id="rabbi"><option value="Rabbi_Hartman">Rabbi Hartman</option><option value="Rabbi_Rosenfeld">Rabbi Rosenfeld</option><option value="Rabbi_Golker">Rabbi Golker</option><option value="guests">Guest</option></select></div>
                <div><label>Title</label><input type="text" id="title" required></div>
                <div><label>Date</label><input type="date" id="date" required></div>
                <div><label>File</label><input type="file" id="fInput" accept="video/*,audio/*" required></div>
                <div id="prev" class="hidden"><video id="vidP" controls style="width:100%; border-radius:8px; margin-top:10px;"></video><button type="button" id="cap" class="btn btn-secondary" style="margin-top:8px;">Capture Thumb</button></div>
                <button type="submit" class="btn btn-primary" id="sBtn">Upload</button>
            </form>
        </div>
     `;
            const form = document.getElementById('upForm');
            const fInput = document.getElementById('fInput');
            const vidP = document.getElementById('vidP');

            fInput.onchange = (e) => {
                if (e.target.files[0]) {
                    vidP.src = URL.createObjectURL(e.target.files[0]);
                    document.getElementById('prev').classList.remove('hidden');
                }
            };

            document.getElementById('cap').onclick = () => {
                const c = document.createElement('canvas');
                c.width = vidP.videoWidth; c.height = vidP.videoHeight;
                c.getContext('2d').drawImage(vidP, 0, 0);
                capturedThumbnailDataUrl = c.toDataURL('image/jpeg', 0.8);
                alert('Thumbnail Captured');
            };

            form.onsubmit = async (e) => {
                e.preventDefault();
                const btn = document.getElementById('sBtn');
                btn.disabled = true; btn.textContent = 'Uploading...';

                try {
                    const file = fInput.files[0];
                    if (!capturedThumbnailDataUrl) throw new Error('Capture thumbnail first');

                    const prep = await fetch(`${MAIN_API_URL}/api/admin/prepare-upload`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: document.getElementById('title').value,
                            rabbi: document.getElementById('rabbi').value,
                            date: document.getElementById('date').value,
                            thumbnailDataUrl: capturedThumbnailDataUrl,
                            fileName: file.name
                        })
                    });
                    const { signedUrl } = await prep.json();

                    await fetch(signedUrl, { method: 'PUT', body: file });
                    alert('Uploaded');
                    loadPage('home');
                } catch (err) { alert(err.message); btn.disabled = false; }
            };
        }
    };

    function renderPasswordModal(target) {
        contentArea.innerHTML = `
    <div style="max-width:400px; margin:60px auto; background:var(--bg-surface-solid); padding:30px; border-radius:var(--radius-md); border:1px solid var(--border-light); text-align:center;">
        <h3>Admin Access</h3>
        <input type="password" id="pwd" placeholder="Password" style="margin:16px 0;">
        <button id="pwdBtn" class="btn btn-primary">Unlock</button>
    </div>
`;
        document.getElementById('pwdBtn').onclick = () => {
            if (document.getElementById('pwd').value === UPLOAD_PASSWORD) {
                sessionStorage.setItem('uploadAuthorized', 'true');
                loadPage(target);
            } else alert('Incorrect');
        };
    }

    // --- Routing & Transitions ---
    window.loadPage = (p, params) => {
        document.body.classList.remove('cinema-mode');
        navItems.forEach(n => {
            n.classList.remove('active');
            if (n.dataset.page === p) n.classList.add('active');
        });

        const render = () => {
            document.body.setAttribute('data-page-context', p);
            window.scrollTo(0, 0);
            if (pages[p]) pages[p](params || {});
            else pages.home();
        };

        if (document.startViewTransition) document.startViewTransition(() => render());
        else render();

        const hash = `${p}${params && params.id ? '/' + params.id : ''}`;
        window.history.replaceState(null, null, `#${hash}`);
    };

    // --- Events & Init ---
    themeToggle.addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

    document.addEventListener('click', (e) => {
        const link = e.target.closest('[data-page]');
        if (link && !e.target.closest('.nav-item') && !e.target.closest('.bottom-nav-item')) {
            e.preventDefault();
            loadPage(link.dataset.page);
        }

        const navItem = e.target.closest('.nav-item, .bottom-nav-item');
        if (navItem && navItem.dataset.page) {
            e.preventDefault();
            loadPage(navItem.dataset.page);
        }

        const card = e.target.closest('.video-card');
        if (card && card.dataset.shiurId) {
            e.preventDefault();
            loadPage('view_shiur', { id: card.dataset.shiurId });
        }
    });

    // Profile Dropdown Logic
    const pToggle = document.getElementById('profileToggle'); // Desktop
    const mProfile = document.getElementById('mobileProfileBtn'); // Mobile
    const globalMenu = document.getElementById('globalMenu');

    const toggleMenu = (e) => {
        e.stopPropagation();
        e.preventDefault();
        globalMenu.classList.toggle('active');
    };

    if (pToggle) pToggle.onclick = toggleMenu;
    if (mProfile) mProfile.onclick = toggleMenu;

    document.addEventListener('click', (e) => {
        if (!globalMenu.contains(e.target) && !mProfile.contains(e.target) && !pToggle.contains(e.target)) {
            globalMenu.classList.remove('active');
        }
    });

    document.getElementById('signOutBtn').onclick = () => {
        localStorage.removeItem('googleUser');
        window.location.reload();
    };

    // Auth UI Update
    window.addEventListener('google-signin-success', (e) => {
        currentUser = e.detail;

        document.getElementById('desktop-auth-container').style.display = 'none';
        document.getElementById('profileDropdown').style.display = 'block';
        document.getElementById('userAvatar').src = currentUser.picture;

        document.getElementById('menuLoggedOut').style.display = 'none';
        document.getElementById('menuLoggedIn').style.display = 'block';
        document.getElementById('menuUserName').textContent = currentUser.name;

        if (currentUser.email === ADMIN_EMAIL) {
            document.getElementById('adminLink').style.display = 'flex';
            document.getElementById('uploadLink').style.display = 'flex';
        }
    });

    // Boot
    const storedUser = localStorage.getItem('googleUser');
    if (storedUser) window.dispatchEvent(new CustomEvent('google-signin-success', { detail: JSON.parse(storedUser) }));

    applyTheme(localStorage.getItem('theme') || 'light');

    const initialHash = window.location.hash.slice(1);
    const [page, param] = initialHash.split('/');
    loadPage(page || 'home', param ? { id: param } : {});

    // Check for new community posts
    checkLatestPost();
});