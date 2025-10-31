var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/aws4fetch/dist/aws4fetch.esm.mjs
var encoder = new TextEncoder();
var HOST_SERVICES = {
  appstream2: "appstream",
  cloudhsmv2: "cloudhsm",
  email: "ses",
  marketplace: "aws-marketplace",
  mobile: "AWSMobileHubService",
  pinpoint: "mobiletargeting",
  queue: "sqs",
  "git-codecommit": "codecommit",
  "mturk-requester-sandbox": "mturk-requester",
  "personalize-runtime": "personalize"
};
var UNSIGNABLE_HEADERS = /* @__PURE__ */ new Set([
  "authorization",
  "content-type",
  "content-length",
  "user-agent",
  "presigned-expires",
  "expect",
  "x-amzn-trace-id",
  "range",
  "connection"
]);
var AwsClient = class {
  static {
    __name(this, "AwsClient");
  }
  constructor({ accessKeyId, secretAccessKey, sessionToken, service, region, cache, retries, initRetryMs }) {
    if (accessKeyId == null) throw new TypeError("accessKeyId is a required option");
    if (secretAccessKey == null) throw new TypeError("secretAccessKey is a required option");
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.sessionToken = sessionToken;
    this.service = service;
    this.region = region;
    this.cache = cache || /* @__PURE__ */ new Map();
    this.retries = retries != null ? retries : 10;
    this.initRetryMs = initRetryMs || 50;
  }
  async sign(input, init) {
    if (input instanceof Request) {
      const { method, url, headers, body } = input;
      init = Object.assign({ method, url, headers }, init);
      if (init.body == null && headers.has("Content-Type")) {
        init.body = body != null && headers.has("X-Amz-Content-Sha256") ? body : await input.clone().arrayBuffer();
      }
      input = url;
    }
    const signer = new AwsV4Signer(Object.assign({ url: input.toString() }, init, this, init && init.aws));
    const signed = Object.assign({}, init, await signer.sign());
    delete signed.aws;
    try {
      return new Request(signed.url.toString(), signed);
    } catch (e) {
      if (e instanceof TypeError) {
        return new Request(signed.url.toString(), Object.assign({ duplex: "half" }, signed));
      }
      throw e;
    }
  }
  async fetch(input, init) {
    for (let i = 0; i <= this.retries; i++) {
      const fetched = fetch(await this.sign(input, init));
      if (i === this.retries) {
        return fetched;
      }
      const res = await fetched;
      if (res.status < 500 && res.status !== 429) {
        return res;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.random() * this.initRetryMs * Math.pow(2, i)));
    }
    throw new Error("An unknown error occurred, ensure retries is not negative");
  }
};
var AwsV4Signer = class {
  static {
    __name(this, "AwsV4Signer");
  }
  constructor({ method, url, headers, body, accessKeyId, secretAccessKey, sessionToken, service, region, cache, datetime, signQuery, appendSessionToken, allHeaders, singleEncode }) {
    if (url == null) throw new TypeError("url is a required option");
    if (accessKeyId == null) throw new TypeError("accessKeyId is a required option");
    if (secretAccessKey == null) throw new TypeError("secretAccessKey is a required option");
    this.method = method || (body ? "POST" : "GET");
    this.url = new URL(url);
    this.headers = new Headers(headers || {});
    this.body = body;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey; // <-- CORRECTED THIS LINE!
    this.sessionToken = sessionToken;
    let guessedService, guessedRegion;
    if (!service || !region) {
      [guessedService, guessedRegion] = guessServiceRegion(this.url, this.headers);
    }
    this.service = service || guessedService || "";
    this.region = region || guessedRegion || "us-east-1";
    this.cache = cache || /* @__PURE__ */ new Map();
    this.datetime = datetime || (/* @__PURE__ */ new Date()).toISOString().replace(/[:-]|\.\d{3}/g, "");
    this.signQuery = signQuery;
    this.appendSessionToken = appendSessionToken || this.service === "iotdevicegateway";
    this.headers.delete("Host");
    if (this.service === "s3" && !this.signQuery && !this.headers.has("X-Amz-Content-Sha256")) {
      this.headers.set("X-Amz-Content-Sha256", "UNSIGNED-PAYLOAD");
    }
    const params = this.signQuery ? this.url.searchParams : this.headers;
    params.set("X-Amz-Date", this.datetime);
    if (this.sessionToken && !this.appendSessionToken) {
      params.set("X-Amz-Security-Token", this.sessionToken);
    }
    this.signableHeaders = ["host", ...this.headers.keys()].filter((header) => allHeaders || !UNSIGNABLE_HEADERS.has(header)).sort();
    this.signedHeaders = this.signableHeaders.join(";");
    this.canonicalHeaders = this.signableHeaders.map((header) => header + ":" + (header === "host" ? this.url.host : (this.headers.get(header) || "").replace(/\s+/g, " "))).join("\n");
    this.credentialString = [this.datetime.slice(0, 8), this.region, this.service, "aws4_request"].join("/");
    if (this.signQuery) {
      if (this.service === "s3" && !params.has("X-Amz-Expires")) {
        params.set("X-Amz-Expires", "86400");
      }
      params.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
      params.set("X-Amz-Credential", this.accessKeyId + "/" + this.credentialString);
      params.set("X-Amz-SignedHeaders", this.signedHeaders);
    }
    if (this.service === "s3") {
      try {
        this.encodedPath = decodeURIComponent(this.url.pathname.replace(/\+/g, " "));
      } catch (e) {
        this.encodedPath = this.url.pathname;
      }
    } else {
      this.encodedPath = this.url.pathname.replace(/\/+/g, "/");
    }
    if (!singleEncode) {
      this.encodedPath = encodeURIComponent(this.encodedPath).replace(/%2F/g, "/");
    }
    this.encodedPath = encodeRfc3986(this.encodedPath);
    const seenKeys = /* @__PURE__ */ new Set();
    this.encodedSearch = [...this.url.searchParams].filter(([k]) => {
      if (!k) return false;
      if (this.service === "s3") {
        if (seenKeys.has(k)) return false;
        seenKeys.add(k);
      }
      return true;
    }).map((pair) => pair.map((p) => encodeRfc3986(encodeURIComponent(p)))).sort(([k1, v1], [k2, v2]) => k1 < k2 ? -1 : k1 > k2 ? 1 : v1 < v2 ? -1 : v1 > v2 ? 1 : 0).map((pair) => pair.join("=")).join("&");
  }
  async sign() {
    if (this.signQuery) {
      this.url.searchParams.set("X-Amz-Signature", await this.signature());
      if (this.sessionToken && this.appendSessionToken) {
        this.url.searchParams.set("X-Amz-Security-Token", this.sessionToken);
      }
    } else {
      this.headers.set("Authorization", await this.authHeader());
    }
    return {
      method: this.method,
      url: this.url,
      headers: this.headers,
      body: this.body
    };
  }
  async authHeader() {
    return [
      "AWS4-HMAC-SHA256 Credential=" + this.accessKeyId + "/" + this.credentialString,
      "SignedHeaders=" + this.signedHeaders,
      "Signature=" + await this.signature()
    ].join(", ");
  }
  async signature() {
    const date = this.datetime.slice(0, 8);
    const cacheKey = [this.secretAccessKey, date, this.region, this.service].join();
    let kCredentials = this.cache.get(cacheKey);
    if (!kCredentials) {
      const kDate = await hmac("AWS4" + this.secretAccessKey, date);
      const kRegion = await hmac(kDate, this.region);
      const kService = await hmac(kRegion, this.service);
      kCredentials = await hmac(kService, "aws4_request");
      this.cache.set(cacheKey, kCredentials);
    }
    return buf2hex(await hmac(kCredentials, await this.stringToSign()));
  }
  async stringToSign() {
    return [
      "AWS4-HMAC-SHA256",
      this.datetime,
      this.credentialString,
      buf2hex(await hash(await this.canonicalString()))
    ].join("\n");
  }
  async canonicalString() {
    return [
      this.method.toUpperCase(),
      this.encodedPath,
      this.encodedSearch,
      this.canonicalHeaders + "\n",
      this.signedHeaders,
      await this.hexBodyHash()
    ].join("\n");
  }
  async hexBodyHash() {
    let hashHeader = this.headers.get("X-Amz-Content-Sha256") || (this.service === "s3" && this.signQuery ? "UNSIGNED-PAYLOAD" : null);
    if (hashHeader == null) {
      if (this.body && typeof this.body !== "string" && !("byteLength" in this.body)) {
        throw new Error("body must be a string, ArrayBuffer or ArrayBufferView, unless you include the X-Amz-Content-Sha256 header");
      }
      hashHeader = buf2hex(await hash(this.body || ""));
    }
    return hashHeader;
  }
};
async function hmac(key, string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    typeof key === "string" ? encoder.encode(key) : key,
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(string));
}
__name(hmac, "hmac");
async function hash(content) {
  return crypto.subtle.digest("SHA-256", typeof content === "string" ? encoder.encode(content) : content);
}
__name(hash, "hash");
var HEX_CHARS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];
function buf2hex(arrayBuffer) {
  const buffer = new Uint8Array(arrayBuffer);
  let out = "";
  for (let idx = 0; idx < buffer.length; idx++) {
    const n = buffer[idx];
    out += HEX_CHARS[n >>> 4 & 15];
    out += HEX_CHARS[n & 15];
  }
  return out;
}
__name(buf2hex, "buf2hex");
function encodeRfc3986(urlEncodedStr) {
  return urlEncodedStr.replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}
