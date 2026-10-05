# Restaurant SaaS Agent Mind
This file is the working map for agents contributing to this repository. Read it before making changes.

## Project Identity

Restaurant SaaS is a multi-tenant restaurant operations platform built with Next.js App Router, React, TypeScript, Prisma, and PostgreSQL. It includes:

- Multi-tenant Subdomain Routing (e.g. `tenant.domain.com`)
- Restaurant/admin dashboard with extensive metrics and role-based permissions
- Super Admin / Platform dashboard for SaaS management, subscriptions, billing, blog, docs, and newsletters
- Menu, category, product, variation, recommendation, and personalization management
- Inventory Management (Ingredients, Recipes, Stock Entries, Branch-level stock)
- Expense Ledger (Manual and Inventory restock costs)
- POS (Cashier) with shift tracking, drawer cash, hardware printing (receipts/kitchen slips), and branch-aware behavior
- Online customer storefront with Google OAuth, order tracking, and mobile-friendly design
- Table Management with a visual floor plan editor and reservation status
- Kiosk self-ordering with category rails and QR sign-in
- KDS (Kitchen Display System) screens and order displays
- Advanced Reporting (Sales, Products, Shifts, Inventory, Expenses, Ledger) with Excel/CSV exports and ApexCharts/Recharts
- Global Payments: Stripe, PayPal (Partner Referrals/Subscriptions), JazzCash, Easypaisa
`
The package name is `storage`, but the product is a restaurant SaaS application.

## Runtime And Tooling

- OS used by the team: Windows
- Node requirement: `>=22.13.0 <23 || >=20.19.0 <21`
- Next.js: 15.x
- React: 18
- Prisma and `@prisma/client`: 5.14.x
- Database: PostgreSQL, commonly hosted on Prisma Cloud/Supabase-compatible infrastructure
- Styling: Tailwind CSS, Radix UI, `class-variance-authority`, `tailwind-merge`
- Validation: Zod
- Client data/API: Axios, SWR, local React state
- Authentication: NextAuth (Staff) and Custom JWT/Google OAuth (Customers)
- Icons: `lucide-react`, `@tabler/icons-react`
- Utilities: `decimal.js`, `date-fns`, `exceljs`, `react-to-print`, `leaflet`

Use `npm.cmd` rather than `npm` when PowerShell PATH does not expose npm.

## Core Commands

```powershell
npm.cmd run dev
npm.cmd run build
npm.cmd run start
npm.cmd run lint
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run db:setup
npx.cmd prisma generate
npx.cmd prisma migrate dev
npx.cmd prisma migrate status
```

Run commands from the repository root. The project loads `.env`; do not print secrets or expose `DATABASE_URL`.

## Directory Map

- `app/`: Next.js App Router. Segmented into `(auth)`, `(root)` [Restaurant Admin], `(saas)` [Marketing/SaaS], `(web-app)` [Customer Storefront], `admin/` [Super Admin], `api/`, `kiosk/`, `pos/`, `kds-screen/`, `order-display/`.
- `components/`: UI and feature components separated by domains (`admin`, `dashboard`, `order`, `pos`, `reports`, `kiosk`, `kds`, `saas`, `customer-app`, `setting`, `payments`, `tables`, `inventory`).
- `hooks/`: Client hooks for permissions, branch context, menu loading, realtime refresh, etc.
- `lib/`: Domain logic, database access, validation, pricing, menu mapping, authentication (`customer-auth`, `auth`), integrations (`stripe`, `paypal`, `jazzcash`, `easypaisa`), and middleware utilities.
- `prisma/schema.prisma`: Database source of truth for Prisma models/enums.
- `prisma/migrations/`: Applied migration history. Never casually edit or delete applied migrations.
- `prisma/seed.ts`, `prisma/fake-data.ts`: Seed and generated fake-data support.
- `constant/`, `data/`, `types/`, `styles/`, `public/`: Shared constants, sample data, types, styling, and assets.
- `scripts/`: Deployment and database helper scripts.
- `middleware.ts`: Tenant resolution (subdomains), URL-id rewriting, legacy route redirects, and edge authentication guards.

## Important Route Areas

### SaaS Marketing & Super Admin
- `app/(saas)/`: Public landing page, pricing, documentation, bilingual blog, demo request, newsletter, and policies.
- `app/admin/`: Super admin panel to manage SaaS subscriptions, tenants, blogs, newsletters, and documentation.
- `lib/stripe-server.ts`, `lib/paypal-subscriptions.ts`: Platform billing and tenant subscription lifecycle.

### Restaurant Dashboard
- `app/(root)/`: Authenticated restaurant dashboard.
- `app/(root)/recommendations/`: Recommendation configuration entry point.
- `app/(root)/inventory/`: Ingredients, stock entries, recipes.
- `app/(root)/reports/`: Sales, inventory, shift, and expense reports with `exceljs` export capabilities.
- `app/(root)/tables/`: Dining table floor plan builder.
- `components/dashboard/menu-manager/`: Wizards, recommendation rule forms, product imports, and menu editing.
- `components/setting/`: Restaurant profile, branding, roles, and payment gateway configurations.

### Customer Storefront and Orders
- `app/(web-app)/`: Online customer storefront with responsive layout.
- `components/customer-app/`: Storefront shell, locations, perks, Google sign-in.
- `components/order/`: Product customization, deals/offers dialogs, checkout, cutlery options, time-picker, and nested recommendation sheets.
- `lib/customer-storefront-paths.ts`, `lib/customer-auth/`: Customer routing and auth session handling.

### POS, Kiosk, and KDS
- `app/pos/`, `components/pos/`: POS shift management, on-screen keyboard, table orders, cart guards, cash drawer calculation, and hardware printing.
- `app/kiosk/`, `components/kiosk/`: Self-ordering, QR sign-in, payment success handling.
- `app/kds-screen/`, `components/kds/`: Kitchen display manager board and ticket action dialogs.
- `app/order-display/`, `components/order-display/`: Customer queue display screens.

## Data Model Concepts

The main business hierarchy extends across several domains:

**Menu & Ordering:**
```text
Restaurant
  -> Branch
  -> MenuCategory
       -> MenuItem
            -> MenuItemVariation (Pricing tiers like Small, Large)
            -> MenuItemIngredient (Recipe links to Ingredients)
            -> MenuItemAttributeGroup (Recommendations, limits, required options)
            -> MenuItemPersonalizeGroup (Guest preferences)
            -> MenuItemOffer / MenuItemDeal
  -> Order
       -> OrderItem
            -> OrderItemModifier
