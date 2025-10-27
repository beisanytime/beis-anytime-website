// Global theme management for Beis Anytime
(function() {
    const THEME_STORAGE_KEY = 'beisAnytime.theme';
    const THEME_CHANGE_EVENT = 'beisAnytime.themeChange';
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Theme application function
    function applyTheme(theme, updateStorage = false) {
        // Apply theme to document
        if (theme === 'dark') {
            root.setAttribute('data-theme', 'dark');
        } else {
            root.removeAttribute('data-theme');
        }

        // Update button state if it exists
        const btn = document.querySelector('.theme-toggle button');
        if (btn) {
            btn.setAttribute('aria-pressed', theme === 'dark');
        }

        // Update theme-toggle wrap state
        const wrap = document.getElementById('themeToggleWrap');
        if (wrap) {
            wrap.setAttribute('data-state', theme);
        }

        // Update storage if requested
        if (updateStorage) {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
            // Dispatch event for other tabs
            window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme } }));
        }
    }

    // Get the initial theme
    function getInitialTheme() {
        // Check localStorage first
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') {
            return stored;
        }
        
        // Fall back to system preference
        return mediaQuery.matches ? 'dark' : 'light';
    }

    // Apply theme immediately on script load
    applyTheme(getInitialTheme());

    // Listen for DOM loaded to set up event handlers
    document.addEventListener('DOMContentLoaded', function () {
        // Wire up button click handler
        const btn = document.querySelector('.theme-toggle button');
        if (btn) {
            btn.addEventListener('click', () => {
                const isDark = root.getAttribute('data-theme') === 'dark';
                const newTheme = isDark ? 'light' : 'dark';
                applyTheme(newTheme, true);
            });
        }
    });

    // Listen for system theme changes
    mediaQuery.addListener((e) => {
        // Only apply system theme if no theme is stored
        if (!localStorage.getItem(THEME_STORAGE_KEY)) {
            applyTheme(e.matches ? 'dark' : 'light', true);
        }
    });

    // Listen for theme changes from other tabs
    window.addEventListener('storage', (e) => {
        if (e.key === THEME_STORAGE_KEY) {
            applyTheme(e.newValue);
        }
    });

    // Listen for our custom theme change event
    window.addEventListener(THEME_CHANGE_EVENT, (e) => {
        applyTheme(e.detail.theme);
    });

    // Expose theme functions globally
    window.beisAnytime = window.beisAnytime || {};
    window.beisAnytime.theme = {
        apply: applyTheme,
        get: () => root.getAttribute('data-theme') || 'light',
        toggle: () => {
            const current = root.getAttribute('data-theme') === 'dark';
            applyTheme(current ? 'light' : 'dark', true);
        }
    };
})();
