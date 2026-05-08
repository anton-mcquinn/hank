# Multi-Employee / Multi-Tenancy Brainstorm

Brainstorming how to support multiple employees per shop. Not a decided plan. This is the biggest of the three current brainstorms because it changes the tenancy model that was just established.

## The problem with the current model

Right now `user_id` *is* the tenant. Every customer, vehicle, and work order belongs to a single user. That works for a one-person operation but breaks the moment a shop has:

- An owner who handles invoicing
- A front-desk person who books appointments and creates work orders
- One or more mechanics who do the work and add notes

Today, all of those people would have to share one login — which means no audit trail of who did what, no per-person preferences, no ability to revoke access when someone leaves.

## The right model

**Shop is the tenant. Users are employees of a shop.**

- A `Shop` (or `Organization`) is the unit of data ownership.
- A `User` belongs to one or more shops (probably just one for v1, but the join table makes it cheap to expand later).
- Every customer, vehicle, work order is owned by a `shop_id`, not a `user_id`.
- Users have a **role** within the shop that gates what they can do.

## Schema sketch

```python
class ShopDB(Base):
    __tablename__ = "shops"
    id = Column(String, primary_key=True)  # uuid
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    # ShopSettings either merges into here or stays separate keyed on shop_id

class ShopMemberDB(Base):
    __tablename__ = "shop_members"
    shop_id = Column(String, ForeignKey("shops.id"), primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    role = Column(String, nullable=False)  # "owner", "admin", "employee"
    joined_at = Column(DateTime, default=datetime.utcnow)

# Existing tables: rename user_id → shop_id on Customer, Vehicle, WorkOrder.
# ShopSettings: primary key becomes shop_id (already keyed on user_id today —
# basically the same migration, just a rename).
```

## Roles for v1

Keep it small. Two roles cover most cases:

- **Owner** — can do everything, including invite/remove employees and edit shop settings.
- **Employee** — can do day-to-day work (customers, vehicles, work orders, generate invoices) but can't manage other employees or change billing.

Resist the urge to ship four roles on day one. We can split "manager" out of owner or "mechanic vs. front-desk" out of employee later if shops actually ask. Permissions creep is real and it's hard to take granularity *away*.

## Auth changes

JWT today carries `user_id`. After this change, it needs to carry both `user_id` and `shop_id`:

- On login, if the user belongs to exactly one shop, mint a token with `{user_id, shop_id, role}`.
- If a user belongs to multiple shops (rare for v1, but the schema allows it), the login flow needs a "select shop" step, or we issue a short-lived "pre-shop" token and a `/auth/select-shop` endpoint that exchanges it for a full token.
- `get_current_user` becomes `get_current_member` (or similar) and returns user + shop + role together.
- All existing repo methods change `user_id: str` → `shop_id: str`. The recently-finished multi-tenancy work mostly maps 1:1 — same filter pattern, different column name.

Role-gating: a small dependency like `require_role("owner")` for endpoints that should be owner-only (invite/remove, billing, possibly delete operations).

## Invite flow

Owner adds an employee:

1. Owner enters the new employee's email + role.
2. Backend creates a pending `ShopMemberDB` record (or a separate `ShopInviteDB` if we want invite-specific fields like expiry) and emails the invitee a signed-token link.
3. Invitee clicks link → frontend asks them to set a password (if new user) or just confirm joining (if existing user).
4. Token is consumed, membership becomes active.

Same email infrastructure as invoice delivery — Postmark/Resend, signed token in the URL. Reuse.

## Removing access

Two flavors:

- **Owner removes an employee.** Hard delete the `ShopMemberDB` row. Their existing JWT continues to work until expiry (typical for stateless JWT). For "kick them out *now*," we'd need either (a) a JWT denylist, or (b) shorter token expiry + refresh tokens, or (c) include a `revoked_at` check. Probably fine for v1 to accept JWT-expiry latency (e.g. tokens expire after 1 hour) and document it.
- **Employee leaves voluntarily.** Same database effect, different UX path (a "Leave shop" button rather than the owner doing it).

