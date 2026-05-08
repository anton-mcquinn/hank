# Storage Brainstorm

Brainstorming for moving user files (audio, customer/VIN/odometer/plate images, future per-job vehicle photos, invoices) off the droplet's local disk. Not a decided plan — just notes.

## Why move off the droplet

- Files on the droplet's local disk die if the droplet is rebuilt and don't survive scaling to >1 instance.
- Backups/restores are awkward when state lives in two places (Postgres + filesystem).
- It works fine for an MVP; this is a "before it bites" cleanup, not an emergency.

## Object storage choice: Cloudflare R2

Leading candidate: **Cloudflare R2**.

- $0.015/GB/mo storage, **free egress** forever.
- S3-compatible API → boto3 / standard SDKs work unchanged.
- Egress economics matter for this app: mechanics re-view job photos, customers download invoices, the iPad re-fetches images. On R2 every fetch is free; on Spaces or S3 they meter.

Alternatives considered:
- **DO Spaces**: $5/mo flat, includes 250 GB + 1 TB egress, $0.01/GB egress after. Same vendor as the droplet (lower ops overhead). Egress can sneak up if a shop is photo-heavy.
- **AWS S3**: most mature, but egress is the most expensive of the three.
- **Backblaze B2**: cheapest storage at $0.006/GB/mo, but egress isn't free unless paired with Cloudflare CDN.

Tradeoff with R2: a second vendor relationship (separate billing, separate dashboard). Mild ops cost; worth it for the egress economics.

## Sizing & cost math

Phone photos compressed client-side to ~1 MB each:

- 5–10 photos per job, ~100 jobs/month/shop = ~1 GB/shop/month
- 100 shops = ~100 GB/year
- At R2 storage cost: ~**$1.50/mo** for 100 shops worth of photos

Without client-side compression, raw iPhone HEICs at 8–10 MB each → 10x bigger and 10x more expensive. Compression is the single biggest lever.

## Client-side image compression

Use `expo-image-manipulator` (already in the Expo SDK).

```ts
import * as ImageManipulator from 'expo-image-manipulator';

const compressed = await ImageManipulator.manipulateAsync(
  uri,
  [{ resize: { width: 1920 } }],
  { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
);
// upload compressed.uri
```

- Runs natively (Core Image on iOS), doesn't block JS thread.
- Converts HEIC → JPEG automatically. Backend / OpenAI vision both handle JPEG cleanly.
- Respects EXIF rotation.
- Typical: 8 MB iPhone photo → ~1 MB at 1920px/80%, no perceptible quality loss for documentation.

Quality tuning per use case:
- General documentation photos: **0.8 quality** is fine.
- VIN / plate / odometer (goes to GPT-4o vision): **0.9 quality** — OCR is sensitive to compression artifacts, size hit is small.
- Audio (m4a/mp3/webm): **don't compress**. Codecs are already efficient; re-encoding loses quality without saving meaningful space.

Touch points where this needs to be added:
- `frontend/app/customers/new.tsx` — after `ImagePicker.launchCameraAsync` / `launchImageLibraryAsync`
- Work-order create flow — VIN, odometer, plate image paths
- Future per-job vehicle photo flow

Estimated work: ~5–6 lines per image upload site, plus a small helper.

## Upload flow with object storage

The shape of the upload flow changes when files go to R2 directly instead of streaming through the API:

1. Client asks the API for a presigned upload URL (scoped to a key like `users/{user_id}/jobs/{job_id}/photos/{uuid}.jpg`).
2. Client PUTs the (already-compressed) image straight to R2.
3. Client tells the API the resulting key.
4. API persists the key in Postgres and ties it to the work order / vehicle / customer.

Reads work the same way: API returns a presigned download URL, client fetches directly. (Or, for repeat views, the URL can be stable + token-protected via signed cookies / Cloudflare Access.)

A few moving pieces more than today's "POST a file to /work-orders/create", but it's the standard pattern and the right shape long-term.

## Invoices: regenerate, don't store

Invoices are a deterministic function of work order + customer + shop settings. Storing them on disk is mostly a waste — and it creates a class of "the invoice file is missing/orphaned" bugs (we already hit this once with a path-resolution issue, and would have hit it again on every droplet rebuild).

