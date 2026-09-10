# Menu Customization & Category Junction Guardrails

## 1. Always Query Both `items` and `itemLinks` for Menu Categories
- In this repository, products belong to categories via both direct foreign key (`MenuItem.categoryId`) and the many-to-many junction table `MenuItemCategory` (`itemLinks`).
- Any query selecting products for a `MenuCategory` or `linkedCategory` MUST select both:
  - `items`: direct items (`MenuItem.categoryId == MenuCategory.id`)
  - `itemLinks: { select: { menuItem: { select: ... } } }`: junction items
- Merged results must be deduplicated by item ID. Never assume `items` contains all products in a category.

## 2. Always Hydrate Product Detail Before Opening Customization
- Browse list queries (`menuItemBrowseListSelect`, `menuItemPosCatalogSelect`) only contain shallow stubs.
- Any channel opening `ProductCustomizeDialog` (POS, Kiosk, Online Storefront) must check `productNeedsDetailFetch(product)` and fetch full details via `fetchCustomerMenuProductDetail` (or `fetchRestaurantMenuProductDetail` in POS) if nested attribute groups or recommended products lack items.

## 3. Graceful Fallback for Variation-Priced Configuration Groups
- When `useVariationPricing` is enabled on an attribute group:
  - If `parentVariation` is null (base product has no variations or none selected yet), items must NOT be filtered out. They should be shown at their base price.
  - If the add-on items do not match parent variation tiers (e.g. static add-ons like sauces or drinks), they must remain available at their standard unit price rather than returning an empty list.
  - Groups with `sourceType === 'PRODUCT'` (recommended products) must never be hidden due to parent variation mismatch.
