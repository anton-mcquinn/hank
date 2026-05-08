# Web Frontend Brainstorm

Brainstorming a web (desktop browser) frontend for Hank, alongside the existing iOS/Android Expo app. Not a decided plan — starting point for discussion.

## Why a web frontend

The mobile app is the right tool *in the bay* — voice notes, VIN photos, odometer photos, quick triage. It's the wrong tool for things you want to do sitting at a desk:

- Reviewing a day's worth of work orders at a glance
- Manually editing an invoice (line items, prices, taxes)
- Bulk customer management
- Cross-referencing history (customer → vehicles → past work)
- Reading a long transcript or work summary
- Printing
- Anything table-heavy

Mechanics want the iPad. Owners and front-desk staff want a laptop. Same backend, different surface.

## Approach: separate web app

Briefly considered using Expo's web target (`expo start --web` renders existing RN components via React Native Web), but rejected — RN components on desktop feel like a stretched mobile app, and the whole reason for a web frontend is the desktop affordances (real tables, hover, keyboard shortcuts, multi-column layouts). Building a separate web app under `frontend-web/` (or similar) that shares the FastAPI backend is the right call.

Considered Next.js, but rejected for this app — Next is mostly useful for SSR (SEO, marketing pages, public content), and this is an authenticated dashboard behind a login wall. SPA territory.

## Stack

Decided:

- **Vite + React + TypeScript** — familiar territory, fast dev server, no SSR overhead we don't need.
- **Tailwind + shadcn/ui** — shadcn isn't a runtime library; it's a CLI that copies pre-built accessible components (built on Radix + Tailwind) directly into our `src/components/ui/`. We own the code. Fast path to a decent-looking UI without doing design work from scratch.
- **TanStack Query** for API state (cache, invalidation, optimistic updates). Eliminates a class of stale-data bugs that the mobile app handles manually with `useState` + `useEffect`. Worth picking up.
- **React Router** for routing (or TanStack Router if we want type-safe routes — minor preference).
- **Zod** for request/response validation. Could codegen TS types from the FastAPI OpenAPI schema with `openapi-typescript` so the contract stays in sync with the backend.
- **JWT auth** — bearer token in `localStorage`, same pattern as the mobile app (see "Auth model" below).

## What ships in v1

Roughly in order of value:

1. **Auth** — login, JWT handling, protected routes.
2. **Customer list + detail** — table view, search, edit. **Starting here.** Boring on purpose: it exercises auth, list views, detail views, and edit forms with low risk, which proves the whole pipe end-to-end before we tackle anything tricky.
3. **Work order list + detail** — table view, status filters, open a single work order.
4. **Invoice viewer + manual editor** — view the rendered invoice, edit line items / labor / parts / tax. This is the feature that justifies the whole project.
5. **Shop settings** — view/edit business info. Low value compared to the above; can land any time.
6. **Audio + transcript review** — listen to the recording, edit the transcribed work summary on a real keyboard.

Things that stay mobile-only: voice recording, camera capture (VIN/odometer/plate photos). Those make no sense on a desktop browser.

## Manual invoice editing model

Decided: **edit the work order directly; the invoice is always a live view of the work order.** No snapshot, no separate `invoice_line_items` table.

- The mobile app already has a full work order edit screen (`frontend/app/workorders/edit/[id].tsx`) that modifies `line_items`, `total_parts`, `total_labor`, `total`, etc.
- The backend already accepts updates to all of those fields via `PUT /work-orders/{order_id}` (`backend/api/workorder_routes.py`, `WorkOrderUpdate` model in `backend/api/models.py`).
- The web invoice editor is a **UI project**: better tables, real `<input type="number">`, keyboard navigation, and a print-friendly preview. Zero new backend endpoints.

Trap to be aware of, deferred to later: in this model, work orders stay editable forever, which means an invoice we've already sent to a customer can drift after the fact. Today this doesn't matter — invoices are handed over in person as PDFs. The moment email delivery ships, it becomes real (customer clicks an old emailed link, sees a different total than what they originally got). Two ways to handle that when the time comes:

- **Lock on send.** When an invoice is emailed, flip a `locked_at` flag on the work order. Edits past that point require an explicit "create amended invoice" action.
- **Snapshot on send.** Copy the invoice contents into an `invoice_snapshots` table at send time; the hosted link renders from the snapshot.

Both are deferrable. Flagging here so it doesn't get forgotten.

## Auth model

Decided: **bearer token in `localStorage`**, same pattern as the mobile app.

