# LedgerFlow frontend

Run `npm install` and `npm run dev` from this directory. The root redirects to `/accounts`.

Routes: `/accounts`, `/transfers`, `/treasury`, `/ledger`, `/system-status`.

## Data modes

- **Demo preview** (default): synthetic accounts and journal postings. Create/transfer/allocation update in-memory state. Reloading or switching data mode resets it. Nothing is written to Spring.
- **Local API**: choose this in the header to use the existing Spring Boot API. Default origin is `http://127.0.0.1:8081`; override `LEDGERFLOW_API_URL` in `.env.local` and restart Next. This is an origin, without `/api`.

The backend adapter is allowlisted and preserves decimal monetary JSON fields as strings. UI arithmetic uses integer minor units (BigInt), not floating-point money. Amount fields accept a period decimal separator without grouping; display uses IDR formatting.

## Scope and limitations

The implementation follows the supplied five-page HTML design with reusable React layout, forms, native modal dialogs, filtered/paginated tables and responsive navigation. Reference-frame examples are real conditional states, not duplicated sections below the page.

Existing endpoints support account creation/listing, transfers, treasury deposits, per-account statements, transaction lookup and health. Global journal listing, global reconciliation, volume aggregates, request metrics and persisted health history are not exposed: these are explicitly unavailable. The concurrency lab does not send requests.

The local backend has no authentication. Do not deploy this operator UI publicly until authentication, authorization and backend validation are implemented. A SANDBOX badge is a label, not a security boundary. Health exposes database state only if Spring includes it; no status is inferred from connectivity alone.

The backend currently replays an idempotency key without checking whether its payload changed. Preserve the key and payload after a failed/unknown submission. A financial-production idempotency contract requires backend hardening, including concurrent duplicate handling. Backend files were not changed in this frontend task.

## Verification

- `npm run lint`
- `npm run build`
- Start dev at `127.0.0.1:3100`, then `python tests/smoke.py` (requires Python Playwright and Chromium).

Smoke tests exercise demo-only account creation, filtering, transfers, journal counterpart inspection, status refresh and mobile overflow. Screenshots are written under ignored `tests/artifacts/`.
