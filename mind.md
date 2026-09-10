# Restaurant SaaS Agent Mind

This file is the working map for agents contributing to this repository. Read it before making changes.

## Project Identity

Restaurant SaaS is a multi-tenant restaurant operations platform built with Next.js App Router, React, TypeScript, Prisma, and PostgreSQL. It includes:

- Restaurant/admin dashboard
- Menu, category, product, variation, recommendation, and personalization management
- POS and branch-aware POS behavior
- Online customer storefront
- Kiosk ordering
- KDS kitchen screens and order displays
- Customer accounts, payments, subscriptions, analytics, and settings

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
- Authentication: NextAuth
- Icons: `lucide-react` and existing icon libraries

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

- `app/`: Next.js App Router pages, layouts, route handlers, and API endpoints.
- `components/`: feature UI and reusable Radix/Tailwind components.
- `hooks/`: client hooks for permissions, branch context, bootstrap data, progressive menu loading, realtime refresh, and guards.
- `lib/`: domain logic, database access, validation, pricing, menu mapping, order creation, permissions, formatting, and shared helpers.
- `prisma/schema.prisma`: database source of truth for Prisma models/enums.
- `prisma/migrations/`: applied migration history. Never casually edit or delete applied migrations.
- `prisma/seed.ts`, `prisma/fake-data.ts`: seed and generated fake-data support.
- `constant/`, `data/`, `types/`, `styles/`, `public/`: shared constants, sample data, types, styling, and assets.
- `scripts/`: deployment and database helper scripts.
- `middleware.ts`: authentication/routing middleware.

## Important Route Areas

### Admin and dashboard

- `app/(root)/`: authenticated restaurant dashboard pages.
- `app/(root)/recommendations/page.tsx`: recommendation configuration entry point.
- `components/dashboard/menu-manager/recommendations-tab.tsx`: recommendation product picker, selected-product state, draft state, save/delete orchestration, and right-side preview.
- `components/dashboard/menu-manager/configuration-wizard.tsx`: guided/Advanced recommendation editor and classic editor section host.
- `components/dashboard/menu-manager/configuration-wizard-configure-step.tsx`: category/product selection and wizard settings.
- `components/dashboard/menu-manager/recommendation-rule-form.tsx`: legacy Classic recommendation editor and its draft type.
- `components/dashboard/menu-manager/recommendation-preview-panel.tsx`: customer-like recommendation preview.
- `components/dashboard/menu-manager/types.ts`: dashboard row types for categories, products, groups, and offers.

### Customer menu and order flow

- `app/(web-app)/[slug]/page.tsx` and related storefront components: online customer storefront.
- `components/customer-app/web-app-storefront.tsx`: storefront shell and layout.
- `components/customer-app/sidebar.tsx`: customer branch/store sidebar.
- `components/order/order-page.tsx`: order/menu page, category/product loading, branch context, and ordering state.
- `components/order/product-customize-dialog.tsx`: customer product customization entry point.
- `components/order/nested-recommendation-sheet.tsx`: customer recommendation group selection UI.
- `components/order/menu-offer-choice-dialog.tsx`: offered product/deal selection UI.
- `components/order/checkout-page.tsx`: cart submission and order scheduling payload.
- `app/api/customer/menu/*`: customer menu APIs.
- `app/api/customer/orders/route.ts`: online order creation.

### POS, kiosk, and KDS

- `components/pos/pos-screen.tsx`: POS product/category selection, cart, modifiers, and order flow.
- `components/kiosk/kiosk-app.tsx`: kiosk mode, category rail, product cards, customization, cart, and checkout.
- `components/kiosk/kiosk-branch-client.tsx`: kiosk branch/client wrapper.
- `app/kiosk/[slug]/[branchId]/page.tsx`: kiosk branch route.
- `components/kds/`: kitchen display screens and manager board.
- `app/api/kiosk/orders/route.ts`: kiosk order creation.
- `app/api/restaurant/pos-order/[orderId]/route.ts`: POS order handling.
- `app/api/restaurant/kds/*`: KDS order/ticket APIs.

## Data Model Concepts

The main business hierarchy is:

```text
Restaurant
  -> Branch
  -> MenuCategory
       -> MenuItem
            -> MenuItemVariation
            -> MenuItemAttributeGroup
                 -> category/product recommendation source
                 -> MenuItemAttributeGroupVariationLimit
            -> MenuItemPersonalizeGroup
            -> MenuItemOffer
  -> Order
       -> OrderItem
            -> OrderItemModifier
```

