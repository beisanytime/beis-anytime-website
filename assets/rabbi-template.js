(function () {
  const CSS_HREF = '/assets/rabbi-styles.css';
  const FA_HREF = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';

  function ensureStylesheet() {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    const hasCss = links.some(l => {
      const href = (l.getAttribute('href') || '').toLowerCase();
      return href.endsWith('rabbi-styles.css') || l.href.endsWith('/assets/rabbi-styles.css');
    });
    if (!hasCss) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = CSS_HREF;
      document.head.appendChild(link);
    }
    const hasFa = links.some(l => {
      const href = (l.getAttribute('href') || '').toLowerCase();
      return href.includes('font-awesome') || href.includes('fontawesome');
    });
    if (!hasFa) {
      const fa = document.createElement('link');
      fa.rel = 'stylesheet';
      fa.href = FA_HREF;
      document.head.appendChild(fa);
    }
  }

  function looksLikeRabbiPage() {
    if (document.querySelector('.rabbi-hero')) return true;
    const p = (location.pathname || '').toLowerCase();
    if (p.includes('/rabbi') || p.includes('/rabbis')) return true;
    return false;
  }

  function relocateRabbiVideos() {
    const videos = Array.from(document.querySelectorAll('video.rabbi-video, .rabbi-video video, [data-rabbi-video]'));
    if (!videos.length) return;
    const mainEl = document.querySelector('.main-content main') || document.querySelector('main') || document.querySelector('.main-content');
    if (!mainEl) return;
    const container = document.createElement('div');
    container.className = 'rabbi-videos-container';
    videos.forEach(v => {
      if (v.tagName && v.tagName.toLowerCase() === 'video') {
        const wrap = document.createElement('div');
        wrap.className = 'rabbi-video-wrap';
        wrap.appendChild(v);
        container.appendChild(wrap);
      } else {
        container.appendChild(v);
      }
    });
    const header = mainEl.querySelector('.site-header') || mainEl.querySelector('header');
    if (header && header.parentElement === mainEl) header.insertAdjacentElement('afterend', container);
    else mainEl.insertBefore(container, mainEl.firstChild);
  }

  function ensureThemeToggleInit() {
    // Theme toggle initialization left minimal — theme-toggle.js handles full behavior.
    const toggleBtn = document.getElementById('themeToggleBtn');
    const wrap = document.getElementById('themeToggleWrap');
    if (!toggleBtn || !wrap) return;
    if (toggleBtn.__beisInitialized) return;
    function applyTheme(t) {
      if (t === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        wrap.setAttribute('data-state', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
        wrap.setAttribute('data-state', 'light');
      }
    }
    const saved = localStorage.getItem('beisAnytimeTheme');
    applyTheme(saved === 'dark' ? 'dark' : 'light');
    toggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const next = isDark ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('beisAnytimeTheme', next);
    });
    toggleBtn.__beisInitialized = true;
  }

  function applyRabbiTemplate() {
    ensureStylesheet();
    relocateRabbiVideos();
    ensureThemeToggleInit();
  }

  // Auto-run only on pages that look like rabbi pages, otherwise expose function
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (looksLikeRabbiPage()) applyRabbiTemplate();
    });
  } else {
    if (looksLikeRabbiPage()) applyRabbiTemplate();
  }

  window.applyRabbiTemplate = applyRabbiTemplate;
})();