### Proposal

Drop disk persistence entirely. Generate-and-stream the PDF on every request:

- `POST /work-orders/{id}/generate-invoice` becomes essentially a no-op — it might still flip the work order status to `invoiced`, but it doesn't write a file or return a URL/path.
- `GET /work-orders/{id}/invoice.pdf` (new) generates the PDF in memory and streams it back as `application/pdf`. The frontend WebView points at this URL directly.
- The standalone `GET /invoices/{filename}` route goes away. So does `INVOICE_DIR`. So does `generate_pdf_with_reportlab` writing to `output_path` — it returns a `BytesIO` instead.

Net effect: one less env var, one less directory to back up, one less thing that can drift between environments.

### What changes in the code

- `services/invoice_generator_html.py`: change `generate_pdf_with_reportlab` to return bytes (or a `BytesIO`) instead of a file path.
- `api/invoice_routes.py`: collapse the two routes into one `GET` that returns a `StreamingResponse` or `Response(content=pdf_bytes, media_type="application/pdf")`.
- `frontend/app/components/PDFViewer.tsx`: no change — it already loads via authenticated WebView. The URL just stops including a generated filename.
- `frontend/app/(tabs)/invoices.tsx`: simplify — no more `pdf_path` round-trip. View button just opens the modal pointing at `/work-orders/{id}/invoice.pdf`.

### Tradeoffs

- **CPU per view**: ReportLab takes ~50–200ms per invoice depending on line item count. Negligible at this scale, and a per-request cache (in-memory LRU keyed on work order's `updated_at`) closes the gap if it ever matters.
- **Stale data**: if the shop renames itself or changes its address, an invoice "issued" yesterday will re-render with today's shop info. For a legal/accounting artifact this can matter. Two ways to handle:
  - **Snapshot at issue time**: when the work order is marked `invoiced`, copy the current shop settings + customer + line items into a JSON column on the work order (e.g. `invoice_snapshot`). The PDF route renders from the snapshot. This is the right answer if invoices are ever printed and given to customers as the "official" record.
  - **Always re-render live**: simpler, fine if invoices are treated as a current view rather than a frozen artifact. Reasonable for an internal shop tool, less so for anything that touches accounting.

  I'd lean toward the snapshot approach — it's cheap (one JSON column) and it removes a whole class of "why does the old invoice say something different now?" bugs. But it's a decision worth making explicitly rather than defaulting to.

### Why this matters for the storage question

Invoices were the most "obvious" candidate for object storage — they're files, they're per-user, they accumulate. But they're also the most regenerable thing in the system. Killing the storage entirely sidesteps R2 for invoices completely; the only things that need object storage are audio (transcribed once, kept for re-transcription / audit) and images (no way to regenerate a photo).

## Pricing / retention thinking

- Bake a generous storage allowance into each shop's plan tier (e.g. **25 GB/shop**).
- Overage rate at ~3–5x cost (e.g. $0.05–$0.10/GB/mo).
- Add a lifecycle rule: archive or auto-delete job photos after **7 years** (or whatever retention shops legally need). Storage shouldn't grow forever.
- Generate a thumbnail variant on upload so list views don't pull full-size files. Saves egress (free on R2 anyway, but still saves time + battery on the iPad).

## Open questions

- What retention do auto shops actually need by law? Varies by state. Worth checking before locking a default.
- Does R2 have any data-residency concerns for the customer base (e.g. shops in jurisdictions that require US-only storage)? R2 has region pinning; need to verify.
- Migration plan for existing droplet files when the time comes — likely a one-shot script that uploads to R2 and updates Postgres references.
- Auth model for presigned URLs: short-lived (per-request) vs. longer-lived (per-session). Short-lived is safer.

## Migration order (when ready)

Rough ordering, smallest blast radius first:

1. **Add client-side compression** to the existing upload paths. Pure frontend change, no schema impact, immediately reduces droplet disk pressure.
2. **Switch invoices to on-demand generation**. Backend-only change. Removes one whole storage category.
3. **Move audio + images to R2** with presigned URLs. Schema change (add `storage_key` columns), upload flow change, migration script for existing files.
4. **Add per-job vehicle photo feature** on top of the new flow.
