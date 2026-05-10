# Hank — TODO

Running list of things to tackle. Detailed plans live in the `*-brainstorm.md` docs at the repo root.

## Priorities

- [x] **Automate backend deploys to the DO droplet.** Today it's `git pull` + manual `systemctl restart` over ssh. Either a Dockerfile + container registry push, or a GitHub Action that ssh's in and runs the restart, or both (Docker image + Action that pulls it). Goals: zero-touch deploys on push to `main`, easy rollback, no more "did I remember to restart the service?" mistakes.
- [ ] **Friendlier invoice numbers**. We need to figure out how to make the invoice numbers better than the random hash on the invoices themselves.
- [ ] **Design the full frontend-web experience.** Customer list/detail is in. Still needed: work order list/detail, invoice viewer + manual editor (the marquee feature), audio/transcript review, shop settings. See `web-frontend-brainstorm.md`.
- [ ] **Wire in a repair estimates API.** Hard. Need to pick a provider (Mitchell1, Identifix, AllData, RepairLink, ALLDATA's API tier?), figure out auth/billing, map their data model to ours, surface estimates in the work order flow. Likely a multi-week project on its own.
- [x] **TestFlight deployment.** Apple Developer account is provisioning (wait ~48h). Once active: `eas build --platform ios --profile production` → `eas submit --platform ios --latest` → invite testers in App Store Connect.
- [ ] **Fix timeout issue** that causes a user to have to log out and back in after some amount of time.
- [ ] **Harden auth before opening to testers.** Three pieces:
    - **User onboarding model.** `/auth/register` is wide open today — anyone who can reach the API can create an account. Decide between admin-only registration (creds shared out-of-band) or a real signup flow (email verification, password reset). Whichever path: rate-limit `/register` (today only `/token` has `@limiter.limit("10/minute")`).
    - **JWT secret management.** Strength check is in place (`main.py` rejects boot if `JWT_SECRET_KEY` < 32 chars or equals the dev default). What's missing is rotation + storage hygiene — the secret currently lives in `.env` on the droplet (and in any backups). Move to a real secrets store (DO secrets, 1Password, Doppler), document rotation, and rotate to a fresh `openssl rand -hex 32` before opening to testers.
    - **Refresh token flow.** `/auth/refresh` exists on the backend but the mobile app never calls it. Either wire it up (so we can shorten access-token TTL safely) or delete the dead endpoint to reduce attack surface.

## Backlog (from existing brainstorms)

- [ ] **Move user files off the droplet to Cloudflare R2.** Audio + images currently die on droplet rebuild. Plan in `storage-brainstorm.md`.
- [ ] **Client-side image compression** with `expo-image-manipulator`. Cuts photo upload size ~10x. Touchpoints listed in `storage-brainstorm.md`.
- [ ] **On-demand invoice PDF generation** instead of writing files to disk. Removes a class of "missing file" bugs. Plan in `storage-brainstorm.md`.
- [ ] **Email invoices to customers** (Postmark or Resend, hybrid HTML + hosted link). Plan in `invoice-delivery-brainstorm.md`. Includes setting up SPF/DKIM/DMARC on a sending subdomain.
- [ ] **Per-shop branding** (logo on invoices/emails, optional brand color). Plan in `branding-brainstorm.md`.
- [ ] **Multi-employee access** (Shop is the tenant, users are employees with roles). Big refactor — touches every repo and the JWT. Plan in `multi-employee-brainstorm.md`.

## Decision triggers (revisit when these become true)

- [ ] **Lock-on-send / snapshot-on-send for invoices.** Decide once email delivery is closer to shipping. Currently invoices live-render from the work order, which becomes a problem when customers can re-open old emailed links and see different totals.
- [ ] **Upgrade web auth from bearer-in-localStorage to access-in-memory + refresh-in-httpOnly-cookie.** Trigger: app starts handling anything more sensitive than invoice data (payment info, SSNs, etc.).
- [ ] **Per-shop sending domain for email.** Trigger: a shop explicitly asks to have invoices come from their own domain instead of `hank.idleworkshop.com`.
- [ ] **Custom domain for web app** (e.g. `app.hank.idleworkshop.com`). Trigger: web app moves past internal testing and gets shared with real shops.
- [ ] **Sequential work order numbers** ("WO #47" instead of "#ab12cd34"). Trigger: referring to WOs by UUID prefix becomes painful (phone calls, printed invoices). When picking this up: scope the sequence per-shop (filter `max()` by `user_id`, not global), plan a backfill via `ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at)`, decide on format (`#47` vs `2026-047` with yearly reset), and surface the number on invoice PDFs. Branch `claude/improve-topbar-display-dU4Cu` has a first cut to reference — global scope, no migration, don't merge as-is.

## Cleanups / small stuff

- [ ] **Upgrade Expo SDK** (currently 52, latest is 54+). Restores Expo Go for quick testing. Do this *after* the first TestFlight cut so we have a known-good baseline.
- [ ] **Consolidate `.env` location.** Locally we have `backend/.env`; CLAUDE.md says repo root. The droplet uses root. Move local to root and delete `backend/.env` to match.
- [ ] **Frontend-web hosting setup** (Vercel / Cloudflare Pages / Netlify). Trivial when the web app is ready to share — `vite build` outputs to `dist/`.
- [ ] **Default Node version**: `nvm alias default 22` so new shells don't trip over the `create-vite` / Vite engine requirement.
- [ ] **Old Vite assets in `frontend-web/src/App.css`** are unused after the rewrite. Delete.
- [ ] **Hosted invoice page** (the public `/invoices/[token]` route from the email-delivery brainstorm) — lives in `frontend-web/` alongside the rest. Don't forget when email work starts.
