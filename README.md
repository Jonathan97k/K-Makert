# Kelnix Marketplace

A mobile-first, installable multi-supplier marketplace PWA for Malawi.

## Current milestone

- Responsive storefront with search, category filters and sorting
- Product cards show supplier attribution, unit and MWK price
- Cart with quantity controls and order summary
- WhatsApp checkout flow (activated after configuring the business number)
- Supplier recruitment CTA
- PWA manifest, installable app icon and app-shell service worker

## Important: preview catalogue

The products currently in src/App.jsx are **sample listings for interface testing only**. They are not verified supplier inventory, stock or live prices. Replace them with approved supplier listings before taking customer orders.

## Run locally

    npm install
    npm run dev

## Build

    npm run build

## Configuration

Set VITE_WHATSAPP_NUMBER to the Kelnix order WhatsApp number in the project settings in international format, digits only (for Malawi, start with 265; omit the leading +). Until configured, checkout displays a setup notice and does not send an order.

## Next product milestones

1. Supplier records, unique supplier IDs and supplier onboarding.
2. Secure admin dashboard to create suppliers and publish verified products.
3. Persistent product, stock, order and customer database.
4. Order routing by supplier, delivery coordination and payment status.
5. Supplier cost, selling price, margin and sales analytics.

The current storefront is a first UI milestone, not yet a complete multi-user commerce backend. Do not publish sample prices as live offers.
