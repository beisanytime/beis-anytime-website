// Simple SPA router: intercepts local .html link clicks and loads the page into the main content
(function(){
  // Helper: extract page param (module name) from a URL or location.search
  function pageParamFromUrl(urlString) {
    try {
      const u = new URL(urlString, location.href);
      return u.searchParams.get('page');
    } catch(e) {
      return null;
    }
  }

  async function fetchHtmlFragment(href) {
    try {
      const res = await fetch(href, {cache: 'no-store'});
      if (!res.ok) throw new Error('Fetch failed: ' + res.status);
      const text = await res.text();
      const m = text.match(/<main[\s\S]*?>[\s\S]*<\/main>/i);
      if (m) return m[0];
      const b = text.match(/<body[\s\S]*?>[\s\S]*<\/body>/i);
      if (b) return b[0];
      return text;
    } catch (e) {
      return `<main><p class="error-message">Could not load page: ${e.message}</p></main>`;
    }
  }

  function sanitizeModuleName(name) {
    if (!name) return null;
    // Accept names like recent.js or recent — normalize to base name without extension
    name = name.split('/').pop();
    name = name.replace(/\.js$/i, '');
    // only allow safe characters
    return name.replace(/[^a-z0-9_\-]/ig, '');
  }

  async function loadModuleByName(name, addToHistory = true) {
    const container = document.querySelector('.main-content');
    if (!container) return;
    const mainEl = container.querySelector('main');
    if (mainEl) mainEl.innerHTML = '<p class="loading-message">Loading...</p>';

    const safe = sanitizeModuleName(name);
    if (!safe) return;

    try {
      const modulePath = `./pages/${safe}.js`;
      const mod = await import(modulePath);
      let content = '';
      if (mod.render) {
        const out = await mod.render();
        if (typeof out === 'string') content = out;
        else if (out instanceof Node) content = out.outerHTML;
        else content = String(out);
      } else if (mod.html) {
        content = mod.html;
      } else if (mod.default) {
        const d = mod.default;
        content = typeof d === 'function' ? await d() : String(d);
      }

      if (!content) content = await fetchHtmlFragment(`${safe}.html`);

      if (mainEl) {
        if (/^\s*<main[\s\S]*>/.test(content)) mainEl.outerHTML = content;
        else mainEl.innerHTML = content;
      }

      if (addToHistory) {
        const url = new URL(location.href);
        url.searchParams.set('page', safe + '.js');
        history.pushState({spa:true, page: safe + '.js'}, '', url.href);
      }
    } catch (e) {
      // Module not found or error — fallback to fetching the original .html
      const fragment = await fetchHtmlFragment(`${safe}.html`);
      const mainEl2 = container.querySelector('main');
      if (mainEl2) {
        if (/^\s*<main[\s\S]*>/.test(fragment)) mainEl2.outerHTML = fragment;
        else mainEl2.innerHTML = fragment;
      }
      if (addToHistory) {
        const url = new URL(location.href);
        url.searchParams.set('page', safe + '.js');
        history.pushState({spa:true, page: safe + '.js'}, '', url.href);
      }
    }
  }

  // Intercept click events for links that use ?page=...
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    let a = e.target;
    while (a && a.tagName !== 'A') a = a.parentElement;
    if (!a || !a.href) return;
    const href = a.getAttribute('href');
    if (!href) return;

    // If link is a query link like '?page=recent.js' or 'index.html?page=recent.js'
    const pageParam = pageParamFromUrl(href);
    if (!pageParam) return; // not a page link

    if (a.target && a.target.toLowerCase() === '_blank') return;
    e.preventDefault();
    loadModuleByName(pageParam);
  }, true);

  // Handle back/forward
  window.addEventListener('popstate', (e) => {
    const state = e.state;
    const p = pageParamFromUrl(location.href) || state?.page;
    if (p) loadModuleByName(p, false);
    else {
      // no page param — load default index/main (do nothing)
      // Optionally we could reload index main from index.html
    }
  });

  // On initial load, if ?page=... present, load it
  document.addEventListener('DOMContentLoaded', () => {
    const p = pageParamFromUrl(location.href);
    if (p) loadModuleByName(p, false);
  });

})();