Relevant recommendation enums:

- `AttributeSelectionType`: `SINGLE` or `MULTIPLE`
- `RecommendationSourceType`: `CATEGORY` or `PRODUCT`
- `RecommendationMultipleMode`: `CHECKBOX` or `QUANTITY`

Recommendation groups support category/product sources, required/optional selection, min/max selection counts, free quantity for quantity mode, variation-specific limits, default products/variations, variation pricing, and category percentage discounts.

`MenuItemAttributeGroup.productOverrides` is a JSON field used by the current recommendation enhancement work. The intended shape is product-id keyed override metadata such as excluded/removed and always-free flags. Keep normalization backward-compatible: missing/empty overrides mean all eligible category products remain visible and paid.

`MenuItemOffer` historically links a base product to an offered product with ordering. It is not yet a full deal model unless explicitly extended. Do not silently reprice existing offers.

## Recommendation Feature Contract

The requested recommendation redesign has these decisions:

- Selecting a product opens a Classic vs Advanced choice popup every time.
- Classic opens the existing old/classic editor.
- Advanced opens the guided category-based editor.
- Advanced category product lists are scrollable.
- Advanced category products can be marked Remove or Free.
- Removed products must not appear to customers.
- Free products are always zero-priced at every allowed quantity and add zero to cart totals.
- Category percentage discounts must work in both Classic and Advanced views.
- Variation min/max controls must work per base-product variation.
- Recommended Deals use percentage discounts.
- Deal/product selection should show product photos.
- The right-side preview should match the customer sheet: radio controls for single, checkboxes for multiple, plus/minus for quantity mode, variation controls, photos, free state, removed state, discounts, and deal selection.
- The customer recommendation components are the behavioral reference. Do not invent a separate preview-only pricing engine.

## Recommendation Data Flow

1. `RecommendationsTab` loads categories/products through `useRecommendationsCatalog` and product APIs.
2. Selecting a product stores a pending product ID.
3. The mode dialog chooses `classic` or `advanced`.
4. The selected product is loaded from `/api/restaurant/menu/items/:itemId`.
5. `ConfigurationWizard` receives `viewMode`.
6. Classic mode renders `ClassicConfigSections`, which uses `RecommendationRuleForm`.
7. Advanced mode renders the guided wizard and `ConfigurationWizardConfigureStep`.
8. Drafts are converted into API payloads in `recommendations-tab.tsx` and `configuration-wizard-draft.ts`.
9. Recommendation group creation/update endpoints validate with `lib/validation/recommendation-group.ts`.
10. Customer menu loaders select and map groups through:
    - `lib/menu/customer-menu-attribute-groups-select.ts`
    - `lib/menu/build-customer-attribute-group.ts`
    - `lib/menu/load-customer-menu.ts`
    - `lib/menu/load-customer-menu-progressive.ts`
11. Customer selection and cart prices are assembled through:
    - `lib/menu/recommendation-limits.ts`
    - `lib/menu/recommendation-category-limits.ts`
    - `lib/menu/configuration-variation-price.ts`
    - `lib/menu/recommendation-addon-price.ts`
    - `lib/menu/build-modifier-selections.ts`
    - `lib/menu/build-confirm-modifier-selections.ts`
    - `lib/cart-normalize.ts`

When adding a recommendation field, update the whole chain: Prisma schema, validation, create/update API, select/include contract, mapper, dashboard types/drafts, customer sheet, modifier builders, cart/order validation, and preview.

## Branch And Order Scheduling Context

Branch opening hours are stored on `Branch.openingHours` as JSON. Orders carry:

- `orderScheduleMode`
- `orderScheduleSlot`
- `orderScheduleAt`

Relevant helpers/components:

- `lib/order-time-slots.ts`
- `components/order/order-time-picker-dialog.tsx`
- `components/order/order-menu-header.tsx`
- `components/order/checkout-page.tsx`
- `components/order/order-page.tsx`
- `components/branched/branched-page.tsx`

Branch APIs must pass opening hours through create/update/customer responses. KDS manager responses display scheduling fields. Preserve the shared schedule shape and machine-readable timestamp.

## Branch-Aware Menu URLs

`lib/customer-menu-client.ts` requires the full argument order for category item URLs:

```ts
buildCustomerMenuCategoryItemsUrl(
  categoryId,
  restaurantSlug,
  storeId,
  hostSubdomain,
  branchId,
  opts
)
```