```

**Inventory & Staff:**
```text
Restaurant
  -> Ingredient & IngredientStockEntry (Manual/Restock)
  -> BranchIngredientStock
  -> Expense (Inventory/Manual)
  -> Employee & Role (Permissions)
  -> PosShift (Opened/Closed by User, Cash tracking)
```

**SaaS & Billing:**
```text
Platform
  -> SubscriptionCatalog
  -> RestaurantSubscription (PayPal/Stripe)
  -> NewsletterCampaign / BlogPost / Documentation
```

### Recommendation Feature Contract

- Selecting a product opens a Classic vs Advanced choice popup every time.
- Advanced opens the guided category-based editor. Advanced category product lists are scrollable.
- Advanced category products can be marked Remove or Free. Removed products must not appear to customers. Free products are always zero-priced.
- Category percentage discounts must work in both Classic and Advanced views.
- Variation min/max controls must work per base-product variation.
- The right-side preview must match the customer sheet (radio for single, checkboxes for multiple, +/- for quantity mode).

## Routing & Tenant Context

- `middleware.ts` handles tenant resolution via subdomains (e.g. `tenant.domain.com` or `tenant.localhost`).
- It rewrites root paths to `/:subdomain` and handles route protections.
- `lib/url-id-middleware.ts` handles obfuscated short UUIDs in URLs.
- Always preserve `req.headers.get("host")` semantics when generating absolute URLs.
- Branch-aware context: Categories and products can be hidden per branch (`MenuCategoryHiddenBranch`). APIs must pass opening hours (`Branch.openingHours`) and respect order scheduling (`orderScheduleMode`, `orderScheduleAt`).

## Pricing, Payments & Integrity Rules

- Compute all final prices server-side using known product/variation data (`lib/menu/configuration-variation-price.ts`).
- Removed recommendation options must be rejected server-side.
- Always-free options must contribute `0` to modifier/cart totals.
- Integrated Gateways: Stripe, PayPal (Partner integration), JazzCash, and Easypaisa. Payment configurations are stored securely per restaurant.
- POS/Online/Kiosk checkouts can enforce flat system service charges (configured in `Restaurant` model).

## Prisma And Migration Rules

- Use the repository Prisma version (`5.14.0`), prefer `npx.cmd prisma`.
- Always inspect generated SQL before applying a migration.
- `OrderItem.menuItemId` must remain nullable to support keeping historical orders even if a product is deleted (using `productName` snapshot).
- Do not accept migrations that drop tables/columns blindly if the local schema drifted.
- Run `npx.cmd prisma generate` and `npx.cmd prisma migrate status` regularly.
- If generation fails on Windows due to a locked `query_engine-windows.dll.node`, stop the Next.js dev server and retry.

## Editing Workflow For Agents

1. Read this file and inspect current git status.
2. Identify the narrow owning abstraction and nearby discriminating checks.
3. Read the exact current file contents before editing; user/formatter changes may exist.
4. Make the smallest focused patch.
5. Immediately run diagnostics or a focused test/build for the touched slice.
6. Keep changes compatible with existing APIs, subdomains, and saved data.
7. Before schema changes, inspect current migrations, database status, and generated SQL.
8. Never reset or checkout away user changes.
9. Do not commit unless explicitly requested.
10. Report what changed, what was verified, and any unresolved risk.

## UI Conventions

- Preserve existing Radix/Tailwind patterns and component APIs.
- Utilize existing components like `Button`, `Input`, `ScrollArea`, `AlertDialog`, `Select`, `Badge`.
- Support Dark Mode via `next-themes` and `Tailwind`.
- Use `lucide-react` and `@tabler/icons-react` icons.
- Kiosk/POS flows should be touch-friendly, fixed layout where applicable (e.g. fixed cart footers).
- Do not introduce unrelated visual redesigns while fixing data or behavior.

## Useful Validation Checklist

- `get_errors` on every changed TypeScript/Prisma file.
- `npx.cmd prisma validate` and `npx.cmd prisma generate` after schema changes.
- `npm.cmd run build` for final integration validation.
- Test flows: Dashboard product/classic/advanced setup, Customer storefront add to cart, Tenant subdomain resolution, POS shift and checkout, Reporting exports.
