View counter Cloudflare Worker
=================================

This directory contains a minimal Cloudflare Worker that stores view counts in a Workers KV namespace.

Files:
- `worker.js` - Worker code that exposes the endpoints described below.

Endpoints
- GET  /api/views/:id
  - Returns JSON: { views: N }
- POST /api/views/:id/increment
  - Increments the counter (simple read-modify-write) and returns { views: N }

Bindings
- Create a KV namespace and bind it to the Worker with the binding name `VIEWS_KV`.

Wrangler example (snippet for `wrangler.toml`):

```toml
name = "beis-anytime-api"
type = "javascript"

account_id = "YOUR_ACCOUNT_ID"
workers_dev = true

[[kv_namespaces]]
binding = "VIEWS_KV"
id = "YOUR_KV_NAMESPACE_ID"
```

Deployment
1. Install Wrangler: `npm install -g wrangler`
2. Authenticate: `wrangler login` (or `wrangler config` / API token setup)
3. Deploy: `wrangler publish --env production` (or without env for workers_dev)

Notes
- This worker uses a simple KV read/put increment. Under heavy concurrent increments, KV may exhibit write contention. If you need strict atomic increments, use Durable Objects (not implemented here) or an external datastore.
