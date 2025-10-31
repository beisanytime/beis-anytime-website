(function(){
  const workerURL = 'https://beis-anytime-api.beisanytime.workers.dev';
  const adminsUrl = '/admins.json';

  function getSignedInEmail() {
    if (window.currentGoogleUser && window.currentGoogleUser.email) return window.currentGoogleUser.email;
    if (window.googleUser && window.googleUser.email) return window.googleUser.email;
    const ls = localStorage.getItem('googleUserEmail');
    if (ls) return ls;
    try {
      const nameEl = document.querySelector('.user-info .user-name');
      const dataEmail = nameEl && nameEl.dataset && nameEl.dataset.email;
      if (dataEmail) return dataEmail;
    } catch (e) {}
    return null;
  }

  async function fetchAdmins() {
    try {
      const res = await fetch(adminsUrl, {cache: "no-store"});
      if (!res.ok) return [];
      const admins = await res.json();
      
      // Show/hide upload nav item based on admin status
      const uploadNavItem = document.getElementById('uploadNavItem');
      if (uploadNavItem) {
        const userEmail = getSignedInEmail();
        uploadNavItem.style.display = admins.includes(userEmail) ? 'block' : 'none';
      }
      
      return admins;
    } catch (e) { console.warn('Could not load admins.json', e); return []; }
  }

  async function fetchShiurim() {
    const res = await fetch(`${workerURL}/api/all-shiurim`);
    if (!res.ok) throw new Error('Failed to fetch shiurim: ' + res.status);
    return await res.json();
  }

  function createEditableRow(shiur) {
    const container = document.createElement('div');
    container.className = 'admin-row';
    container.setAttribute('data-id', shiur.id);
    container.innerHTML = `
      <div class="admin-row-inner" style="display:flex;gap:12px;align-items:flex-start;margin-bottom:12px;padding:12px;border:1px solid #ddd;border-radius:6px;">
        <div style="width:160px;flex-shrink:0;">
          <img src="${shiur.thumbnailUrl || '/images/placeholder-shiur.png'}" alt="" style="width:150px;height:84px;object-fit:cover;border-radius:4px;" class="thumb-preview">
        </div>
        <div style="flex:1;min-width:200px;">
          <div><label>Title</label><input class="admin-input title" value="${escapeHtml(shiur.title || '')}" style="width:100%"></div>
          <div><label>Rabbi / Creator</label><input class="admin-input rabbi" value="${escapeHtml((shiur.rabbi || '').replace(/_/g,' '))}" style="width:100%"></div>
          <div><label>Uploader</label><input class="admin-input uploader" value="${escapeHtml(shiur.uploader || '')}" style="width:100%"></div>
          <div><label>Thumbnail URL</label><input class="admin-input thumbnail" value="${escapeHtml(shiur.thumbnailUrl || '')}" style="width:100%"></div>
        </div>
        <div style="width:200px;display:flex;flex-direction:column;gap:8px;">
          <button class="save-btn" data-id="${shiur.id}" style="padding:8px;">Save</button>
          <button class="cancel-btn" data-id="${shiur.id}" style="padding:8px;">Reset</button>
          <div class="status" style="font-size:0.9em;color:#444;"></div>
        </div>
      </div>
    `;

    const titleEl = container.querySelector('.title');
    const rabbiEl = container.querySelector('.rabbi');
    const uploaderEl = container.querySelector('.uploader');
    const thumbnailEl = container.querySelector('.thumbnail');
    const previewImg = container.querySelector('.thumb-preview');
    const saveBtn = container.querySelector('.save-btn');
    const cancelBtn = container.querySelector('.cancel-btn');
    const statusDiv = container.querySelector('.status');

    thumbnailEl.addEventListener('input', () => {
      previewImg.src = thumbnailEl.value || '/images/placeholder-shiur.png';
    });

    cancelBtn.addEventListener('click', () => {
      titleEl.value = shiur.title || '';
      rabbiEl.value = (shiur.rabbi || '').replace(/_/g,' ');
      uploaderEl.value = shiur.uploader || '';
      thumbnailEl.value = shiur.thumbnailUrl || '';
      previewImg.src = shiur.thumbnailUrl || '/images/placeholder-shiur.png';
      statusDiv.textContent = 'Reset';
      setTimeout(()=> statusDiv.textContent = '', 1200);
      untrackChanges(shiur.id);
    });

    saveBtn.addEventListener('click', async () => {
      statusDiv.textContent = 'Saving...';
      const payload = {
        title: titleEl.value.trim(),
        rabbi: (rabbiEl.value || '').trim().replace(/\s+/g, '_'),
        uploader: uploaderEl.value.trim(),
        thumbnailUrl: thumbnailEl.value.trim()
      };
      try {
        // Attempt to update via a PUT/PATCH to /api/shiur/{id}
        const id = shiur.id;
        let res = await fetch(`${workerURL}/api/shiur/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        // If endpoint doesn't accept PUT, try PATCH, then fallback to /api/update-shiur
        if (!res.ok) {
          res = await fetch(`${workerURL}/api/shiur/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }
        if (!res.ok) {
          // try alternative endpoint
          res = await fetch(`${workerURL}/api/update-shiur`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.assign({ id }, payload))
          });
        }

        if (!res.ok) {
          const text = await res.text().catch(()=>res.statusText);
          throw new Error('API error: ' + res.status + ' ' + text);
        }

        statusDiv.textContent = 'Saved';
        setTimeout(()=> statusDiv.textContent = '', 1500);
        untrackChanges(shiur.id);
      } catch (err) {
        console.error('Save failed', err);
        statusDiv.textContent = 'Save failed: ' + (err.message || err);
      }
    });

    titleEl.addEventListener('input', () => trackChanges(shiur.id));
    rabbiEl.addEventListener('input', () => trackChanges(shiur.id));
    uploaderEl.addEventListener('input', () => trackChanges(shiur.id));
    thumbnailEl.addEventListener('input', () => trackChanges(shiur.id));

    return container;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); });
  }

  async function initAdminPage() {
    const adminNotice = document.getElementById('adminNotice');
    const adminControls = document.getElementById('adminControls');
    const adminList = document.getElementById('adminList');
    const adminSearch = document.getElementById('adminSearch');

    adminNotice.textContent = 'Checking admin rights...';

    const admins = await fetchAdmins();
    const email = (getSignedInEmail() || '').toLowerCase();
    if (!email || !admins.map(a=>a.toLowerCase()).includes(email)) {
      adminNotice.innerHTML = 'You are not authorized to view this page. Sign in with an admin account.';
      adminControls.style.display = 'none';
      return;
    }

    adminNotice.textContent = 'Authorized as ' + email;
    adminControls.style.display = '';
    adminList.innerHTML = '<p>Loading videos...</p>';

    try {
      let shiurim = await fetchShiurim();
      if (!Array.isArray(shiurim)) shiurim = [];
      adminList.innerHTML = '';
      shiurim.forEach(s => adminList.appendChild(createEditableRow(s)));

      // search/filter
      adminSearch.addEventListener('input', function(){
        const q = (this.value || '').toLowerCase().trim();
        const rows = Array.from(adminList.children);
        rows.forEach(row => {
          const title = (row.querySelector('.title').value || '').toLowerCase();
          const rabbi = (row.querySelector('.rabbi').value || '').toLowerCase();
          const match = !q || title.includes(q) || rabbi.includes(q);
          row.style.display = match ? '' : 'none';
        });
      });

    } catch (err) {
      console.error(err);
      adminList.innerHTML = '<p>Error loading videos: ' + (err.message || err) + '</p>';
    }
  }

  // Add after initialization code:
  let modifiedShiurim = new Set();
  const saveAllBtn = document.getElementById('saveAllBtn');

  function trackChanges(shiurId) {
      modifiedShiurim.add(shiurId);
      updateSaveAllButton();
  }

  function updateSaveAllButton() {
      const count = modifiedShiurim.size;
      saveAllBtn.disabled = count === 0;
      saveAllBtn.querySelector('.changes-count').textContent = `(${count})`;
  }

  function untrackChanges(shiurId) {
      modifiedShiurim.delete(shiurId);
      updateSaveAllButton();
  }

  saveAllBtn.addEventListener('click', async () => {
      saveAllBtn.classList.add('saving');
      const errors = [];
      
      for (const shiurId of modifiedShiurim) {
          const row = document.querySelector(`.admin-row[data-id="${shiurId}"]`);
          if (!row) continue;
          
          try {
              const payload = {
                  id: shiurId,
                  title: row.querySelector('.title').value.trim(),
                  rabbi: row.querySelector('.rabbi').value.trim().replace(/\s+/g, '_'),
                  uploader: row.querySelector('.uploader').value.trim(),
                  thumbnailUrl: row.querySelector('.thumbnail').value.trim()
              };
              
              const res = await fetch(`${workerURL}/api/shiur/${shiurId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
              });
              
              if (!res.ok) throw new Error(`Failed to save shiur ${shiurId}`);
              
              row.querySelector('.status').textContent = 'Saved';
              untrackChanges(shiurId);
          } catch (err) {
              errors.push(`Shiur ${shiurId}: ${err.message}`);
              row.querySelector('.status').textContent = 'Save failed';
          }
      }
      
      saveAllBtn.classList.remove('saving');
      
      if (errors.length) {
          alert(`Some changes failed to save:\n${errors.join('\n')}`);
      } else {
          const notice = document.createElement('div');
          notice.className = 'save-success-notice';
          notice.textContent = 'All changes saved successfully';
          document.querySelector('.admin-header').appendChild(notice);
          setTimeout(() => notice.remove(), 3000);
      }
  });

  // init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminPage);
  } else {
    initAdminPage();
  }

  // Also respond to any sign-in event
  window.addEventListener('googleSignIn', () => {
    // re-init if someone signs in after page load
    setTimeout(initAdminPage, 300);
  });

})();
