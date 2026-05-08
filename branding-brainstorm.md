# Branding / White-Label Brainstorm

Brainstorming per-shop custom branding so the app reflects the customer's business, not "Hank". Not a decided plan.

## What "branding" actually means

Several distinct levels, cheapest → richest:

1. **Branded artifacts only.** Logo + business name on invoices, emails, and the hosted invoice page. The app itself still looks like Hank. Customer-facing surfaces are branded; internal surfaces aren't.
2. **Branded app chrome.** Logo in the app header, business name in the title bar, maybe primary color theming. The shop sees "their" tool when they log in.
3. **Full white-label.** Custom domain (`invoices.acmeauto.com`), custom email sending domain, no "powered by Hank" anywhere. The customer-facing experience is indistinguishable from a tool the shop built themselves.

Recommendation: **start with #1, add #2 quickly, defer #3**. Branded artifacts are where customers actually see the brand. App chrome is a nice-to-have for the shop. Full white-label is a paid-tier feature when shops ask for it (and is the same conversation as per-shop sending domain in the email-delivery brainstorm).

## Storage & schema

Logos are images. Goes through the same path as customer/job photos:

- Upload via the same client-side compression flow (`expo-image-manipulator`), but at higher quality — logos render at small sizes, but artifacting on a logo is more noticeable than on a documentation photo.
- Store in R2 (when we get there) under a key like `shops/{shop_id}/branding/logo.{ext}`.
- Add `logo_storage_key` (or `logo_url` for now while files are still on the droplet) to `ShopSettingsDB`.
- Optional: `brand_color` (hex string) for the "app chrome" tier.

A reasonable v1 schema add:

```python
# in ShopSettingsDB
logo_storage_key = Column(String, nullable=True)
brand_color = Column(String, nullable=True)  # e.g. "#1a73e8"
```

## Where the logo shows up

In rough order of importance:

1. **Invoice PDF header.** Most-seen artifact. Replaces "Hank" placeholder header text. Sized maybe 200px wide, top-left or centered depending on layout.
2. **Email header.** When we ship email delivery, the HTML email body shows the shop's logo at the top.
3. **Hosted invoice page.** Same logo, page-header treatment.
4. **App home screen header.** Replace the "Hank" wordmark with the shop's logo when logged in.
5. **Login screen.** Probably keep the Hank logo here — pre-login the user hasn't selected a shop yet, and it's the only place "Hank" identity surfaces.

## Image requirements

Worth being prescriptive so shops don't upload bad assets:

- **Format**: PNG with transparent background preferred, JPEG accepted. SVG is a stretch goal (renders crisply at any size, but adds sanitization concerns — SVGs can carry scripts).
- **Min size**: 400px on the longest side. Too-small logos pixelate on the invoice PDF.
- **Max size**: 5 MB raw upload, server-side resize to 800px max for storage.
- **Aspect ratio**: any, but recommend square or wide (3:1). Tall logos break header layouts.
- Show the shop a preview of how the logo renders on the invoice header *before* they save — way easier than rolling back a bad upload.

## Color theming (the "app chrome" tier)

If we add `brand_color`:

- One color is enough. Don't try to do full design systems with primary/secondary/accent — shops won't have a brand guide.
- Use it for: primary action buttons, header background or accent line, links.
- Auto-derive contrast text color (white vs black) based on luminance — shop picks one color, we figure out what looks readable on it.
- Validate it parses as a hex color server-side. Don't let arbitrary CSS through.

Don't bother with dark/light variants of the brand color — pick one, render it consistently.

## Things that are NOT v1

- Custom fonts. Big rabbit hole, marginal value.
- Per-shop email sending domain (already deferred in email-delivery brainstorm).
- Custom app icon on the iPad home screen. Requires a separate App Store listing per shop. Not happening.
- Custom domain for the web frontend. Wait for explicit demand.
- Multiple logos for different contexts (invoice vs email vs in-app). One logo, used everywhere.

## Tradeoffs

- **More config to maintain.** Every branding knob is a thing that can render wrong, get corrupted, or be missing. Default-everywhere policy: if `logo_storage_key` is null, fall back to a clean text-only header. The app should never look broken because branding wasn't set.
- **Support burden.** Shops will ask "why does my logo look fuzzy" — usually because they uploaded a 100px JPEG. Mitigated by the preview-before-save flow.
- **Coupling to the storage migration.** Adding `logo_storage_key` now while files are on the droplet means we'll migrate it later alongside everything else. Fine — same migration script.

## Open questions

- Do we *require* a logo for v1, or is it strictly optional? Optional is friendlier; required forces shops to pick something during onboarding (and avoids the "blank header" look).
- Per-user vs per-shop branding? Once multi-employee lands, branding is unambiguously per-*shop*, not per-user. Worth designing for that from the start so we don't have to migrate.
- Email "from name" branding (already covered in email-delivery brainstorm) — should that auto-derive from the shop's business name in `ShopSettings`, or be a separate field? Probably auto-derive with override.
- Do we need to handle EXIF/metadata stripping on logo uploads? (Probably yes — it's PII-ish and image processors sometimes leave GPS coordinates in.)

## Rough phased plan

1. **Add `logo_storage_key` to `ShopSettingsDB`** + upload endpoint + display on the invoice PDF. Single feature, immediate value.
2. **Show the logo in the app header** when logged in.
3. **Add `brand_color`** + apply to primary buttons / accents.
4. **Render the logo on the email + hosted invoice page** (lands alongside email delivery).
5. **Custom sending domain / full white-label** — only when a shop explicitly asks.
