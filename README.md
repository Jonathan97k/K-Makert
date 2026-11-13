# Kelnix Marketplace

A mobile-first multi-supplier marketplace for Malawi.

## Current storefront

- Responsive storefront with search, category filters and sorting
- Product cards show supplier attribution, unit and MWK price
- Cart with quantity controls and order summary
- WhatsApp checkout contact: +265 882 986 170
- Supplier recruitment call-to-action
- PWA entrypoint is wired for a manifest and service worker; verify the public PWA assets before describing the app as fully installable

## Catalogue warning

The products currently in `src/App.jsx` are **sample listings for interface testing only**. They are not verified supplier inventory, stock or live prices. Replace them with approved supplier listings before taking customer orders.

## Marketplace backend foundation (new)

The initial database migrations are at:

- `supabase/migrations/202611080001_marketplace_core.sql` — original Malawi multi-supplier marketplace schema.
- `supabase/migrations/202611130001_international_commerce_foundation.sql` — additive international supplier, market, shipping, currency and order-snapshot fields.

It creates the core data model for:

- Customer and role profiles
- Supplier applications, approval status and commission rate
- Products, supplier ownership, stock and moderation status
- Orders and supplier-specific order items
- Payment records (provider-neutral; no payment gateway is activated)
- Profit ledger for gross sales, supplier cost, platform fee and net profit
- Row-level security policies and guards against supplier self-approval or role escalation

### Apply the database migration

1. Provision or select the Supabase project connected to the Kelnix Marketplace Vercel project.
2. Open the Supabase SQL Editor.
3. Run the complete migration file above.
4. Create the first administrator account, then set its profile role from the SQL Editor:
   `update public.profiles set role = 'admin' where id = '<auth-user-uuid>';`
5. Add the Supabase project URL and publishable/anon key to the Vercel project environment. Never put a service-role key in browser code.

These migrations are committed but are **not yet confirmed applied to a live database**. The international migration has not yet been executed against a disposable test database and must be validated before production use. Until Supabase is provisioned and configured, supplier registration, dashboard data, stock updates, order persistence and profit reports are not live.

## Local development

    npm install
    npm run dev

## Build

    npm run build

## Configuration

- `VITE_WHATSAPP_NUMBER`: Kelnix order WhatsApp number in international digits-only format (265882986170).
- `VITE_CONTACT_EMAIL`: Kelnix contact email (info.kelnix@gmail.com).
- Supabase public URL and publishable/anon key: add after connecting the database resource. Never expose the service-role key.

## Delivery roadmap

| Module | State |
| --- | --- |
| Customer marketplace | Storefront UI in place; sample catalogue only |
| PWA foundation | Entrypoint wired; verify manifest/service worker assets |
| Supplier registration | Database schema prepared; live flow pending |
| Supplier dashboard | Pending |
| Product management | Database schema prepared; live UI/API pending |
| Admin dashboard | Database schema prepared; live UI/API pending |
| Order management | Database schema prepared; transactional order flow pending |
| Profit tracking | Ledger schema prepared; calculation and reporting pending |
| International commerce data | Additive schema drafted; migration validation pending |
| Payment integration | Provider selection and credentials required |

The next engineering dependency is a live Supabase database connection. Payment provider credentials and business verification will be needed before accepting online payments.
