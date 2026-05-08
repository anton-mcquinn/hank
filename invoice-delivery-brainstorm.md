# Invoice Delivery Brainstorm

Brainstorming how to send invoices to customers — starting with email, with SMS as a likely follow-on. Not a decided plan.

## What "delivery" actually means

The customer's experience options, roughly cheapest-to-build → richest:

1. **PDF attachment** in an email. Customer opens, reads, saves. Universal, but mobile preview is awkward, attachments are sometimes flagged/blocked, and the body of the email is just boilerplate.
2. **Inline HTML email**. The invoice itself renders in their inbox. Looks great on mobile, no attachment friction. Downside: not a printable artifact they can save as a "document," and email-client CSS support varies (Gmail vs. Outlook vs. Apple Mail).
3. **Hosted link**. Email is a short notification — "Your invoice from Acme Auto is ready" — with a link to a branded web page that shows the invoice and offers a download button. This is what Stripe, QuickBooks, Square, etc. do.
4. **Hybrid (recommended)**. HTML email body with the invoice summary inline (totals, line items, customer + vehicle), plus a prominent "View / Download PDF" CTA pointing to a hosted page. Works as a glanceable preview AND a way to grab the formal PDF.

Why hybrid wins: the inbox preview gives the customer enough context to know what they got without clicking, the hosted page gives a clean printable/downloadable artifact, and the same hosted link works as the SMS payload later — so we don't build delivery infrastructure twice.

## Email service provider

Need a transactional email API. Options I'd consider:

- **Postmark** — best deliverability reputation for transactional, dead-simple API, ~$15/mo for 10k emails. Excellent template system. Strong default choice.
- **Resend** — newer, dev-friendly, similar pricing, first-class React Email integration if we want component-based templates. Smaller track record on deliverability but improving fast.
- **AWS SES** — cheapest by far ($0.10 per 1k emails), but you do more work yourself: suppression lists, bounce handling, complaint webhooks. Worth it at scale; not worth it at <1k/month.
- **SendGrid** — established but support quality has slipped; only pick if there's a specific feature you need.

At our volume (probably <1k emails/month for a while), I'd start with **Postmark** or **Resend** for the developer experience, and revisit SES if cost ever becomes a real line item.

## Sending domain & deliverability

This is the part that's easy to underestimate. If we don't get this right, invoices land in spam and customers think the shop is broken.

- Pick a sending domain — e.g. `invoices@mail.hank.idleworkshop.com` or `notifications@hank.idleworkshop.com`. Don't use the bare apex domain for sending.
- Set up **SPF**, **DKIM**, and **DMARC** records. All three are non-negotiable for inbox placement in 2026.
- Reply-to should be the *shop's* email (from `ShopSettings`), not ours. Customers reply with questions; the shop should get them.
- "From" name should read like the shop, e.g. `"Acme Auto Shop via Hank" <invoices@hank.idleworkshop.com>`. Per-shop "from name" is easy. Per-shop sending domain (so it reads like it actually came from the shop) is much harder — usually a paid tier feature where each shop verifies their own domain.

Recommendation for v1: single shared sending domain, per-shop "from name" + reply-to. Revisit per-shop domain authentication if a shop specifically asks for it.

## Format of the hosted invoice page

This is where the on-demand generation idea from `storage-brainstorm.md` matters: the hosted page just calls the same in-process invoice renderer and serves the HTML directly. PDF download is a separate route that streams the same content as `application/pdf`.

Auth model for the hosted page is the interesting question. Three options:

- **Signed token in the URL** (e.g. JWT with `order_id` + expiry, signed with a server secret). Customer doesn't need an account. URL is unguessable. Can expire after, say, 90 days. Easiest by far.
- **Public URL with random UUID slug**. Simpler than JWT, but anyone with the URL can view forever. Fine for invoices customers are meant to keep, riskier if a URL leaks.
- **Customer login**. Heaviest. Probably overkill unless we want a customer-facing portal later.

