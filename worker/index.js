/**
 * Beis Anytime - R2 Metadata Worker
 *
 * This worker replaces the KV-based metadata system.
 * It lists videos directly from an R2 bucket and parses metadata from filenames.
 * Filename Format: YYYY-MM-DD-Rabbi_Name-Title_of_Video.mp4 (also supports .mov)
 *
 * It also proxies requests to the "old" worker to ensure legacy videos remain accessible.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Configuration
    const OLD_WORKER_URL = 'https://beis-anytime-api.beisanytime.workers.dev';
    // You should bind your new R2 bucket to 'NEW_VIDEO_BUCKET'
    // And your public R2 URL to 'R2_PUBLIC_URL' in wrangler.toml or dashboard
    // Note: The public URL usually looks like https://pub-xxxx.r2.dev or a custom domain.
    // The .cloudflarestorage.com URL is for the S3 API and won't work in browsers.
    const R2_PUBLIC_BASE = env.R2_PUBLIC_URL || 'https://r2.beisanytime.com';

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Range, X-User-Email, X-Admin-Key",
      "Access-Control-Expose-Headers": "Accept-Ranges, Content-Length, Content-Range, ETag, Content-Type",
    };

    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // --- Utility: Parse filename to Metadata ---
    const parseFilename = (filename) => {
      const cleanName = filename.replace(/\.(mp4|mov|m4a|mp3)$/i, '');
      const base = `${url.origin}/api/video-proxy?key=`;

      // Helper to build URLs using the proxy
      const getProxyUrl = (key) => `${base}${encodeURIComponent(key)}`;

      // Try OLD format first: split by " - " (space dash space)
      const oldParts = cleanName.split(' - ');
      if (oldParts.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(oldParts[0].trim())) {
        const date = oldParts[0].trim();
        const rabbi = oldParts[1].trim().replace(/_/g, ' ');
        const title = oldParts.slice(2).join(' - ').trim().replace(/_/g, ' ');
        return {
          id: filename,
          title: title,
          rabbi: rabbi,
          date: date,
          thumbnailUrl: getProxyUrl(`thumbnails/${cleanName}.jpg`),
          playbackUrl: getProxyUrl(filename),
          source: 'r2'
        };
      }

      // Try NEW format: YYYY-MM-DD-Rabbi-Title (date is first 10 chars)
      const dateMatch = cleanName.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
      if (dateMatch) {
        const date = dateMatch[1];
        const rest = dateMatch[2];
        const firstDash = rest.indexOf('-');
        let rabbi, title;
        if (firstDash !== -1) {
          rabbi = rest.substring(0, firstDash).replace(/_/g, ' ');
          title = rest.substring(firstDash + 1).replace(/_/g, ' ');
        } else {
          rabbi = 'guests';
          title = rest.replace(/_/g, ' ');
        }
        return {
          id: filename,
          title: title,
          rabbi: rabbi,
          date: date,
          thumbnailUrl: getProxyUrl(`thumbnails/${cleanName}.jpg`),
          playbackUrl: getProxyUrl(filename),
          source: 'r2'
        };
      }

      // Fallback: return basic info so the video still shows
      return {
        id: filename,
        title: cleanName.replace(/[-_]/g, ' '),
        rabbi: 'guests',
        date: new Date().toISOString().split('T')[0],
        thumbnailUrl: getProxyUrl(`thumbnails/${cleanName}.jpg`),
        playbackUrl: getProxyUrl(filename),
        source: 'r2'
      };
    };

    // --- Route: GET /api/video-proxy?key=... ---
    // Serves files (videos/thumbnails) directly via the worker's binding.
    // Bypasses any custom domain/CORS issues on the public R2 domain.
    if (path === "/api/video-proxy" && method === "GET") {
      const key = url.searchParams.get("key");
      if (!key) return new Response("Missing key", { status: 400, headers: corsHeaders });

      const range = request.headers.get("Range");
      let obj;
      try {
        // Let R2 parse the browser's Range header, including suffix ranges.
        obj = await env.NEW_VIDEO_BUCKET.get(key, range ? { range: request.headers } : undefined);
      } catch (error) {
        return new Response(JSON.stringify({ error: "Unable to read video" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (!obj) return new Response("Not found", { status: 404, headers: corsHeaders });
      if (/^thumbnails\//i.test(key)) {
        const imageHeaders = new Headers(corsHeaders);
        imageHeaders.set("Content-Type", "image/jpeg");
        imageHeaders.set("Cache-Control", "public, max-age=31536000, immutable");
        return new Response(obj.body, { headers: imageHeaders });
      }

      const headers = new Headers(corsHeaders);
      obj.writeHttpMetadata(headers);
      if (/\.mov$/i.test(key)) headers.set("Content-Type", "video/quicktime");
      if (/\.mp4$/i.test(key)) headers.set("Content-Type", "video/mp4");
      headers.set("etag", obj.httpEtag);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      if (obj.range) {
        const rangeOffset = obj.range.offset ?? Math.max(0, obj.size - obj.range.length);
        const rangeLength = obj.range.length ?? obj.size;
        headers.set("Content-Range", `bytes ${rangeOffset}-${rangeOffset + rangeLength - 1}/${obj.size}`);
        headers.set("Content-Length", String(rangeLength));
      } else {
        headers.set("Content-Length", String(obj.size));
      }

      return new Response(obj.body, { status: obj.range ? 206 : 200, headers });
    }

    // --- Route: GET /api/debug-r2 ---
    // Helpful to see exactly what's in your bucket
    if (path === "/api/debug-r2" && method === "GET") {
      const objects = await env.NEW_VIDEO_BUCKET.list();
      return new Response(JSON.stringify(objects), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // --- Route: POST /api/admin/refresh-thumbnails ---
    // Regenerates thumbnails for every video using a supplied first-frame JPEG.
    // The browser extracts frames because Workers cannot decode video containers.
    if (path === "/api/admin/refresh-thumbnails" && method === "POST") {
      try {
        const body = await request.json();
        const { key, thumbnail } = body || {};
        if (!key || !thumbnail || !/^data:image\/jpeg;base64,/.test(thumbnail)) {
          return new Response(JSON.stringify({ error: "Missing video key or JPEG thumbnail" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const base64 = thumbnail.substring("data:image/jpeg;base64,".length);
        const binary = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
        const videoKey = key.replace(/^thumbnails\//i, '');
        if (/^thumbnails\//i.test(key) || !/\.(mp4|mov|m4v)$/i.test(videoKey)) {
          return new Response(JSON.stringify({ error: "Expected a video object key" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const thumbKey = `thumbnails/${videoKey.replace(/\.[^.]+$/, '.jpg')}`;
        await env.NEW_VIDEO_BUCKET.put(thumbKey, binary, { httpMetadata: { contentType: "image/jpeg" } });
        return new Response(JSON.stringify({ success: true, key, thumbnailKey: thumbKey }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // --- Route: POST /api/admin/cleanup-malformed-thumbnails ---
    // Removes thumbnail objects that were accidentally uploaded with a video extension.
    if (path === "/api/admin/cleanup-malformed-thumbnails" && method === "POST") {
      const objects = await env.NEW_VIDEO_BUCKET.list({ prefix: "thumbnails/" });
      const malformed = objects.objects.filter(object => /\.(mp4|mov|m4v)$/i.test(object.key));
      await Promise.all(malformed.map(object => env.NEW_VIDEO_BUCKET.delete(object.key)));
      return new Response(JSON.stringify({ deleted: malformed.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // --- Route: GET /api/admin/shiurim ---
    // Lists all shiurim for the admin panel
    if (path === "/api/admin/shiurim" && method === "GET") {
      return handleAllShiurim();
    }

    // --- Route: DELETE /api/admin/shiurim/:id ---
    if (path.startsWith("/api/admin/shiurim/") && method === "DELETE") {
      const id = decodeURIComponent(path.split("/").pop());

      if (/\.(mp4|mov|m4a|mp3)$/i.test(id)) {
        // Delete from R2
        await env.NEW_VIDEO_BUCKET.delete(id);
        // Also try deleting thumbnail
        const thumbKey = `thumbnails/${id.replace(/\.[^.]+$/, '.jpg')}`;
        await env.NEW_VIDEO_BUCKET.delete(thumbKey);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Fallback
      return fetch(`${OLD_WORKER_URL}${path}`, {
        method: 'DELETE',
        headers: request.headers
      });
    }

    // --- Route: GET /api/all-shiurim ---
    async function handleAllShiurim() {
      try {
        // 1. Fetch from Old Worker (Parallel)
        const oldPromise = fetch(`${OLD_WORKER_URL}/api/all-shiurim`).then(r => r.ok ? r.json() : []);

        // 2. List from R2
        const objects = await env.NEW_VIDEO_BUCKET.list();
        const r2Shiurim = objects.objects
          .filter(obj => !/^thumbnails\//i.test(obj.key) && /\.(mp4|mov|m4a|mp3)$/i.test(obj.key))
          .map(obj => parseFilename(obj.key))
          .filter(s => s !== null);

        let oldShiurim = await oldPromise;

        // Safety: Ensure oldShiurim is an array
        if (oldShiurim && !Array.isArray(oldShiurim)) {
          oldShiurim = [oldShiurim];
        } else if (!oldShiurim) {
          oldShiurim = [];
        }

        // Merge results
        const merged = [...r2Shiurim, ...oldShiurim];

        // Sort by date descending
        merged.sort((a, b) => new Date(b.date) - new Date(a.date));

        return new Response(JSON.stringify(merged), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    if (path === "/api/all-shiurim" && method === "GET") {
      return handleAllShiurim();
    }

    // --- Route: GET /api/shiurim/id/:id ---
    if (path.startsWith("/api/shiurim/id/") && method === "GET") {
      const id = decodeURIComponent(path.split("/").pop());

      // Check if it's an R2 file (ends with video extension)
      if (/\.(mp4|mov|m4a|mp3)$/i.test(id)) {
        const metadata = parseFilename(id);
        if (metadata) {
          return new Response(JSON.stringify(metadata), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      // Fallback to Old Worker
      return fetch(`${OLD_WORKER_URL}${path}`, {
        headers: { ...request.headers, "Access-Control-Allow-Origin": "*" }
      });
    }

    // ============================================================
    // CHUNKED MULTIPART UPLOAD (Bypasses 100MB worker body limit)
    // Flow: start-upload -> upload-part (x N) -> complete-upload
    // ============================================================

    // --- Route: POST /api/admin/prepare-upload ---
    // Returns the R2 key + starts a multipart upload for the video
    if (path === "/api/admin/prepare-upload" && method === "POST") {
      try {
        const body = await request.json();
        const { title, rabbi, date, fileName } = body;

        if (!title || !rabbi || !date) {
          return new Response("Missing metadata", { status: 400, headers: corsHeaders });
        }

        const extension = fileName.split('.').pop();
        const cleanTitle = title.replace(/[\\/:*?"<>| ]/g, '_');
        const cleanRabbi = rabbi.replace(/ /g, '_');
        const r2Key = `${date}-${cleanRabbi}-${cleanTitle}.${extension}`;
        const thumbKey = `thumbnails/${date}-${cleanRabbi}-${cleanTitle}.jpg`;

        // Set content type based on extension
        const contentType = extension.toLowerCase() === 'mov' ? 'video/quicktime' : 'video/mp4';

        // Start multipart upload for the video
        const multipartUpload = await env.NEW_VIDEO_BUCKET.createMultipartUpload(r2Key, {
          httpMetadata: { contentType: contentType }
        });

        return new Response(JSON.stringify({
          r2Key: r2Key,
          thumbKey: thumbKey,
          uploadId: multipartUpload.uploadId,
          // Thumbnail goes through the simple proxy (small file)
          thumbnailUrl: `${url.origin}/api/upload-proxy?key=${encodeURIComponent(thumbKey)}`
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // --- Route: PUT /api/admin/upload-part ---
    // Uploads a single chunk of a multipart upload
    if (path === "/api/admin/upload-part" && method === "PUT") {
      try {
        const r2Key = url.searchParams.get("key");
        const uploadId = url.searchParams.get("uploadId");
        const partNumber = parseInt(url.searchParams.get("partNumber"));

        if (!r2Key || !uploadId || isNaN(partNumber)) {
          return new Response("Missing key, uploadId, or partNumber", { status: 400, headers: corsHeaders });
        }

        const multipartUpload = env.NEW_VIDEO_BUCKET.resumeMultipartUpload(r2Key, uploadId);
        const part = await multipartUpload.uploadPart(partNumber, request.body);

        return new Response(JSON.stringify({
          partNumber: part.partNumber,
          etag: part.etag
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // --- Route: POST /api/admin/complete-upload ---
    // Completes a multipart upload after all parts are uploaded
    if (path === "/api/admin/complete-upload" && method === "POST") {
      try {
        const { r2Key, uploadId, parts } = await request.json();

        if (!r2Key || !uploadId || !parts) {
          return new Response("Missing r2Key, uploadId, or parts", { status: 400, headers: corsHeaders });
        }

        const multipartUpload = env.NEW_VIDEO_BUCKET.resumeMultipartUpload(r2Key, uploadId);
        await multipartUpload.complete(parts);

        return new Response(JSON.stringify({ success: true, r2Key: r2Key }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // --- Route: PUT /api/upload-proxy ---
    // Simple proxy for small files (thumbnails)
    if (path === "/api/upload-proxy" && method === "PUT") {
      const key = url.searchParams.get("key");
      if (!key) return new Response("Missing key", { status: 400, headers: corsHeaders });

      const contentType = key.endsWith(".jpg") ? "image/jpeg" :
                      key.endsWith(".mov") ? "video/quicktime" :
                      (request.headers.get("Content-Type") || "video/mp4");

      await env.NEW_VIDEO_BUCKET.put(key, request.body, {
        httpMetadata: { contentType: contentType }
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // --- Default: Proxy everything else to the old worker ---
    return fetch(`${OLD_WORKER_URL}${path}`, {
      method: method,
      headers: request.headers,
      body: request.body
    });
  }
}
