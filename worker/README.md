Cloudflare Worker for Beis Anytime — Views / Likes / Comments / Display names / Banning

What this worker provides
- View counter per shiur (increment and read)
- Likes per shiur (per-user toggle by email)
- Comments per shiur (any signed-in user can post), store per-shiur comment list
- Display name storage per user
- Ban endpoint to stop specific emails from commenting
- Admin-only actions: delete comments, ban users

KV Namespaces to create and bind
- VIEWS_KV
- LIKES_KV
- COMMENTS_KV
- USERS_KV
- BANS_KV

Worker file
- worker/index.js

Environment variables
- ADMIN_EMAIL (e.g. beisanytime@gmail.com) — used for admin checks
- ADMIN_API_KEY (optional) — optional secret you can use instead of or in addition to ADMIN_EMAIL

Recommended binding in wrangler.toml (example)

name = "beis-anytime-api"
main = "worker/index.js"

[vars]
ADMIN_EMAIL = "beisanytime@gmail.com"
# ADMIN_API_KEY = "set_a_secret_here"

[[kv_namespaces]]
binding = "VIEWS_KV"
id = "PUT_YOUR_KV_ID_HERE"

[[kv_namespaces]]
binding = "LIKES_KV"
id = "PUT_YOUR_KV_ID_HERE"

[[kv_namespaces]]
binding = "COMMENTS_KV"
id = "PUT_YOUR_KV_ID_HERE"

[[kv_namespaces]]
binding = "USERS_KV"
id = "PUT_YOUR_KV_ID_HERE"

[[kv_namespaces]]
binding = "BANS_KV"
id = "PUT_YOUR_KV_ID_HERE"

Notes and security
- The worker in this repository trusts the header `X-User-Email` to identify the user. That means a malicious client could spoof that header. For production, verify Google ID tokens server-side and use the verified email.
- Admin operations are allowed when `X-User-Email` matches `ADMIN_EMAIL` OR when `X-Admin-Key` header matches `ADMIN_API_KEY`. Keep `ADMIN_API_KEY` secret and do not embed it into browser JS.

How to deploy
1. Create KV namespaces in the Cloudflare dashboard or via `wrangler kv:namespace create NAME` and copy their IDs.
2. Add the IDs and ADMIN_EMAIL to `wrangler.toml` as shown above.
3. Deploy with `wrangler publish`.

How the site interacts
- The site uses two separate origins: the main API (set in `API_BASE_URL` inside `script.js`) and the features worker (views/likes/comments/users) which should be set in `WORKER_BASE_URL` inside `script.js`.
- Client uses endpoints under `/api/...` on the worker origin. Example calls:
  - POST /api/views/increment  { id }
  - GET /api/views/:id
  - GET /api/likes/:id
  - POST /api/likes/:id  (header X-User-Email required)
  - GET /api/comments/:id
  - POST /api/comments/:id  (header X-User-Email required, body { text })
  - DELETE /api/comments/:id/:commentId (admin-only)
  - GET /api/users/:email
  - PUT /api/users/:email  (header X-User-Email must match or admin)
  - POST /api/ban  (admin-only)

  Client setup notes
  - In your site `script.js` set `WORKER_BASE_URL` to your worker URL (for example: `https://beisanytime-features.workers.dev`).
  - Keep `API_BASE_URL` pointing at your existing API if needed. The worker features will use `WORKER_BASE_URL`.

Testing with curl (PowerShell examples)

# Get views
curl "https://<YOUR_WORKER>/api/views/shiur-123"

# Increment view
curl -X POST "https://<YOUR_WORKER>/api/views/increment" -H "Content-Type: application/json" -d '{"id":"shiur-123"}'

# Like (requires email header)
curl -X POST "https://<YOUR_WORKER>/api/likes/shiur-123" -H "X-User-Email: user@example.com"

# Post comment
curl -X POST "https://<YOUR_WORKER>/api/comments/shiur-123" -H "Content-Type: application/json" -H "X-User-Email: user@example.com" -d '{"text":"Hello"}'


Next steps / Improvements
- Verify Google ID tokens in the worker (recommended) to prevent spoofing of X-User-Email.
- Rate-limit comments/likes per IP or per user to prevent abuse.
- Move admin-only UI actions to a server-side admin console that stores ADMIN_API_KEY securely.

