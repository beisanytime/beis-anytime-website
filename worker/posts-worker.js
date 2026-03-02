// Cloudflare Worker: posts-worker.js
// Handles the Community Feed posts using a D1 database.
// Deploy this as a SEPARATE worker (e.g. beis-social-worker) from the KV worker.
//
// D1 Database setup - run this SQL once in the Cloudflare dashboard:
//   CREATE TABLE IF NOT EXISTS posts (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     user_email TEXT NOT NULL,
//     display_name TEXT,
//     avatar_url TEXT,
//     content TEXT NOT NULL,
//     created_at INTEGER NOT NULL DEFAULT (unixepoch())
//   );

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // Both emails are authorized to create/delete posts
        const ADMIN_EMAILS = ["beisanytime@gmail.com", "joshuacalvert1@gmail.com"];

        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-User-Email",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            // 1. GET /api/posts
            if (url.pathname === "/api/posts" && request.method === "GET") {
                const { results } = await env.DB.prepare(
                    "SELECT * FROM posts ORDER BY created_at DESC LIMIT 50"
                ).all();

                return new Response(JSON.stringify(results), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // 2. POST /api/posts
            if (url.pathname === "/api/posts" && request.method === "POST") {
                const body = await request.json();
                const { content, user } = body;

                if (!user || !ADMIN_EMAILS.includes(user.email)) {
                    return new Response("Unauthorized: Admin Access Only", {
                        status: 403,
                        headers: corsHeaders
                    });
                }

                if (!content) return new Response("Missing content", { status: 400, headers: corsHeaders });

                await env.DB.prepare(
                    `INSERT INTO posts (user_email, display_name, avatar_url, content)
           VALUES (?, ?, ?, ?)`
                ).bind(user.email, user.name, user.picture, content).run();

                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // 3. DELETE /api/posts/:id
            if (request.method === "DELETE" && url.pathname.startsWith("/api/posts/")) {
                const id = url.pathname.split("/").pop();
                const userEmail = request.headers.get("X-User-Email");

                if (!ADMIN_EMAILS.includes(userEmail)) {
                    return new Response("Unauthorized", { status: 403, headers: corsHeaders });
                }

                await env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();

                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            return new Response("Not Found", { status: 404, headers: corsHeaders });

        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }
    },
};
