// Cloudflare Worker: view-counter
// Exposes simple KV-backed endpoints for view counts.
// Bind a KV namespace named `VIEWS_KV` in your worker's environment.
// Endpoints:
//  GET  /api/views/:id              -> { views: N }
//  POST /api/views/:id/increment    -> increments and returns { views: N }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

addEventListener('fetch', event => {
  event.respondWith(handle(event.request));
});

async function handle(request) {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

    // Accept both /api/views/:id and /views/:id
    const viewsIndex = parts.indexOf('views');
  if (viewsIndex === -1) return json({ error: 'Not found' }, 404);

  const id = parts[viewsIndex + 1];
    const action = parts[viewsIndex + 2] || null; // e.g. 'increment'
  if (!id) return json({ error: 'Missing id' }, 400);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // GET current count
    if (request.method === 'GET' && !action) {
      const raw = await VIEWS_KV.get(id);
      const views = raw ? parseInt(raw, 10) || 0 : 0;
      return json({ views });
    }

    // POST increment
    if (request.method === 'POST' && (action === 'increment' || action === null)) {
      // Simple KV increment: read-modify-write. This is not strictly atomic under heavy concurrent writes,
      // but is acceptable for many use-cases. If you need strict atomic increments, consider Durable Objects.
      const raw = await VIEWS_KV.get(id);
      const current = raw ? parseInt(raw, 10) || 0 : 0;
      const next = current + 1;
      await VIEWS_KV.put(id, String(next));
      return json({ views: next });
    }

    return json({ error: 'Method not allowed' }, { status: 405 });
  } catch (err) {
    return json({ error: String(err) }, { status: 500 });
  }
}

function json(obj, opts = {}) {
  const { status = 200 } = opts;
  const headers = Object.assign({
    'Content-Type': 'application/json;charset=UTF-8',
    'Cache-Control': 'no-store'
  }, CORS_HEADERS);
  return new Response(JSON.stringify(obj), { status, headers });
}

// Deployment notes (Cloudflare dashboard)
// This script is ready to paste directly into the Cloudflare Workers editor (no Wrangler required).
// Steps:
// 1) In your Cloudflare dashboard go to Workers -> Create a Worker and replace the default code with this file.
// 2) In the Worker settings (Variables -> KV - Namespaces) add a binding:
//      - Name: VIEWS_KV
//      - Select an existing KV namespace or create a new one and save.
// 3) Save and deploy the Worker. Use the worker's URL (workers.dev or your route) as the viewWorkerURL in your site.
//
// Quick test examples:
//  GET  https://<your-worker>.workers.dev/api/views/<id>                -> { "views": N }
//  POST https://<your-worker>.workers.dev/api/views/<id>/increment      -> { "views": N }
//
// Notes: this implementation uses KV read->put for increments. For strictly atomic counters under high concurrency,
// consider Durable Objects. If you want API-key protection or rate-limiting, I can add that option.
