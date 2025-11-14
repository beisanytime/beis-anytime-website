/* Cloudflare Worker for views, likes, comments, users, bans

KV namespaces expected (bind these in Worker settings or wrangler):
- VIEWS_KV
- LIKES_KV
- COMMENTS_KV
- USERS_KV
- BANS_KV

Environment variables (recommended):
- ADMIN_EMAIL  (e.g. beisanytime@gmail.com)
- ADMIN_API_KEY  (optional secret for admin actions)

Security note: This simple worker trusts the header 'x-user-email' sent by the client to identify users.
For production, verify Google ID tokens server-side to prove identity. See README.md for instructions.
*/

addEventListener('fetch', event => {
  // Wrap handler so any uncaught exception still returns a JSON error with CORS headers.
  event.respondWith((async () => {
    try {
      return await handle(event.request);
    } catch (err) {
      // Log the error and return a JSON 500 that includes CORS headers so browsers don't block it.
      console.error('Unhandled worker error:', err);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, X-User-Email, X-Admin-Key',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        }
      });
    }
  })());
});

const json = (data, init = {}) => {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' , 'Access-Control-Allow-Headers': 'Content-Type, X-User-Email, X-Admin-Key' },
    status: init.status || 200
  });
};

const text = (s, status = 200) => new Response(s, { status, headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' } });

async function getKVJson(kv, key) {
  const txt = await kv.get(key);
  if (!txt) return null;
  try { return JSON.parse(txt); } catch (e) { return null; }
}

async function putKVJson(kv, key, val) {
  await kv.put(key, JSON.stringify(val));
}

async function handle(request) {
  // Defensive check: ensure required KV bindings exist and return a clear error
  const requiredBindings = ['VIEWS_KV','LIKES_KV','COMMENTS_KV','USERS_KV','BANS_KV'];
  const missing = requiredBindings.filter(name => typeof globalThis[name] === 'undefined' || globalThis[name] === null);
  if (missing.length > 0) {
    console.error('Missing KV bindings:', missing);
    return json({ error: `Missing KV bindings: ${missing.join(', ')}` }, { status: 500 });
  }

  // Log basic request info to help debug unexpected errors (will appear in worker logs)
  console.log('Request', request.method, request.url);
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-User-Email, X-Admin-Key', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' } });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const parts = path.split('/').filter(Boolean);

  const userEmail = request.headers.get('x-user-email') || '';
  const adminKey = request.headers.get('x-admin-key') || '';
  const ADMIN = ADMIN_EMAIL || '';
  const ADMIN_KEY = ADMIN_API_KEY || '';

  // Simple helper to check admin
  const isAdmin = () => {
    if (userEmail && ADMIN && userEmail === ADMIN) return true;
    if (ADMIN_KEY && adminKey && adminKey === ADMIN_KEY) return true;
    return false;
  };

  // Routes
  // /api/views/:id
  if (parts[0] === 'api' && parts[1] === 'views') {
    const id = parts[2];
    if (!id) return json({ error: 'Missing id' }, { status: 400 });
    if (request.method === 'GET') {
      const val = await VIEWS_KV.get(id);
      return json({ count: parseInt(val || '0', 10) });
    }
    if (request.method === 'POST' && parts[2] === undefined) {
      return json({ error: 'Missing id in path' }, { status: 400 });
    }

    // fallback
  }

  // POST /api/views/increment
  if (parts[0] === 'api' && parts[1] === 'views' && parts[2] === 'increment' && request.method === 'POST') {
    try {
      const body = await request.json();
      const id = body && body.id;
      if (!id) return json({ error: 'Missing id' }, { status: 400 });
      const key = String(id);
      const prev = await VIEWS_KV.get(key) || '0';
      const next = String((parseInt(prev, 10) || 0) + 1);
      await VIEWS_KV.put(key, next);
      return json({ count: parseInt(next, 10) });
    } catch (e) {
      return json({ error: 'Invalid JSON' }, { status: 400 });
    }
  }

  // GET /api/views/:id
  if (parts[0] === 'api' && parts[1] === 'views' && parts[2] && request.method === 'GET') {
    const id = parts[2];
    const val = await VIEWS_KV.get(id) || '0';
    return json({ count: parseInt(val, 10) });
  }

  // Likes
  // GET /api/likes/:id
  if (parts[0] === 'api' && parts[1] === 'likes' && parts[2] && request.method === 'GET') {
    const id = parts[2];
    const key = `likes:${id}`;
    const data = await getKVJson(LIKES_KV, key) || { users: [] };
    const count = Array.isArray(data.users) ? data.users.length : 0;
    const userLiked = !!(userEmail && data.users.includes(userEmail));
    return json({ count, userLiked });
  }

  // POST /api/likes/:id  (toggles like for x-user-email)
  if (parts[0] === 'api' && parts[1] === 'likes' && parts[2] && request.method === 'POST') {
    const id = parts[2];
    if (!userEmail) return json({ error: 'Missing X-User-Email header' }, { status: 401 });
    const key = `likes:${id}`;
    const data = await getKVJson(LIKES_KV, key) || { users: [] };
    data.users = data.users || [];
    const idx = data.users.indexOf(userEmail);
    let userLiked = false;
    if (idx >= 0) {
      data.users.splice(idx, 1);
      userLiked = false;
    } else {
      data.users.push(userEmail);
      userLiked = true;
    }
    await putKVJson(LIKES_KV, key, data);
    return json({ count: data.users.length, userLiked });
  }

  // Comments
  // GET /api/comments/:id
  if (parts[0] === 'api' && parts[1] === 'comments' && parts[2] && request.method === 'GET') {
    const id = parts[2];
    const key = `comments:${id}`;
    const data = await getKVJson(COMMENTS_KV, key) || { comments: [] };
    // return in reverse chronological
    const comments = (data.comments || []).slice().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    return json({ comments });
  }

  // POST /api/comments/:id
  if (parts[0] === 'api' && parts[1] === 'comments' && parts[2] && request.method === 'POST') {
    const id = parts[2];
    if (!userEmail) return json({ error: 'Missing X-User-Email header' }, { status: 401 });
    // check ban
    const banKey = `ban:${userEmail}`;
    const isBanned = await BANS_KV.get(banKey);
    if (isBanned) return json({ error: 'You are banned from commenting' }, { status: 403 });
    try {
      const body = await request.json();
      const text = (body && body.text) ? String(body.text).slice(0, 2000) : '';
      if (!text) return json({ error: 'Empty comment' }, { status: 400 });
      const userObj = await getKVJson(USERS_KV, `user:${userEmail}`) || {};
      const displayName = userObj.displayName || userEmail;
      const comment = { id: `${Date.now()}-${Math.random().toString(36).slice(2,9)}`, email: userEmail, displayName, text, createdAt: new Date().toISOString() };
      const key = `comments:${id}`;
      const data = await getKVJson(COMMENTS_KV, key) || { comments: [] };
      data.comments = data.comments || [];
      data.comments.push(comment);
      await putKVJson(COMMENTS_KV, key, data);
      return json({ ok: true, comment });
    } catch (e) {
      return json({ error: 'Invalid JSON' }, { status: 400 });
    }
  }

  // DELETE /api/comments/:id/:commentId
  if (parts[0] === 'api' && parts[1] === 'comments' && parts[2] && parts[3] && request.method === 'DELETE') {
    const id = parts[2];
    const commentId = parts[3];
    if (!isAdmin()) return json({ error: 'Admin only' }, { status: 403 });
    const key = `comments:${id}`;
    const data = await getKVJson(COMMENTS_KV, key) || { comments: [] };
    data.comments = (data.comments || []).filter(c => c.id !== commentId);
    await putKVJson(COMMENTS_KV, key, data);
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  // Users
  // GET /api/users/:email
  if (parts[0] === 'api' && parts[1] === 'users' && parts[2] && request.method === 'GET') {
    const email = parts[2];
    const data = await getKVJson(USERS_KV, `user:${email}`) || {};
    return json(data);
  }

  // PUT /api/users/:email  (set displayName)
  if (parts[0] === 'api' && parts[1] === 'users' && parts[2] && request.method === 'PUT') {
    const email = parts[2];
    // require matching user or admin
    if (!userEmail) return json({ error: 'Missing X-User-Email header' }, { status: 401 });
    if (userEmail !== email && !isAdmin()) return json({ error: 'Permission denied' }, { status: 403 });
    try {
      const body = await request.json();
      const displayName = body && body.displayName ? String(body.displayName).slice(0, 80) : '';
      const key = `user:${email}`;
      const prev = await getKVJson(USERS_KV, key) || {};
      prev.displayName = displayName;
      await putKVJson(USERS_KV, key, prev);
      return json({ ok: true });
    } catch (e) {
      return json({ error: 'Invalid JSON' }, { status: 400 });
    }
  }

  // Ban endpoint (admin)
  // POST /api/ban  body { email }
  if (parts[0] === 'api' && parts[1] === 'ban' && request.method === 'POST') {
    if (!isAdmin()) return json({ error: 'Admin only' }, { status: 403 });
    try {
      const body = await request.json();
      const email = body && body.email ? String(body.email) : '';
      if (!email) return json({ error: 'Missing email' }, { status: 400 });
      const key = `ban:${email}`;
      await BANS_KV.put(key, '1');
      return json({ ok: true });
    } catch (e) {
      return json({ error: 'Invalid JSON' }, { status: 400 });
    }
  }

  return json({ error: 'Not found' }, { status: 404 });
}
