import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 10000);
const WASEET_BASE = "https://api.alwaseet-iq.net";
const TEST_KEY = String(process.env.TEST_KEY || "");
const FETCH_TIMEOUT_MS = Math.min(Number(process.env.FETCH_TIMEOUT_MS || 15000), 30000);

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(body));
}

function authorized(req) {
  const supplied = String(req.headers["x-test-key"] || "");
  if (!TEST_KEY || supplied.length !== TEST_KEY.length) return false;
  let diff = 0;
  for (let i = 0; i < supplied.length; i++) diff |= supplied.charCodeAt(i) ^ TEST_KEY.charCodeAt(i);
  return diff === 0;
}

function safePreview(text) {
  return String(text || "").replace(/\s+/g, " ").slice(0, 350);
}

async function requestWaseet(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${WASEET_BASE}${path}`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "accept": "application/json, text/plain, */*",
        "user-agent": "DimStore-Waseet-Gateway/2.0 (+connectivity diagnostic)"
      }
    });
    const bodyText = await upstream.text();
    let data = null;
    try { data = JSON.parse(bodyText); } catch {}
    return {
      status: upstream.status,
      ok: upstream.ok,
      contentType: upstream.headers.get("content-type") || "",
      server: upstream.headers.get("server") || "",
      cfRay: upstream.headers.get("cf-ray") || "",
      data,
      preview: data === null ? safePreview(bodyText) : ""
    };
  } finally {
    clearTimeout(timer);
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/") {
    return json(res, 200, {
      service: "dimstore-waseet-gateway",
      ok: true,
      message: "Use /health or protected /test-cities and /test-regions?city_id=1"
    });
  }
  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, {
      ok: true,
      service: "dimstore-waseet-gateway",
      testKeyConfigured: Boolean(TEST_KEY),
      upstream: WASEET_BASE,
      mode: "read-only diagnostics"
    });
  }
  if (req.method !== "GET" || !["/test-cities", "/test-regions"].includes(url.pathname)) {
    return json(res, 404, { ok: false, error: "Not found" });
  }
  if (!authorized(req)) {
    return json(res, 401, { ok: false, error: "Unauthorized test request. Send x-test-key header." });
  }

  let path;
  if (url.pathname === "/test-cities") {
    path = "/v1/merchant/citys";
  } else {
    const cityId = String(url.searchParams.get("city_id") || "").trim();
    if (!/^\d{1,8}$/.test(cityId)) {
      return json(res, 400, { ok: false, error: "Provide a numeric city_id, e.g. ?city_id=1" });
    }
    path = `/v1/merchant/regions?city_id=${encodeURIComponent(cityId)}`;
  }

  try {
    const result = await requestWaseet(path);
    const payload = {
      ok: result.ok,
      upstreamStatus: result.status,
      contentType: result.contentType,
      upstreamServer: result.server,
      cfRay: result.cfRay || undefined
    };
    if (result.ok && result.data !== null) {
      payload.status = result.data?.status;
      payload.message = result.data?.msg;
      payload.count = Array.isArray(result.data?.data) ? result.data.data.length : undefined;
      payload.data = result.data;
      return json(res, 200, payload);
    }
    payload.note = "Upstream rejected or returned a non-JSON response.";
    payload.bodyPreview = result.preview || undefined;
    return json(res, 200, payload);
  } catch (err) {
    return json(res, 200, {
      ok: false,
      error: err?.name === "AbortError" ? "Upstream request timed out." : "Upstream request failed.",
      detail: String(err?.message || "Unknown error").slice(0, 180)
    });
  }
}).listen(PORT, "0.0.0.0", () => {
  console.log(`DimStore Waseet diagnostic gateway listening on ${PORT}`);
});
