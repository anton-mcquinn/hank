# Hank — TODO

Running list of things to tackle. Detailed plans live in the `*-brainstorm.md` docs at the repo root.

## Priorities

- [ ] **Automate backend deploys to the DO droplet.** Today it's `git pull` + manual `systemctl restart` over ssh. Either a Dockerfile + container registry push, or a GitHub Action that ssh's in and runs the restart, or both (Docker image + Action that pulls it). Goals: zero-touch deploys on push to `main`, easy rollback, no more "did I remember to restart the service?" mistakes.
- [ ] **Design the full frontend-web experience.** Customer list/detail is in. Still needed: work order list/detail, invoice viewer + manual editor (the marquee feature), audio/transcript review, shop settings. See `web-frontend-brainstorm.md`.
- [ ] **Wire in a repair estimates API.** Hard. Need to pick a provider (Mitchell1, Identifix, AllData, RepairLink, ALLDATA's API tier?), figure out auth/billing, map their data model to ours, surface estimates in the work order flow. Likely a multi-week project on its own.
- [ ] **TestFlight deployment.** Apple Developer account is provisioning (wait ~48h). Once active: `eas build --platform ios --profile production` → `eas submit --platform ios --latest` → invite testers in App Store Connect.

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

## Cleanups / small stuff

- [ ] **Upgrade Expo SDK** (currently 52, latest is 54+). Restores Expo Go for quick testing. Do this *after* the first TestFlight cut so we have a known-good baseline.
- [ ] **Consolidate `.env` location.** Locally we have `backend/.env`; CLAUDE.md says repo root. The droplet uses root. Move local to root and delete `backend/.env` to match.
- [ ] **Frontend-web hosting setup** (Vercel / Cloudflare Pages / Netlify). Trivial when the web app is ready to share — `vite build` outputs to `dist/`.
- [ ] **Default Node version**: `nvm alias default 22` so new shells don't trip over the `create-vite` / Vite engine requirement.
- [ ] **Old Vite assets in `frontend-web/src/App.css`** are unused after the rewrite. Delete.
- [ ] **Hosted invoice page** (the public `/invoices/[token]` route from the email-delivery brainstorm) — lives in `frontend-web/` alongside the rest. Don't forget when email work starts.
