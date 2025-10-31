const workerURL = 'https://beis-anytime-api.beisanytime.workers.dev';
const adminsUrl = '/admins.json';

let modifiedShiurim = new Set();
let saveAllBtn = null;

function getSignedInEmail() {
  if (window.currentGoogleUser && window.currentGoogleUser.email) return window.currentGoogleUser.email;
  if (window.googleUser && window.googleUser.email) return window.googleUser.email;
  const ls = localStorage.getItem('googleUserEmail');
  if (ls) return ls;
  try {
    const infoEl = document.querySelector('.user-info');
    if (infoEl && infoEl.dataset && infoEl.dataset.email) return infoEl.dataset.email;
  } catch (e) { }
  return null;
}

// Example usage to prevent unused function errors
(async function initAdminPage() {
  const email = getSignedInEmail();
  const admins = await fetchAdmins();
  const shiurim = await fetchShiurim();
  if (Array.isArray(shiurim)) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    shiurim.forEach(shiur => {
      container.appendChild(createEditableRow(shiur));
    });
    // Create Save All button
    saveAllBtn = document.createElement('button');
    saveAllBtn.innerHTML = 'Save All <span class="changes-count">(0)</span>';
    saveAllBtn.disabled = true;
    saveAllBtn.addEventListener('click', handleSaveAll);
    document.body.appendChild(saveAllBtn);
  }
})();

async function fetchAdmins() {
  try {
    const res = await fetch(adminsUrl, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) { console.warn('Could not load admins.json', e); return []; }
}

async function fetchShiurim() {
  const res = await fetch(`${workerURL}/api/all-shiurim`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch shiurim: ' + res.status);
  return await res.json();
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]); });
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
        <div><label>Rabbi / Creator</label><input class="admin-input rabbi" value="${escapeHtml((shiur.rabbi || '').replace(/_/g, ' '))}" style="width:100%"></div>
        <div><label>Uploader</label><input class="admin-input uploader" value="${escapeHtml(shiur.uploader || '')}" style="width:100%"></div>
        <div><label>Thumbnail URL</label><input class="admin-input thumbnail" value="${escapeHtml(shiur.thumbnailUrl || '')}" style="width:100%"></div>
      </div>
      <div style="width:240px;display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
        <div style="display:flex;gap:8px;width:100%;justify-content:flex-end;">
          <button class="save-btn" data-id="${shiur.id}" style="padding:8px;">Save</button>
          <button class="cancel-btn" data-id="${shiur.id}" style="padding:8px;">Reset</button>
          <button class="delete-btn" data-id="${shiur.id}" style="padding:8px;background:#e53e3e;color:#fff;border:none;border-radius:6px;">Delete</button>
        </div>
        <div class="status" style="font-size:0.9em;color:#444;width:100%;text-align:right;"></div>
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
  const deleteBtn = container.querySelector('.delete-btn');
  const statusDiv = container.querySelector('.status');

  thumbnailEl.addEventListener('input', () => {
    previewImg.src = thumbnailEl.value || '/images/placeholder-shiur.png';
  });

  cancelBtn.addEventListener('click', () => {
    titleEl.value = shiur.title || '';
    rabbiEl.value = (shiur.rabbi || '').replace(/_/g, ' ');
    uploaderEl.value = shiur.uploader || '';
    thumbnailEl.value = shiur.thumbnailUrl || '';
    previewImg.src = shiur.thumbnailUrl || '/images/placeholder-shiur.png';
    statusDiv.textContent = 'Reset';
    setTimeout(() => statusDiv.textContent = '', 1200);
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
      const id = shiur.id;
      let res = await fetch(`${workerURL}/api/shiur/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        res = await fetch(`${workerURL}/api/shiur/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      if (!res.ok) {
        res = await fetch(`${workerURL}/api/update-shiur`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.assign({ id }, payload))
        });
      }

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error('API error: ' + res.status + ' ' + text);
      }

      statusDiv.textContent = 'Saved';
      setTimeout(() => statusDiv.textContent = '', 1500);
      untrackChanges(shiur.id);
    } catch (err) {
      console.error('Save failed', err);
      statusDiv.textContent = 'Save failed: ' + (err.message || err);
    }
  });

  deleteBtn.addEventListener('click', async () => {
    if (!confirm('Delete this shiur permanently?')) return;
    statusDiv.textContent = 'Deleting...';
    try {
      const id = shiur.id;
      let res = await fetch(`${workerURL}/api/shiur/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        // fallback endpoint
        res = await fetch(`${workerURL}/api/delete-shiur`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
      }
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error('Delete failed: ' + res.status + ' ' + text);
      }
      // Remove row from DOM and untrack
      container.remove();
      untrackChanges(shiur.id);
    } catch (err) {
      console.error('Delete failed', err);
      statusDiv.textContent = 'Delete failed: ' + (err.message || err);
    }
  });

  // track changes on input modifications
  [titleEl, rabbiEl, uploaderEl, thumbnailEl].forEach(el => el.addEventListener('input', () => trackChanges(shiur.id)));

  return container;
}

function trackChanges(shiurId) {
  modifiedShiurim.add(shiurId);
  updateSaveAllButton();
}

function untrackChanges(shiurId) {
  modifiedShiurim.delete(shiurId);
  updateSaveAllButton();
}

function updateSaveAllButton() {
  if (!saveAllBtn) return;
  const count = modifiedShiurim.size;
  saveAllBtn.disabled = count === 0;
  const span = saveAllBtn.querySelector('.changes-count');
  if (span) span.textContent = `(${count})`;
}

async function handleSaveAll() {
  if (!modifiedShiurim.size) return;
  saveAllBtn.classList.add('saving');
  saveAllBtn.disabled = true;
  const errors = [];
  for (const shiurId of Array.from(modifiedShiurim)) {
    const row = document.querySelector(`.admin-row[data-id="${shiurId}"]`);
    if (!row) {
      untrackChanges(shiurId);
      continue;
    }
    const payload = {
      id: shiurId,
      title: row.querySelector('.title').value.trim(),
      rabbi: row.querySelector('.rabbi').value.trim().replace(/\s+/g, '_'),
      uploader: row.querySelector('.uploader').value.trim(),
      thumbnailUrl: row.querySelector('.thumbnail').value.trim()
    };
    const status = row.querySelector('.status');
    try {
      // try PUT, then PATCH, then fallback POST like the single-save flow
      let res = await fetch(`${workerURL}/api/shiur/${encodeURIComponent(shiurId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        res = await fetch(`${workerURL}/api/shiur/${encodeURIComponent(shiurId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        res = await fetch(`${workerURL}/api/update-shiur`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.assign({ id: shiurId }, payload))
        });
      }

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error('API error: ' + res.status + ' ' + text);
      }

      // success for this row
      if (status) {
        status.textContent = 'Saved';
        setTimeout(() => { if (status) status.textContent = ''; }, 1500);
      }
      untrackChanges(shiurId);
    } catch (err) {
      console.error('Save failed for', shiurId, err);
      if (status) status.textContent = 'Save failed: ' + (err.message || err);
      errors.push(`${shiurId}: ${err.message || err}`);
    }
  }

  // restore button state
  saveAllBtn.classList.remove('saving');
  saveAllBtn.disabled = false;
  updateSaveAllButton();

  if (errors.length) {
    // show a brief summary to the user and log details
    alert('Some saves failed:\n' + errors.join('\n'));
    console.warn('handleSaveAll errors:', errors);
  }
}