__name(encodeRfc3986, "encodeRfc3986");
function guessServiceRegion(url, headers) {
  const { hostname, pathname } = url;
  if (hostname.endsWith(".on.aws")) {
    const match2 = hostname.match(/^[^.]{1,63}\.lambda-url\.([^.]{1,63})\.on\.aws$/);
    return match2 != null ? ["lambda", match2[1] || ""] : ["", ""];
  }
  if (hostname.endsWith(".r2.cloudflarestorage.com")) {
    return ["s3", "auto"];
  }
  if (hostname.endsWith(".backblazeb2.com")) {
    const match2 = hostname.match(/^(?:[^.]{1,63}\.)?s3\.([^.]{1,63})\.backblazeb2\.com$/);
    return match2 != null ? ["s3", match2[1] || ""] : ["", ""];
  }
  const match = hostname.replace("dualstack.", "").match(/([^.]{1,63})\.(?:([^.]{0,63})\.)?amazonaws\.com(?:\.cn)?$/);
  let service = match && match[1] || "";
  let region = match && match[2];
  if (region === "us-gov") {
    region = "us-gov-west-1";
  } else if (region === "s3" || region === "s3-accelerate") {
    region = "us-east-1";
    service = "s3";
  } else if (service === "iot") {
    if (hostname.startsWith("iot.")) {
      service = "execute-api";
    } else if (hostname.startsWith("data.jobs.iot.")) {
      service = "iot-jobs-data";
    } else {
      service = pathname === "/mqtt" ? "iotdevicegateway" : "iotdata";
    }
  } else if (service === "autoscaling") {
    const targetPrefix = (headers.get("X-Amz-Target") || "").split(".")[0];
    if (targetPrefix === "AnyScaleFrontendService") {
      service = "application-autoscaling";
    } else if (targetPrefix === "AnyScaleScalingPlannerFrontendService") {
      service = "autoscaling-plans";
    }
  } else if (region == null && service.startsWith("s3-")) {
    region = service.slice(3).replace(/^fips-|^external-1/, "");
    service = "s3";
  } else if (service.endsWith("-fips")) {
    service = service.slice(0, -5);
  } else if (region && /-\d$/.test(service) && !/-\d$/.test(region)) {
    [service, region] = [region, service];
  }
  return [HOST_SERVICES[service] || service, region || ""];
}
__name(guessServiceRegion, "guessServiceRegion");