The owner of a shop can't remove themselves — would orphan the shop. Either prevent it or require ownership transfer first.

## Audit trail

Once multiple users touch the same data, "who did what" matters:

- Every `WorkOrderDB` already has a notion of who created it (today: implicit via `user_id`). After the change, add `created_by_user_id` to track the actual person.
- Probably also `last_modified_by_user_id` and `last_modified_at` on work orders and invoices.
- Full event log (e.g. `work_order_events` table) is overkill for v1; revisit if shops ask "who changed the price on this invoice?"

## Migration plan

Existing accounts each become their own one-person shop:

1. Add the new tables (`shops`, `shop_members`) without removing the old `user_id` columns.
2. Migration script: for every user, create a shop named after them (or after their `ShopSettings.business_name`), add a `shop_members` row with role `owner`, populate `shop_id` on all their existing customers/vehicles/work-orders.
3. Deploy the new code that reads `shop_id`. Old `user_id` columns become unused but stay for safety.
4. After a soak period (a week?), drop the old `user_id` columns.

Could also be done as a single hard cutover since the user base is small — but doing it in steps is safer and lets you roll back without data loss.

## Frontend impact

- **Mobile app**: minimal. Login still gives you a token; the token just happens to carry shop info too. The "select shop" step is a single screen and only triggers if a user is in multiple shops.
- **Web frontend**: this is where multi-employee really shines. Owner gets an "Employees" page (invite, list, change role, remove). Audit info ("Last edited by Jane on May 3") shows on work order detail screens.
- **Shop settings**: only owners can edit. Employees see read-only.

## Tradeoffs

- **Big refactor.** Touches every repo, every route, the JWT, the auth dependency. Doable but not small. Shouldn't be done in parallel with another big feature.
- **Migration risk.** Done wrong, you orphan data. Done in stages with a backout plan, low risk.
- **Slightly more complex login UX** for users in multiple shops. Could be deferred — v1 enforces one-shop-per-user and we relax later.
- **JWT revocation gap.** Removed employees keep working access until token expiry. Acceptable for v1; revisit if a shop has a real "fired employee, urgent" scenario.

## Open questions

- One shop per user, or many? The data model can support many cheaply, but the UX cost is non-trivial (shop picker, context switching). I'd ship one-per-user first and design the schema for many.
- Where does billing live — per-shop or per-user? Almost certainly per-shop (shop is the customer; employees are seats).
- Do employees need separate per-user preferences (e.g. theme, default screen)? Probably yes eventually, but a `UserSettings` table is cheap to add later.
- How do we handle the case where an existing customer/vehicle was "owned by user A" and now needs to be visible to user B in the same shop? The migration handles this — once everything's keyed on `shop_id`, it just works.
- Email invitations: who's the "from" address? Probably `notifications@hank.idleworkshop.com`, not the shop's branded sending domain. (Internal infra notification, not a customer touchpoint.)
- Does the iPad app support multiple users on the same device (login/logout flows)? It already does technically via `expo-secure-store`, but worth verifying the logout flow clears state cleanly.

## Rough phased plan

1. **Add `shops` + `shop_members` tables** (additive, no behavior change yet).
2. **Run migration script** to backfill shops + memberships for existing users.
3. **Switch JWT to carry `shop_id`**, switch repos and routes from `user_id` filter to `shop_id` filter. The big PR.
4. **Add invite + accept flow** + employee management UI (web frontend is the natural home).
5. **Add role-gating** on owner-only endpoints (invite, remove, edit shop settings).
6. **Add audit fields** (`created_by`, `last_modified_by`) on the entities where it matters.
7. **Drop unused `user_id` columns** after a soak period.

Steps 1–3 are the actual refactor; everything after is feature work that builds on it.
