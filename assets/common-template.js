// Common Header and Sidebar Template
(function() {
    const SIDEBAR_HTML = `
        <aside class="sidebar">
            <div class="sidebar-logo">
                <a href="/index.html">
                    <img src="/images/logo.png" alt="Beis Anytime Logo" class="logo-full">
                    <img src="/images/logo-icon-placeholder.png" alt="Beis Anytime" class="logo-icon">
                </a>
            </div>
            <nav class="sidebar-nav">
                <ul>
                    <li><a href="/index.html" id="homeLink"><i class="fas fa-home"></i> <span class="nav-text">Home</span></a></li>
                    <li><a href="/recent.html" id="recentLink"><i class="fas fa-clock"></i> <span class="nav-text">Recent</span></a></li>
                    <li><a href="/trending.html" id="trendingLink"><i class="fas fa-fire"></i> <span class="nav-text">Trending</span></a></li>
                    <li style="margin-bottom:10px;"><a href="/speakers.html" id="speakersLink"><i class="fas fa-user-friends"></i> <span class="nav-text">Speakers</span></a></li>
                </ul>
            </nav>
            <div class="sidebar-contact">
                <p>Contact us</p>
                <a href="mailto:beisanytime@gmail.com" class="contact-email">beisanytime@gmail.com</a>
            </div>
        </aside>
    `;

    const HEADER_HTML = `
        <header class="site-header">
            <div class="search-bar">
                <i class="fas fa-search"></i>
                <input type="search" placeholder="Search BeisAnytime" id="shiurSearchInput">
            </div>
            <div class="header-right">
                <div class="theme-toggle" id="themeToggleWrap" aria-hidden="false">
                    <button id="themeToggleBtn" aria-label="Toggle dark mode" title="Toggle dark mode">
                        <span class="thumb" id="themeThumb"></span>
                    </button>
                </div>
                <div class="header-dropdown" id="headerDropdown">
                    <button class="dropdown-toggle" id="dropdownToggleBtn">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="dropdown-menu">
                        <a href="#" class="dropdown-item" id="donateBtn"><i class="fas fa-hand-holding-heart"></i> Donate</a>
                        <a href="#" class="dropdown-item" id="notificationBell"><i class="fas fa-bell"></i> Notifications</a>
                        <div id="googleLoginBtn" class="google-login-btn"></div>
                        <a href="/account.html" class="dropdown-item user-info" style="display:none;">
                            <img src="" alt="User" class="user-avatar">
                            <span class="user-name"></span>
                        </a>
                        <a href="#" class="dropdown-item sign-out-btn" style="display:none;">
                            <i class="fas fa-sign-out-alt"></i> Sign Out
                        </a>
                    </div>
                </div>
            </div>
        </header>
    `;

    function initCommonTemplate() {
        let siteWrapper = document.querySelector('.site-wrapper');
        if (!siteWrapper) {
            siteWrapper = document.createElement('div');
            siteWrapper.className = 'site-wrapper';
            document.body.appendChild(siteWrapper);
        }

        // Add notification modal if missing
        if (!document.getElementById('notificationModal')) {
            const modalHtml = `
                <div id="notificationModal" class="modal">
                    <div class="modal-content">
                        <span class="close" id="closeNotificationModal">&times;</span>
                        <h2>Notification Settings</h2>
                        <label>
                            <input type="checkbox" id="enableNotifications">
                            Enable notifications for new video uploads
                        </label>
                        <p id="notificationStatus"></p>
                    </div>
                </div>
            `;
            siteWrapper.insertAdjacentHTML('afterbegin', modalHtml);
        }

        // Insert sidebar if missing
        if (!siteWrapper.querySelector('.sidebar')) {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = SIDEBAR_HTML;
            siteWrapper.insertBefore(wrapper.firstElementChild, siteWrapper.firstChild);
        }

        // Ensure main-content exists
        let mainContent = document.querySelector('.main-content');
        if (!mainContent) {
            mainContent = document.createElement('div');
            mainContent.className = 'main-content';
            siteWrapper.appendChild(mainContent);
        }

        // Insert header if missing
        if (!mainContent.querySelector('.site-header')) {
            const headerWrapper = document.createElement('div');
            headerWrapper.innerHTML = HEADER_HTML;
            mainContent.insertAdjacentElement('afterbegin', headerWrapper.firstElementChild);
        }

        // Mark active link
        const currentPath = window.location.pathname;
        const map = {
            '/index.html': 'homeLink',
            '/recent.html': 'recentLink',
            '/trending.html': 'trendingLink',
            '/speakers.html': 'speakersLink'
        };
        Object.entries(map).forEach(([path, id]) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (currentPath.endsWith(path) || (path === '/index.html' && (currentPath === '/' || currentPath === '/index.html'))) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCommonTemplate);
    } else {
        initCommonTemplate();
    }
})();