// src/index.js

// --- CORRECTED CODE STARTS HERE ---

/**
 * Generates CORS headers based on the request origin.
 * @param {Request} request The incoming request.
 * @returns {HeadersInit} Headers object for the response.
 */
function getCorsHeaders(request) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = [
    "https://beisanytime.pages.dev", 
    "https://beisanytime.com",
    "http://localhost:3000",  // Add for local development
    "http://127.0.0.1:3000"   // Add for local development
  ];
  
  const responseHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };

  // Either allow specific origin or * for development
  if (origin && allowedOrigins.includes(origin)) {
    responseHeaders["Access-Control-Allow-Origin"] = origin;
  } else {
    // During development, you might want to allow all origins
    responseHeaders["Access-Control-Allow-Origin"] = "*";
  }

  return responseHeaders;
}
__name(getCorsHeaders, "getCorsHeaders");

/**
 * Creates a JSON response with appropriate CORS headers.
 * @param {object} data The JSON data to send.
 * @param {Request} request The original request object.
 * @param {number} [status=200] The HTTP status code.
 * @returns {Response}
 */
function jsonResponse(data, request, status = 200) {
  const headers = new Headers(getCorsHeaders(request));
  return new Response(JSON.stringify(data), { status, headers });
}
__name(jsonResponse, "jsonResponse");

