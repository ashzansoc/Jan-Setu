# JANSETU Action Engine — status

Foundation for the autonomous portal-intelligence layer. This document states
plainly what is implemented, what was exercised against live portals, and what is
not built yet. Nothing here is claimed as "working" merely because code exists.

## Implemented and exercised

| Piece | File | Status |
|---|---|---|
| Organisation registry (6 destinations) | `server/action/org-registry.ts` | Implemented |
| Service discovery + electricity disambiguation | `server/action/discover.ts` | Implemented, tested |
| BrowserProvider contract | `server/browser/provider.ts` | Implemented |
| Playwright provider (isolated contexts, allowlist) | `server/browser/playwright-provider.ts` | Implemented, **read-only live test passed** |
| Durable store (SQLite via `node:sqlite`) | `server/db/index.ts` | Implemented, survives restart |
| Session / event / evidence persistence | `server/db/sessions.ts` | Implemented, tested |
| Approval gate (single-use, payload-bound) | `server/action/approval.ts` | Implemented, **tested** |
| Approval-gated `fill` / `click` | provider + routes | Implemented, gate proven |
| Browser workspace (portal session UI) | `src/screens/PortalLoginScreen.tsx` | Implemented |

### Persistence and approval — tested

- Session `bs-…` created, opened EPFiGMS (detected `login-required` + OTP),
  then the API was killed and restarted: the session came back from SQLite with
  its status and URL intact.
- Approval gate, step by step:
  - `fill` with no approval → `missing-approval` (400)
  - `fill` with a *pending* approval → `approval-invalid` (403)
  - after approving → the gate passed and the call reached the browser
  - replaying the same approval → `approval-invalid` (single-use proven)
- Events and evidence are written per session and returned by
  `/api/browser/:id/events` and `/api/browser/:id/evidence`.
- Approvals persist and are recorded as `used` once consumed.

### Live read-only tests performed

- `mcdonline.nic.in` → redirected to `/portal`, title "Municipal Corporation of
  Delhi", 4,000 chars extracted.
- `www.epfindia.gov.in` → redirected to `www.epfo.gov.in`, title "Employees'
  Provident Fund Organisation", 4,000 chars, 50 interactive elements, 80 links.
- Screenshot endpoint returned a 260 KB PNG.
- Unapproved host (`example.com`) → **403 host-not-approved**.
- Private host (`127.0.0.1`) → **403 private-host-blocked**.
- Redirect landing outside the allowlist → refused (`redirect-not-approved`).
  This was a real hole found during testing: EPFO redirects away from
  `epfindia.gov.in`, so the final URL is now re-validated after navigation.

### Discovery behaviour (tested)

| Request | Result |
|---|---|
| electricity + "Greater Kailash 2" | resolved → BRPL, basis `jurisdiction` |
| electricity, no locality or provider | **ambiguous** → asks which provider, 3 candidates |
| municipal | resolved → MCD, basis `single-provider` |

The engine never picks an electricity provider from the category alone — this is
the rule the product spec insists on.

## Registered destinations

| Organisation | Host(s) | Verification |
|---|---|---|
| EPFO / EPFiGMS | epfindia.gov.in, epfo.gov.in, unifiedportal-mem.epfindia.gov.in, epfigms.gov.in | documented |
| BSES BRPL | bsesdelhi.com | documented |
| BSES BYPL | bsesdelhi.com | documented |
| TPDDL | tatapower-ddl.com | documented |
| CPGRAMS | pgportal.gov.in | documented |
| MCD | mcdonline.nic.in | documented |

`documented` means the domain is the organisation's well-known public domain. It
does **not** mean a complaint workflow has been exercised.

## Not implemented — do not assume these work

- **Form submission.** `fill` and `click` now exist and are gated by a
  single-use approval bound to the exact action + payload hash. There is still no
  `submit` action, and no portal form has been filled for real.
- **Authentication handoff.** No credential or OTP entry. Login pages are only
  *detected* (`looksLikeLogin`, `looksLikeOtp`).
- **Skyvern provider.** `server/filing/skyvern.ts` exists but `SKYVERN_API_KEY`
  is unset, so it reports `not-configured`. No Skyvern run has been performed.
- **Portal workflows.** No EPFO claim-status flow, no BSES complaint flow. The
  registry lists intended entry points and required identifiers only.
- **Email execution.** `server/action/tools/email.ts` exists; no provider is
  configured and no email has been sent.
- **Browser process state.** The *records* persist (sessions, events, evidence,
  approvals), but the live Chromium context does not survive a restart — a
  session must be reopened. There is no credential vault.
- **Durable workflow orchestration.** No Temporal (or equivalent) integration.
- **Evidence store.** Screenshots are returned per request, not persisted with
  provenance.

## Security posture

- Destination allowlist enforced **before** navigation and **again** after any
  redirect.
- Private/loopback/link-local/metadata addresses blocked (SSRF guard).
- Only `http`/`https` schemes.
- One isolated `BrowserContext` per session — no shared cookies or storage.
- Page text is treated as untrusted data; nothing from a page is executed as an
  instruction.

## Recommended next slice

Per the product guidance: get **one** integration end-to-end before adding more.
The honest shortest path is:

1. ~~Persist `PortalSession` + `Evidence`~~ — done (SQLite).
2. ~~Approval + audit record~~ — done (single-use, payload-bound).
3. ~~`fill`/`click` behind the gate~~ — done.
4. **Next:** connect the PortalLogin screen to these routes so a citizen can watch
   the session, approve an action, and see evidence in Action Replay.
5. Then exercise EPFiGMS read-only end to end, and only afterwards with a
   user-supplied test account.
