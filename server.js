const express = require('express');

const app = express();
app.disable('x-powered-by');

const PORT = process.env.PORT || 3000;
const BASE = (process.env.WASEET_BASE || 'https://api.alwaseet-iq.net').replace(/\/+$/, '');
const TOKEN = process.env.WASEET_MERCHANT_TOKEN || '';
const AUTH_MODE = (process.env.WASEET_AUTH_MODE || 'query').toLowerCase(); // query or bearer
const TEST_KEY = process.env.TEST_KEY || '';

app.get('/', (_req, res) => {
  res.type('text').send('Dim Store - Al-Waseet connectivity test. Use /health or /test-cities with the TEST_KEY.');
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'waseet-connection-test', tokenConfigured: Boolean(TOKEN), authMode: AUTH_MODE });
});

app.get('/test-cities', async (req, res) => {
  if (!TEST_KEY || req.get('x-test-key') !== TEST_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized test request. Set x-test-key header.' });
  }
  if (!TOKEN) {
    return res.status(503).json({ ok: false, error: 'WASEET_MERCHANT_TOKEN environment variable is not configured.' });
  }

  const url = new URL('/v1/merchant/citys', BASE);
  const headers = { 'Accept': 'application/json' };
  if (AUTH_MODE === 'bearer') {
    headers.Authorization = `Bearer ${TOKEN}`;
  } else {
    url.searchParams.set('token', TOKEN);
  }

  try {
    const upstream = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(20000) });
    const contentType = upstream.headers.get('content-type') || '';
    const body = await upstream.text();
    // Never return or log request URL, token, or authorization headers.
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = null; }

    return res.status(200).json({
      ok: upstream.ok,
      upstreamStatus: upstream.status,
      contentType,
      json: parsed,
      bodyPreview: parsed ? undefined : body.slice(0, 500),
      note: upstream.status === 403
        ? 'Al-Waseet or its edge security rejected this server request.'
        : upstream.status === 401
          ? 'Al-Waseet rejected authentication; verify the official authentication format.'
          : upstream.ok
            ? 'The server reached the Al-Waseet endpoint successfully.'
            : 'The upstream endpoint returned a non-success status.'
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: 'Could not complete request to Al-Waseet.',
      detail: String(err && err.name ? err.name : 'NetworkError')
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Diagnostic service listening on ${PORT}`);
});
