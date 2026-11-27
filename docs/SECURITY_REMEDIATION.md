# KELNIX security remediation checklist

This checklist belongs to the isolated `fix/kelnix-security-performance` branch. It is not a production change.

## Verified findings

- Supabase Auth currently reports leaked-password protection as disabled.
- `jarvis_event_outbox` and `payment_webhook_events` have RLS enabled and no client-facing policies. This is intentional: the database grants table access only to `postgres` and `service_role`. Do not add anon/authenticated policies to silence the advisor.
- The advisor flags four SECURITY DEFINER RPCs as executable by authenticated users. Inspection confirmed that:
  - `admin_set_marketplace_seller_status` checks the caller is an authenticated marketplace admin before changing a seller status.
  - `request_marketplace_seller_access` requires a signed-in user and only changes that user's membership to pending.
  - `is_marketplace_admin` returns whether the current caller is an admin and is used by RLS policies.
  - `place_marketplace_order` is an existing physical-marketplace workflow and must remain separate from digital asset checkout.
- Column grants inspected on the current database do not give authenticated users UPDATE permission on `profiles.role` or `marketplace_memberships.seller_status`. The membership update grant is limited to buyer preference / timestamp columns. Keep this column-level restriction.
- Supabase reported 12 missing foreign-key indexes for digital asset tables and marketplace leads. The companion migration adds those indexes.

## Required Auth Dashboard action

The connected Supabase tools available to this workflow can inspect Auth findings but do not expose a supported setting to toggle leaked-password protection. Enable it manually in the Supabase Dashboard:

1. Open the KELNIX Supabase project.
2. Go to Authentication -> Settings (the exact grouping may appear under Security and Password settings).
3. Enable **Leaked password protection**.
4. Save the setting.
5. Re-run the Supabase Security Advisor and confirm `auth_leaked_password_protection` is no longer reported.

Supabase documentation: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Do not weaken password policy or disable email verification to work around this warning.

## Release gate

- Apply and test migrations only against an isolated preview database.
- Verify anonymous users cannot read orders, payment records, entitlements, webhook events, or repository files.
- Verify a buyer cannot change seller approval status or legacy admin role.
- Verify only approved sellers can submit assets for review.
- Keep private repository archives in a private Storage bucket; issue short-lived, buyer-authorized download links only after a payment is verified server-side.
- Do not deploy digital PayChangu checkout until its order/payment tables, webhook verification, amount/currency checks, idempotency, licence acceptance, and entitlement creation have passed tests.
- Do not merge this branch into production or modify production Auth settings until the preview test gate has passed and the owner approves release.