Likewise, category URLs support the optional branch ID. A missing or misplaced branch argument can cause categories/products to disappear from online order pages.

## Pricing And Integrity Rules

- Prices should be calculated from server-known product/variation data where possible.
- Do not trust client-submitted modifier prices without validation/recomputation.
- Removed recommendation options must be rejected or ignored server-side.
- Always-free options must contribute `0` to modifier/cart totals.
- Category discounts should have one shared calculation path and consistent rounding.
- Min/max validation must enforce `max >= min` globally and per variation.
- Existing free-quantity semantics are historically first-N-units-free for quantity groups. Product-level always-free overrides are a separate rule and must not accidentally consume group free quantity unless explicitly designed.
- Do not alter unrelated order, payment, inventory, or subscription behavior while changing recommendation pricing.

## Prisma And Migration Rules

- Use the repository Prisma version (`5.14.0`), not a globally installed Prisma 7 CLI.
- Prefer `npx.cmd prisma ...` on Windows.
- Always inspect generated SQL before applying a migration.
- Do not accept a migration that drops unrelated tables/columns because the local schema has drifted.
- The database currently has historical `OrderItem` rows with nullable `menuItemId`; `OrderItem.menuItemId` must remain nullable and `productName` must remain as a deleted-product snapshot.
- The safe `OrderItem` shape is:

```prisma
model OrderItem {
  id          String  @id @default(uuid())
  orderId     String
  menuItemId  String?
  productName String?
  quantity    Int
  price       Float

  order     Order    @relation(fields: [orderId], references: [id])
  menuItem  MenuItem? @relation(fields: [menuItemId], references: [id], onDelete: SetNull)
}
```

- Before migration, use `npx.cmd prisma migrate status`.
- If Prisma proposes unrelated destructive changes, stop and inspect schema drift instead of applying blindly.
- Prisma generation may fail on Windows if a running Next/Node process locks `query_engine-windows.dll.node`; stop only the relevant workspace processes, then rerun generation.

## Current Known Risks

- The repository has accumulated broad uncommitted changes across storefront, kiosk, POS, KDS, branch scheduling, recommendation, and schema files. Never revert unrelated user changes.
- The checked-in README is older than the current Next.js/feature set; trust `package.json`, source code, and Prisma schema over README claims.
- No comprehensive recommendation test suite was found. Use diagnostics, focused builds, API checks, and manual customer/dashboard flows.
- Production build validation can be affected by Windows terminal PATH issues; use `npm.cmd`.
- Existing migration history and schema can drift. Review generated migration SQL carefully.

## Editing Workflow For Agents

1. Read this file and inspect current git status.
2. Identify the narrow owning abstraction and one nearby discriminating check.
3. Read the exact current file contents before editing; user/formatter changes may exist.
4. Make the smallest focused patch with `apply_patch`.
5. Immediately run diagnostics or a focused test/build for the touched slice.
6. Keep changes compatible with existing APIs and saved data.
7. Before schema changes, inspect current migrations, database status, and generated SQL.
8. Never reset or checkout away user changes.
9. Do not commit unless explicitly requested.
10. Report what changed, what was verified, and any unresolved risk.

## UI Conventions

- Preserve existing Radix/Tailwind patterns and component APIs.
- Use existing `Button`, `Input`, `ScrollArea`, `AlertDialog`, `Select`, `Badge`, and image components.
- Use `lucide-react` icons in controls.
- Keep dashboard tools dense, scannable, and work-focused.
- Keep customer/kiosk flows touch-friendly and stable in dimensions.
- Kiosk category rail is fixed on desktop with an independently scrollable list; it must stop above the fixed cart footer.
- Do not introduce unrelated visual redesign while fixing data or behavior.

## Useful Validation Checklist

- `get_errors` on every changed TypeScript/Prisma file.
- `npx.cmd prisma validate` using the repository Prisma version when available.
- `npx.cmd prisma generate` after schema changes.
- `npx.cmd prisma migrate status` before/after migration work.
- `npm.cmd run build` for final integration validation.
- Manually test:
  - dashboard product selection and Classic/Advanced popup
  - Classic save and reload
  - Advanced category selection
  - category product scroll list
  - removed/free product behavior
  - customer recommendation sheet and cart total
  - online order, POS, and kiosk paths
  - variation min/max limits
  - branch-specific menu visibility and order scheduling
  - KDS display and scheduled order behavior