/**
 * Creates a text response with appropriate CORS headers.
 * @param {string} data The text data to send.
 * @param {Request} request The original request object.
 * @param {number} [status=200] The HTTP status code.
 * @returns {Response}
 */
function textResponse(data, request, status = 200) {
  const headers = new Headers(getCorsHeaders(request));
  headers.set("Content-Type", "text/plain"); // Ensure text/plain for text responses
  return new Response(data, { status, headers });
}
__name(textResponse, "textResponse");

/**
 * Creates a JSON error response with appropriate CORS headers.
 * @param {string} message The error message.
 * @param {Request} request The original request object.
 * @param {number} [status=500] The HTTP status code.
 * @returns {Response}
 */
function errorResponse(message, request, status = 500) {
  // Pass the request object to getCorsHeaders for proper origin handling
  return jsonResponse({ error: message }, request, status); 
}
__name(errorResponse, "errorResponse");

var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const aws = new AwsClient({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      // It's good practice to specify the region if you know it
      // region: 'auto'
    });

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      // For OPTIONS requests, just return the CORS headers.
      // The body can be null, and status 204 (No Content) is common for successful preflights.
      return new Response(null, {
        headers: getCorsHeaders(request),
        status: 204 
      });
    }

    try {
      if (request.method === "GET" && url.pathname === "/") {
        return textResponse("Beis Anytime API is running correctly (Presigned PUT Method).", request);
      }

      if (request.method === "POST" && url.pathname === "/api/prepare-upload") {
        const { title, rabbi, fileName, thumbnailDataUrl, ...otherData } = await request.json();
        if (!title || !rabbi || !fileName) {
          return errorResponse("Title, Rabbi, and FileName are required.", request, 400);
        }
        const shiurId = crypto.randomUUID();
        const objectKey = `${rabbi}/${shiurId}-${fileName}`;
        const metadata = { id: shiurId, title, rabbi, fileName, objectKey, uploadedAt: (/* @__PURE__ */ new Date()).toISOString(), thumbnailDataUrl, ...otherData };
        const indexKey = `index_${rabbi}`;
        const indexResponse = await env.METADATA.get(indexKey, { type: "json" }) || [];
        indexResponse.unshift({ id: shiurId, title, date: metadata.date, rabbi, thumbnailDataUrl });
        await Promise.all([env.METADATA.put(shiurId, JSON.stringify(metadata)), env.METADATA.put(indexKey, JSON.stringify(indexResponse))]);
        
        const r2Url = new URL(`https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com/beis-anytime-recordings/${objectKey}`);
        const signedRequest = await aws.sign(
          new Request(r2Url, { method: "PUT" }),
          { aws: { signQuery: true, s3: { presign: true, expires: 3600 } } } // More explicit signing options
        );
        return jsonResponse({ signedUrl: signedRequest.url.toString() }, request);
      }

      const shiurimListMatch = url.pathname.match(/^\/api\/shiurim\/([a-zA-Z0-9_]+)$/);
      if (request.method === "GET" && shiurimListMatch) {
        const rabbi = shiurimListMatch[1];
        const indexKey = `index_${rabbi}`;
        const shiurimIndex = await env.METADATA.get(indexKey, { type: "json" });
        return jsonResponse((shiurimIndex || []).map((shiur) => ({
          ...shiur,
          thumbnailUrl: shiur.thumbnailDataUrl || "/images/placeholder-shiur.png"
        })), request);
      }

      const singleShiurMatch = url.pathname.match(/^\/api\/shiurim\/id\/([a-zA-Z0-9_-]+)$/);
      if (request.method === "GET" && singleShiurMatch) {
        const shiurId = singleShiurMatch[1];
        const metadataString = await env.METADATA.get(shiurId);
        if (!metadataString) {
          return errorResponse("Shiur not found.", request, 404);
        }
        const metadata = JSON.parse(metadataString);
        if (!metadata.rabbi || !metadata.objectKey || !metadata.title) {
          return errorResponse("Shiur metadata is incomplete/corrupted.", request, 500);
        }
        
        const r2PlaybackUrl = new URL(`https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com/beis-anytime-recordings/${metadata.objectKey}`);
        const signedPlaybackRequest = await aws.sign(
          new Request(r2PlaybackUrl, { method: "GET" }),
          { aws: { signQuery: true, s3: { presign: true, expires: 3600 } } } // More explicit signing options
        );
        return jsonResponse({ ...metadata, playbackUrl: signedPlaybackRequest.url.toString(), thumbnailUrl: metadata.thumbnailDataUrl || "/images/placeholder-shiur.png" }, request);
      }

      if (request.method === "GET" && url.pathname === "/api/all-shiurim") {
        let allShiurim = [];
        let cursor = null;
        let listOptions = { prefix: "index_", limit: 1000 };
        do {
          const listResponse = await env.METADATA.list(listOptions);
          for (const key of listResponse.keys) {
            const shiurimForRabbi = await env.METADATA.get(key.name, { type: "json" });
            if (shiurimForRabbi && Array.isArray(shiurimForRabbi)) {
              allShiurim = allShiurim.concat(shiurimForRabbi);
            }
          }
          cursor = listResponse.list_complete ? null : listResponse.cursor;
          listOptions.cursor = cursor;
        } while (cursor);
        allShiurim = allShiurim.map((shiur) => ({
          ...shiur,
          thumbnailUrl: shiur.thumbnailDataUrl || "/images/placeholder-shiur.png"
        }));
        return jsonResponse(allShiurim, request);
      }

      return errorResponse("Not Found", request, 404);
    } catch (err) {
      console.error(err.stack);
      // Ensure the request object is passed to errorResponse for CORS headers
      return errorResponse(err.message || "Internal Server Error", request, 500);
    }
  }
};
export {
  index_default as default
};
/*! Bundled license information:

aws4fetch/dist/aws4fetch.esm.mjs:
  (**
   * @license MIT <https://opensource.org/licenses/MIT>
   * @copyright Michael Hart 2024
   *)
*/
//# sourceMappingURL=index.js.map