- One auth path on the backend (the existing `Authorization: Bearer <token>` header), one mental model across both clients.
- `axios` (or fetch) interceptor reads the token from `localStorage` and attaches it to every request. Mirror of `frontend/app/api/client.ts`.
- Login response stores the token in `localStorage`. App boot reads it and validates against `/auth/me` (same as mobile).

The honest tradeoff: `localStorage` is readable by any JS running on the page, so an XSS injection can exfiltrate the token. The risk is manageable here because the SPA is a fixed surface (no user-supplied HTML rendering, no `dangerouslySetInnerHTML` on untrusted content, tight dependency footprint). Two other options were considered and rejected for now:

- **In-memory only** — solves XSS but logs the user out on every refresh. Bad UX without a refresh-token mechanism behind it.
- **httpOnly cookie** — safer (JS can't read it), but costs ~30 min of backend work (`Set-Cookie` on login, dual auth dependency, CORS `credentials: 'include'`, `SameSite=Lax` for CSRF). Worth doing later if the app ever handles more sensitive data than invoices.

Future work: if/when the app handles payment info, SSNs, or anything more sensitive than invoice line items, upgrade to **access token in memory + refresh token in httpOnly cookie**. Not a one-way door — the backend change is small and the frontend change is contained to the auth client.

## Backend impact

**For v1: effectively none.** The API is already REST + JWT, multi-tenancy means every endpoint is scoped, manual invoice editing reuses the existing `PUT /work-orders/{id}` endpoint, and we're sticking with bearer tokens (no cookie work needed). Things that would need attention:

- **CORS**: add the web frontend's domain to `CORS_ORIGINS`.
- **OpenAPI export** if we codegen types: `python -c "import json; from main import app; print(json.dumps(app.openapi()))"` → feed into `openapi-typescript`.

## Hosting

- **Vercel** for the Vite app (works fine for static SPA builds — `vite build` outputs to `dist/` which Vercel serves directly). Cloudflare Pages or Netlify are equivalent alternatives.
- Domain: subdomain off `hank.idleworkshop.com`, e.g. `app.hank.idleworkshop.com` for the web app, keep `hank.idleworkshop.com` (or `api.hank.idleworkshop.com`) for the API.
- The hosted invoice page from the email-delivery brainstorm could live in this same web app — `/invoices/[token]` as a public route — instead of being a Jinja template served by the API. Probably cleaner.

## Code sharing between mobile and web

Tempting to set up a monorepo with shared types/clients/business logic. My instinct: don't, at least not yet.

- The two apps share the *backend* — that's where the real shared contract lives.
- Sharing UI components between RN and React-DOM via something like Tamagui or Solito is possible but adds a lot of build complexity for two small apps.
- Shared API client TS types via codegen from the OpenAPI schema gets you 80% of the value of a monorepo with 10% of the work.

Revisit if the duplication starts hurting. Premature monorepo is worse than a little duplication.

## Tradeoffs

- **Two frontends to maintain.** Real cost. Mitigated by keeping the web app focused on what desktop does well, not chasing parity for parity's sake.
- **Auth model split** if we use cookies on web and bearer tokens on mobile. Manageable but not free.
- **Feature drift risk** — a feature lands on one but not the other. Counter: the backend is the source of truth; UIs catch up at their own pace.

## Open questions

- Print stylesheet for invoices in the browser — useful, or do we always go through the PDF route?
- Real-time updates (websockets / SSE) for "another employee just modified this work order"? Not v1, but the multi-employee brainstorm makes this a real question eventually.
- Lock-on-send vs snapshot-on-send for invoices once email delivery ships (see "Manual invoice editing model" above). Don't decide until email is closer.
- Upgrade auth from bearer-in-`localStorage` to access-in-memory + refresh-in-httpOnly-cookie. Trigger: anything more sensitive than invoice data lands in the app (see "Auth model" above).

## Rough phased plan

1. **Scaffold Vite + React app + auth.** Login, JWT handling, protected routes, hit `/auth/me`. No real features yet. Set up Tailwind + shadcn CLI + TanStack Query.
2. **Customer list + detail.** Read-only first, then edit. Proves the data flow end-to-end.
3. **Work order list + detail.** Same shape.
4. **Invoice viewer + manual editor.** The reason we're doing this. Mostly UI work — the backend already supports it.
5. **Audio / transcript review.** Nice-to-have, low priority.
6. **Hosted invoice page** (from email-delivery brainstorm) lives here too.

Steps 1–4 are probably a few focused days each.
