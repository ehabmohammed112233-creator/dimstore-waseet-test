# Dim Store - Al-Waseet connectivity test

This is a separate diagnostic service. It does not connect to or modify the live Dim Store system.

## Render settings
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`

## Environment variables (Render -> Environment)
- `WASEET_MERCHANT_TOKEN`: merchant token; add as a secret environment variable only.
- `TEST_KEY`: create a long random value used to protect the test endpoint.
- `WASEET_BASE`: `https://api.alwaseet-iq.net`
- `WASEET_AUTH_MODE`: `query` (default) or `bearer` only if the official API instructions require bearer authentication.

## Test
- Open `/health` to check the service is running. It does not reveal the token.
- Call `/test-cities` with header `x-test-key: YOUR_TEST_KEY` from a REST client. Do not put the test key in a public URL or share it in screenshots.

The service calls `GET /v1/merchant/citys` and returns the upstream HTTP status and a short body preview if the upstream response is not JSON. It never returns the token or logs the request URL.

Do not use real customer data or production shipment creation endpoints during this test. Do not commit secrets into GitHub.
