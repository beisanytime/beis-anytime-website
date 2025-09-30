(function () {
  const CSS_HREF = '/assets/rabbi-styles.css';
  const FA_HREF = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';

  function ensureStylesheet() {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    const hasCss = links.some(l => {
      const href = (l.getAttribute('href') || '').toLowerCase();
      return href.endsWith('rabb i-styles.css') || href.endsWith('rabbi-styles.css') || l.href.endsWith('/assets/rabbi-styles.css');
    });
    if (!hasCss) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = CSS_HREF;
      document.head.appendChild(link);
    }
    const hasFa = links.some(l => (l.getAttribute('href') || '').includes('font-awesome') || (l.getAttribute('href') || '').includes('fontawesome'));
    if (!hasFa && !document.querySelector('link[href="' + FA_HREF + '"]')) {
      const fa = document.createElement('link');
      fa.rel = 'stylesheet';
      fa.href = FA_HREF;
      document.head.appendChild(fa);
    }
  }

  function looksLikeRabbiPage() {
    if (document.querySelector('.rabbi-hero')) return true;
    // check path segments for "rabbi" or common patterns
    const p = (location.pathname || '').toLowerCase();
    if (p.includes('/rabbi') || p.includes('/rabbis') || /\/[^\/]+\s*rabbi/i.test(p)) return true;
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
    const toggleBtn = document.getElementById('themeToggleBtn');
    const wrap = document.getElementById('themeToggleWrap');
    if (!toggleBtn) return;
    if (toggleBtn.__beisInitialized) return;
    const rootEl = document.documentElement || document.body;
    function applyTheme(t) {
      if (t === 'dark') {
        rootEl.setAttribute('data-theme', 'dark');
        wrap && wrap.setAttribute('data-state', 'dark');
      } else {
        rootEl.removeAttribute('data-theme');
        wrap && wrap.setAttribute('data-state', 'light');
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

  // auto-run only on pages that look like rabbi pages, otherwise still expose function
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (looksLikeRabbiPage()) applyRabbiTemplate();
    });
  } else {
    if (looksLikeRabbiPage()) applyRabbiTemplate();
  }

  window.applyRabbiTemplate = applyRabbiTemplate;
})();
		let mainContent = siteWrapper.querySelector('.main-content');
		if (!mainContent) {
			// create main-content and move content that looks like main into it (fallback)
			mainContent = document.createElement('div');
			mainContent.className = 'main-content';
			siteWrapper.appendChild(mainContent);
			// attempt to move a <main> into it
			const existingMain = document.querySelector('main');
			if (existingMain) {
				mainContent.appendChild(existingMain);
			}
		}
		let existingHeader = mainContent.querySelector('.site-header');
		if (existingHeader) {
			existingHeader.outerHTML = canonicalHeader;
		} else {
			mainContent.insertAdjacentHTML('afterbegin', canonicalHeader);
		}

		// Ensure footer exists (placed after site-wrapper)
		let existingFooter = document.querySelector('.site-footer');
		if (existingFooter) {
			existingFooter.outerHTML = canonicalFooter;
		} else {
			siteWrapper.insertAdjacentHTML('afterend', canonicalFooter);
		}

		// Ensure theme toggle works if present (only initialize minimal behavior if missing)
		if (!document.getElementById('themeToggleBtn')) return; // nothing more to do
		(function() {
			const rootEl = document.documentElement || document.body;
			const toggleBtn = document.getElementById('themeToggleBtn');
			const wrap = document.getElementById('themeToggleWrap');
			function applyTheme(t) {
				if (t === 'dark') {
					rootEl.setAttribute('data-theme', 'dark');
					wrap && wrap.setAttribute('data-state', 'dark');
				} else {
					rootEl.removeAttribute('data-theme');
					wrap && wrap.setAttribute('data-state', 'light');
				}
			}
			const saved = localStorage.getItem('beisAnytimeTheme');
			applyTheme(saved === 'dark' ? 'dark' : 'light');
			if (toggleBtn && !toggleBtn.__beisInitialized) {
				toggleBtn.addEventListener('click', () => {
					const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
					const next = isDark ? 'light' : 'dark';
					applyTheme(next);
					localStorage.setItem('beisAnytimeTheme', next);
				});
				toggleBtn.__beisInitialized = true;
			}
		})();

		// Move visible video elements (marked with .rabbi-video) into the main content area
		(function relocateVideos() {
			const mainEl = document.querySelector('.main-content main') || document.querySelector('.main-content');
			if (!mainEl) return;
			const videos = Array.from(document.querySelectorAll('video.rabbi-video, .rabbi-video video, [data-rabbi-video]'));
			if (videos.length === 0) return;
			const container = document.createElement('div');
			container.className = 'rabbi-videos-container';
			// Move each video (or container) into the container
			videos.forEach(v => {
				// if v is a video element, wrap it
				if (v.tagName && v.tagName.toLowerCase() === 'video') {
					const wrap = document.createElement('div');
					wrap.className = 'rabbi-video-wrap';
					wrap.appendChild(v);
					container.appendChild(wrap);
				} else {
					// some pages might mark containers with data-rabbi-video
					container.appendChild(v);
				}
			});
			// Insert container at top of main content (after header)
			const header = mainEl.querySelector('.site-header');
			if (header && header.parentElement === mainEl) {
				header.insertAdjacentElement('afterend', container);
			} else {
				mainEl.insertBefore(container, mainEl.firstChild);
			}
		})();
	}

	// expose globally and auto-run on DOMContentLoaded
	window.applyRabbiTemplate = applyRabbiTemplate;
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', applyRabbiTemplate);
	} else {
		// apply immediately if DOM already loaded
		applyRabbiTemplate();
	}
})();