Recommendation: signed token. We control expiry, customers don't sign up for anything, and the same token can grant the PDF download.

## Templating

Two reasonable shapes:

- **Jinja2** (matches the existing `invoice_template.html` approach). Consistent with current code, no new dependencies. We'd just add an email-specific template alongside the invoice one.
- **React Email** (component-based, server-rendered to HTML+text). Better DX for complex templates, easier to preview in dev, but it's a Node-side renderer that doesn't fit a Python backend cleanly.

Stick with Jinja2 unless we add a Node service for some other reason. Email templates need to ship both HTML and a plain-text fallback; modern email clients still penalize HTML-only sends.

## Tracking & feedback

- **Open tracking** (1px transparent gif). Tells the shop whether the customer has seen the invoice. Useful, but blocked by Apple Mail Privacy Protection by default — treat as a soft signal, not truth.
- **Click tracking** on the "View Invoice" link. More reliable than open tracking, and confirms real engagement.
- **Bounce / complaint webhooks**. Mandatory: when an email hard-bounces or the customer hits "Report Spam," we need to know and stop emailing that address. Both Postmark and Resend deliver these as webhooks; we'd add a `customer_email_status` field (`active`, `bounced`, `complained`).

## Compliance

- Invoice delivery is *transactional*, so it's exempt from CAN-SPAM unsubscribe requirements. But we should still include something like "Manage preferences" footer for completeness.
- Customer email addresses are PII — don't log raw email bodies, don't include them in error messages that get sent to Sentry/etc.
- Each shop is responsible for their own customer consent. We should add language to the shop's terms saying so. Not legal advice; worth a real lawyer review before charging customers.

## SMS (later)

Once email delivery works end-to-end, SMS is mostly free reuse:

- Twilio for sending. ~$0.0079/msg in the US.
- Body is short — `"Hi {customer_name}, your invoice from {shop_name} is ready: {hosted_link}"`.
- Same hosted invoice page, same signed token, same PDF download flow. SMS doesn't carry attachments anyway, so the link is the right shape.
- A2P 10DLC registration is required for business SMS in the US. Annoying paperwork, takes ~1–2 weeks. Worth knowing about now so it's not a surprise later.

## Open questions

- Should the shop be able to **preview** the email before sending? (Probably yes for v1 — "Send Invoice" button shows a preview modal with the rendered email + recipient + reply-to, then a final "Send" confirms.)
- Do we want a **send log** per work order? ("Sent to jane@example.com on Apr 30, 2026 — opened on May 1.") Probably yes; a small audit trail is helpful for both shops and us.
- Do we resend automatically on bounce, or surface it to the shop and let them decide? Surfacing it is safer.
- For invoices specifically — should the email contain payment links? (Stripe, etc.) Not v1, but probably v2 or v3.
- Do shops want to send **estimates** the same way? Almost certainly yes; the delivery system should be invoice-or-estimate-agnostic from the start.

## Rough phased plan

Smallest blast radius first, again:

1. **Pick provider, verify sending domain, set up SPF/DKIM/DMARC.** No code yet.
2. **Build the hosted invoice page** with signed-token auth. Reuses the on-demand renderer (so this couples nicely to the storage-brainstorm work). Backend-only change plus a tiny public template.
3. **Email send endpoint + Jinja2 template.** Triggered by a "Send Invoice" button on the work-order detail screen. HTML + text body. Captures send events into a new `invoice_deliveries` table.
4. **Bounce / complaint webhooks** + `customer_email_status` field. Surface failed sends in the UI.
5. **Send log + UI**: show shops who got what and when, with status.
6. **SMS** via Twilio, reusing the hosted link.
7. **Per-shop sending domain** if any shop asks for it — it's enough work that it should be demand-driven, not speculative.

Steps 2 and 3 are the real meat. Everything before is plumbing; everything after is iteration.
