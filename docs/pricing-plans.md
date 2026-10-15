# Foodluk Pricing Plans — Product Specification

> Source of truth for subscription tiers, module access, free limits, and premium (crown) UX.
> Last updated: 2026-10-13

---

## Table of contents

1. [Overview](#1-overview)
2. [Shared UX rules](#2-shared-ux-rules)
3. [Module matrix by plan](#3-module-matrix-by-plan)
4. [Free Plan](#4-free-plan)
5. [Basic Plan](#5-basic-plan)
6. [Growth Plan](#6-growth-plan)
7. [Scale Plan](#7-scale-plan)
8. [Pro Plan](#8-pro-plan)
9. [Custom Plan](#9-custom-plan)
10. [Limits cheat sheet](#10-limits-cheat-sheet)
11. [Checkout & purchase flows](#11-checkout--purchase-flows)
12. [Implementation notes](#12-implementation-notes)

---



## 1. Overview



### Plans


| Plan       | Intent                                                               |
| ---------- | -------------------------------------------------------------------- |
| **Free**   | Trial / starter restaurant — core catalog + POS with tight limits    |
| **Basic**  | Small venue — adds KDS, slightly higher catalog limits               |
| **Growth** | Growing venue — website + configuration + more catalog capacity      |
| **Scale**  | Multi-branch ops — inventory, layout, kiosk, order display unlocked  |
| **Pro**    | Full product (except soft caps on branches / users)                  |
| **Custom** | Checkbox-selected modules; sales-assisted purchase via request email |




### Access labels used in this doc


| Label                       | Meaning                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------ |
| **Free**                    | Included with no feature gate                                                        |
| **Free — Limited**          | Included but capped or partially locked; crown on gated actions                      |
| **Paid**                    | Not included; nav shows crown; page may open but content is blurred with Upgrade CTA |
| **Selection** (Custom only) | Optional add-on checkbox; unchecked = limited/locked, checked = full access          |




### Premium UX vocabulary

- **Crown icon** — indicates a paid or limit-exceeded feature.
- **Disabled + crown** — control not clickable; shows crown (e.g. Add category after limit).
- **Blurred + crown + Upgrade** — page or section visible but blurred; on hover show Upgrade button linking to the **pricing page**.
- **Hidden vs shown** — order-channel toggles that are *off* must **not** hide dashboard nav items; nav tabs stay visible (with crown if Paid).

---



## 2. Shared UX rules

1. **Upgrade link** — always points to the public pricing page (`/pricing` or equivalent).
2. **Nav visibility** — Paid modules still appear in the sidebar/nav with a crown. Clicking opens the module with blurred content + Upgrade CTA (unless noted otherwise for deep links like website/kiosk public URLs).
3. **Channel toggles off ≠ hide nav** — if Website / Kiosk / KDS / etc. are disabled in Settings → Order channels, dashboard navigation tabs remain visible (not removed from the menu).
4. **Create limits** — when the plan’s max count is reached, primary “Add …” buttons become disabled and show a crown.
5. **Public surfaces** — when Website or Kiosk Platform is Paid for that restaurant, public URLs (`/{slug}`, `/kiosk/...`) show a blurred upgrade gate (restaurant not usable for guests until upgraded).

---



## 3. Module matrix by plan

Legend: **F** = Free · **L** = Free Limited · **P** = Paid · **S** = Selection (Custom) · **✓** = full free access


| Module / area    | Free | Basic | Growth     | Scale      | Pro | Custom |
| ---------------- | ---- | ----- | ---------- | ---------- | --- | ------ |
| Dashboard        | L    | L     | L          | ✓*         | ✓   | ✓      |
| POS              | L    | L     | L          | ✓          | ✓   | ✓      |
| KDS              | P    | ✓     | ✓          | ✓          | ✓   | S      |
| Order Display    | P    | P     | P          | ✓          | ✓   | S      |
| Categories       | L    | L     | L          | L          | ✓   | ✓      |
| Variations       | L    | L     | L          | L          | ✓   | ✓      |
| Products         | L    | L     | L          | ✓          | ✓   | ✓      |
| Inventory        | P    | P     | P          | ✓          | ✓   | S      |
| Menu Layout      | P    | P     | P          | ✓          | ✓   | S      |
| Configuration    | P    | P     | ✓          | ✓          | ✓   | S      |
| Transactions     | L    | L     | L          | ✓          | ✓   | L†     |
| Expenses         | P    | L     | L          | ✓          | ✓   | S      |
| Reports          | L    | L     | L          | ✓          | ✓   | L†     |
| Basic Settings   | L    | L     | L          | ✓          | ✓   | L†     |
| Branches         | L    | L     | L          | L          | L   | L†     |
| Users & Roles    | P    | L     | L          | L          | L   | S      |
| Online Payments  | P    | P     | L (single) | L (single) | ✓   | S      |
| Terminal Payment | P    | P     | P          | P          | ✓   | S      |
| Website          | P    | P     | ✓          | ✓          | ✓   | S      |
| Kiosk Platform   | P    | P     | P          | ✓          | ✓   | S      |
| Mobile App       | P    | P     | P          | P          | ✓   | S      |


 Scale Dashboard is full for listed widgets; treat as free full access for dashboard analytics described in §7.  
† Custom: when checkbox **unchecked**, apply **Basic-plan limits** for that module; when **checked**, full access.

---



## 4. Free Plan



### 4.1 Module summary


| Module           | Access         |
| ---------------- | -------------- |
| Dashboard        | Free — Limited |
| POS              | Free — Limited |
| KDS              | Paid           |
| Order Display    | Paid           |
| Categories       | Free — Limited |
| Variations       | Free — Limited |
| Products         | Free — Limited |
| Inventory        | Paid           |
| Menu Layout      | Paid           |
| Configuration    | Paid           |
| Transactions     | Free — Limited |
| Expenses         | Paid           |
| Reports          | Free — Limited |
| Basic Settings   | Free — Limited |
| Branches         | Free — Limited |
| Users & Roles    | Paid           |
| Online Payments  | Paid           |
| Terminal Payment | Paid           |
| Website          | Paid           |
| Kiosk Platform   | Paid           |
| Mobile App       | Paid           |




### 4.2 Feature details



#### Dashboard (Free — Limited)

1. Date range: only **7 days** available. **14D** and **30D** are Paid — crown, disabled, not clickable.
2. **Website** and **Kiosk** shortcut buttons are Paid — crown, disabled, not clickable.
3. **Top selling items**, **Peak hours**, **Floor right now**, and **Payment mix** are blurred; on hover show crown + Upgrade → pricing page.



#### POS (Free — Limited)

1. Do **not** show Kiosk or KDS buttons (those platforms are not available on Free).
2. **Delivery** fulfillment method is not available and must not appear.



#### KDS (Paid)

1. Crown on KDS navigation item.
2. On open: page + data blurred; hover Upgrade → pricing.



#### Order Display (Paid)

1. Crown on Order Display navigation.
2. On open: blurred + Upgrade → pricing.



#### Categories (Free — Limited)

1. Max **5** categories.
2. After 5: Add category disabled + crown.



#### Variations (Free — Limited)

1. Max **3** variations.
2. After 3: Add variation disabled + crown.



#### Products (Free — Limited)

1. Max **15** products.
2. After 15: Add product disabled + crown.



#### Inventory (Paid)

1. Crown on Inventory nav.
2. On open: blurred + Upgrade → pricing.



#### Menu Layout (Paid)

1. Crown on Menu Layout nav.
2. On open: blurred + Upgrade → pricing.



#### Configuration (Paid)

1. Crown on Configuration nav.
2. On open: blurred + Upgrade → pricing.



#### Transactions (Free — Limited)

1. Show **order** transactions only.
2. Do **not** show inventory transactions.



#### Expenses (Paid)

1. Crown on Expenses nav.
2. On open: blurred + Upgrade → pricing.



#### Reports (Free — Limited)

1. Custom date-range fields + Apply are **disabled** + crown. **Week** and **Month** preset buttons work.
2. Channel filters **Website**, **POS**, **Kiosk** disabled + crown.
3. **Inventory** reports tab: crown; content blurred with **dummy** data when opened.
4. **Expenses** reports tab: crown; content blurred with **dummy** data when opened.
5. Financial overview: **Expenses**, **Inventory**, **Card payments**, **Other payments** cards blurred + crown on hover / Upgrade.



#### Basic Settings (Free — Limited)

1. Public URLs — Website and Kiosk fields/buttons disabled, blurred + crown.
2. Language switch works.
3. Order channels — all channel toggles **off**, disabled + crown.
4. Nav tabs for those modules still **shown** (not hidden) when channels are off.
5. Branding — only **website logo** editable; banners disabled + crown.



#### Branches (Free — Limited)

1. Max **1** branch.
2. After 1: Add branch disabled + crown.



#### Users & Roles (Paid)

1. Crown on Users & Roles nav.
2. On open: blurred + Upgrade → pricing.



#### Payment Methods / Online Payments (Paid)

1. Table / dine-in payments section disabled, blurred + Upgrade.
2. Currency & country work.
3. Service charges work.
4. Stripe (website payments) section disabled, blurred + Upgrade.



#### Terminal Payment (Paid)

1. Terminal Payment controls and **Save terminal IP** disabled + crown.



#### Website (Paid)

1. All website-related dashboard nav buttons/links disabled (or crowned as paid).
2. Public `domain/{slug}` — restaurant not usable; blurred view + Upgrade.



#### Kiosk Platform (Paid)

1. All kiosk-related dashboard nav buttons/links disabled / crowned.
2. Public `domain/kiosk/{branchId}` — not usable; blurred + Upgrade.

---



## 5. Basic Plan



### 5.1 Module summary


| Module           | Access         |
| ---------------- | -------------- |
| Dashboard        | Free — Limited |
| POS              | Free — Limited |
| KDS              | Free (full)    |
| Order Display    | Paid           |
| Categories       | Free — Limited |
| Variations       | Free — Limited |
| Products         | Free — Limited |
| Inventory        | Paid           |
| Menu Layout      | Paid           |
| Configuration    | Paid           |
| Transactions     | Free — Limited |
| Expenses         | Free — Limited |
| Reports          | Free — Limited |
| Basic Settings   | Free — Limited |
| Branches         | Free — Limited |
| Users & Roles    | Free — Limited |
| Online Payments  | Paid           |
| Terminal Payment | Paid           |
| Website          | Paid           |
| Kiosk Platform   | Paid           |
| Mobile App       | Paid           |




### 5.2 Feature details



#### Dashboard (Free — Limited)

1. **7D**, **14D**, and **30D** all available.
2. Website and Kiosk buttons Paid — crown, disabled.
3. Top selling, Peak hours, Floor right now, Payment mix blurred + Upgrade.



#### POS (Free — Limited)

1. **Kiosk** button is shown (UI affordance; kiosk platform still Paid — follow nav/public rules).
2. Delivery method still **not** available / not shown.



#### KDS (Free)

1. KDS nav and data fully accessible — no limitation.



#### Order Display (Paid)

1. Crown on nav; blurred page + Upgrade.



#### Categories (Free — Limited)

1. Max **15** categories; then Add disabled + crown.



#### Variations (Free — Limited)

1. Max **5** variations; then Add disabled + crown.



#### Products (Free — Limited)

1. Max **35** products; then Add disabled + crown.



#### Inventory / Menu Layout / Configuration (Paid)

1. Crown on nav; blurred + Upgrade.



#### Transactions (Free — Limited)

1. Orders only — no inventory transactions.



#### Expenses (Free — Limited)

1. **Manual expenses only** (no inventory-driven expense depth beyond that scope).



#### Reports (Free — Limited)

1. Date range fields + Apply **work**.
2. Website / POS / Kiosk filter buttons disabled + crown.
3. Inventory reports tab: crown + blurred dummy data.
4. Expenses reports: show **manual** expense data only (not inventory).
5. Financial overview: **Inventory**, **Card payments**, **Other payments** blurred + crown (Expenses card may reflect manual data per product rules above).



#### Basic Settings (Free — Limited)

1. Public URLs Website + Kiosk disabled / blurred + crown.
2. Language switch works.
3. Order channels: toggles off + disabled + crown **except** dine-in, delivery, and **KDS** (those work).
4. Nav tabs remain visible when channels are off.
5. Logo editable; banners disabled + crown.



#### Branches (Free — Limited)

1. Max **1** branch; then Add disabled + crown.



#### Users & Roles (Free — Limited)

1. Max **1** user and **1** custom role **per branch** (Owner/Admin presets do not consume the role cap).
2. After limit: Add buttons show crown (disabled). API create blocked.



#### Payment Methods (Paid)

1. Table / dine-in payments locked (blur + Upgrade).
2. Currency & country work.
3. Service charges work.
4. Stripe website payments locked (blur + Upgrade).



#### Terminal Payment (Paid)

1. Controls + Save terminal IP disabled + crown.



#### Website / Kiosk Platform (Paid)

1. Same public + nav gating as Free Plan.

---



## 6. Growth Plan



### 6.1 Module summary


| Module           | Access                         |
| ---------------- | ------------------------------ |
| Dashboard        | Free — Limited                 |
| POS              | Free — Limited                 |
| KDS              | Free                           |
| Order Display    | Paid                           |
| Categories       | Free — Limited                 |
| Variations       | Free — Limited                 |
| Products         | Free — Limited                 |
| Inventory        | Paid                           |
| Menu Layout      | Paid                           |
| Configuration    | Free (full)                    |
| Transactions     | Free — Limited                 |
| Expenses         | Free — Limited                 |
| Reports          | Free — Limited                 |
| Basic Settings   | Free — Limited                 |
| Branches         | Free — Limited                 |
| Users & Roles    | Free — Limited                 |
| Online Payments  | Free — Limited (single method) |
| Terminal Payment | Paid                           |
| Website          | Free (full)                    |
| Kiosk Platform   | Paid                           |
| Mobile App       | Paid                           |




### 6.2 Feature details



#### Dashboard (Free — Limited)

1. 7D / 14D / 30D available.
2. **Kiosk** button Paid — crown, disabled.
3. **Website** button works; website accessible.
4. Floor right now + Payment mix blurred + Upgrade.
5. Top selling items + Peak hours show real data.



#### POS (Free — Limited)

1. Kiosk button **not** shown (kiosk platform not available).
2. KDS button works with full KDS data.
3. **Delivery** method available and working.



#### KDS (Free)

1. Full access.



#### Order Display (Paid)

1. Crown + blurred Upgrade gate.



#### Categories (Free — Limited)

1. Max **30** categories.



#### Variations (Free — Limited)

1. Max **7** variations.



#### Products (Free — Limited)

1. Max **100** products (after 100, Add disabled + crown).
  *(Product brief: “99+” / “After 100 products”.)*



#### Inventory / Menu Layout (Paid)

1. Crown + blurred Upgrade.



#### Configuration (Free)

1. Full access — all actions allowed.



#### Transactions (Free — Limited)

1. Orders only — no inventory transactions.



#### Expenses (Free — Limited)

1. Manual expenses only.



#### Reports (Free — Limited)

1. Date range + Apply work.
2. Website / POS / Kiosk filters disabled + crown.
3. Inventory reports: crown + blurred dummy data.
4. Expenses reports: manual expenses data (not inventory).
5. Financial overview: Inventory, Card payments, Other payments blurred + crown.



#### Basic Settings (Free — Limited)

1. Public URLs: **Kiosk** disabled / blurred + crown; **Website** works and accessible.
2. Language switch works.
3. Order channels: disabled + crown except **dine-in**, **delivery**, **KDS**; also **Website** and **Order Display** toggles work.
4. Nav remains visible when channels off.
5. Logo + **main banner** editable; **menu banners** upload limited to **3**.



#### Branches (Free — Limited)

1. Max **2** branches.



#### Users & Roles (Free — Limited)

1. Max **3** users and **3** custom roles **per branch** (e.g. 2 branches → up to 6 users and 6 roles). Owner/Admin presets do not consume the role cap.
2. After limit: Add buttons disabled + crown; API create blocked.



#### Payment Methods (Free — Limited / Paid mix)

1. Table / dine-in payments **work**.
2. Currency & country work.
3. Service charges work; **kiosk service charges** disabled + crown.
4. Stripe / website payments: only **one** payment method may be configured; once one is set, other methods disabled + crown.



#### Terminal Payment (Paid)

1. Disabled + crown.



#### Website (Free)

1. Website accessible and working.



#### Kiosk Platform (Paid)

1. Nav/links gated; public kiosk URL blurred + Upgrade.

---



## 7. Scale Plan



### 7.1 Module summary


| Module           | Access                          |
| ---------------- | ------------------------------- |
| Dashboard        | Free (full for listed features) |
| POS              | Free                            |
| KDS              | Free                            |
| Order Display    | Free                            |
| Categories       | Free — Limited                  |
| Variations       | Free — Limited                  |
| Products         | Free (unlimited)                |
| Inventory        | Free                            |
| Menu Layout      | Free                            |
| Configuration    | Free                            |
| Transactions     | Free                            |
| Expenses         | Free                            |
| Reports          | Free                            |
| Basic Settings   | Free                            |
| Branches         | Free — Limited                  |
| Users & Roles    | Free — Limited                  |
| Online Payments  | Free — Limited (single method)  |
| Terminal Payment | Paid                            |
| Website          | Free                            |
| Kiosk Platform   | Free                            |
| Mobile App       | Paid                            |




### 7.2 Feature details



#### Dashboard (Free)

1. 7D / 14D / 30D.
2. Website and Kiosk buttons work; both surfaces accessible.
3. Floor right now + Payment mix — full data.
4. Top selling + Peak hours — full data.



#### POS (Free)

1. Kiosk button shown (kiosk available).
2. KDS button + data full.
3. Delivery method available and working.



#### KDS / Order Display / Inventory / Menu Layout / Configuration (Free)

1. Full nav + actions + data.



#### Categories (Free — Limited)

1. Max **60** categories.



#### Variations (Free — Limited)

1. Max **10** variations.



#### Products (Free)

1. **Unlimited** products.



#### Transactions / Expenses (Free)

1. Full access — all transaction types and expense actions.



#### Reports (Free)

1. Date range + Apply work.
2. Website / POS / Kiosk filters work.
3. Inventory + Expenses report tabs full data.
4. Financial overview cards (Inventory, Card payments, Other payments) full.



#### Basic Settings (Free)

1. Public URLs Website + Kiosk work.
2. Language switch works.
3. Order channels: all work **except card payment** related toggles (not in Scale) — those disabled + crown.
4. Nav remains visible when channels off.
5. Logo and **all banners** editable.



#### Branches (Free — Limited)

1. Max **5** branches.



#### Users & Roles (Free — Limited)

1. Max **5** users and **5** custom roles **per branch** (e.g. 5 branches → up to 25 users and 25 roles). Owner/Admin presets do not consume the role cap.
2. After limit: Add buttons disabled + crown; API create blocked.



#### Payment Methods (Free — Limited)

1. Table / dine-in payments work.
2. Currency & country work.
3. Service charges work.
4. Website payments: only **one** method; others disabled + crown after first is configured.



#### Terminal Payment (Paid)

1. Disabled + crown.



#### Website / Kiosk (Free)

1. Both accessible and working.



#### Mobile App (Paid)

1. Not included.

---



## 8. Pro Plan



### 8.1 Module summary


| Module           | Access           |
| ---------------- | ---------------- |
| Dashboard        | Free (full)      |
| POS              | Free (full)      |
| KDS              | Free (full)      |
| Order Display    | Free (full)      |
| Categories       | Free (unlimited) |
| Variations       | Free (unlimited) |
| Products         | Free (unlimited) |
| Inventory        | Free (full)      |
| Menu Layout      | Free (full)      |
| Configuration    | Free (full)      |
| Transactions     | Free (full)      |
| Expenses         | Free (full)      |
| Reports          | Free (full)      |
| Basic Settings   | Free (full)      |
| Branches         | Free — Limited   |
| Users & Roles    | Free — Limited   |
| Online Payments  | Free (full)      |
| Terminal Payment | Free (full)      |
| Website          | Free (full)      |
| Kiosk Platform   | Free (full)      |
| Mobile App       | Free (full)      |




### 8.2 Feature details



#### Soft limits only


| Resource | Max                          |
| -------- | ---------------------------- |
| Branches | **10**                       |
| Users    | **10 per branch** (× branches) |
| Roles    | **10 custom roles per branch** (× branches; Owner/Admin excluded) |


After limits: Add buttons disabled + crown; API create blocked.

#### Everything else

- Full dashboard analytics and actions.
- Full POS (Kiosk + KDS buttons, delivery, all sections).
- Full KDS, Order Display, catalog (unlimited categories / variations / products), inventory, layout, configuration.
- Full transactions, expenses, reports (all filters and tabs).
- Basic settings: public URLs, all order channels, all banners.
- Payment methods: dine-in, currency, service charges, Stripe/website — all full.
- Terminal Payment + Save terminal IP — full.
- Website, Kiosk, Mobile App — full access.

---



## 9. Custom Plan



### 9.1 Concept

Custom is a **configurator**, not a fixed feature set:

1. Pricing UI shows **checkboxes** for selectable modules.
2. Modules marked **Selection** get full access when checked.
3. Modules marked **Free — Limited** use **Basic Plan limits** when unchecked; when checked, upgrade to **full** access for that module.
4. Purchase flow differs from other plans (see §11).



### 9.2 Default / base row (before selections)


| Module           | Default when unchecked                                                  |
| ---------------- | ----------------------------------------------------------------------- |
| Dashboard        | Free                                                                    |
| POS              | Free                                                                    |
| KDS              | Selection → locked/paid-style until checked                             |
| Order Display    | Selection                                                               |
| Categories       | Free                                                                    |
| Variations       | Free                                                                    |
| Products         | Free                                                                    |
| Inventory        | Selection                                                               |
| Menu Layout      | Selection                                                               |
| Configuration    | Selection                                                               |
| Transactions     | Free — Limited (Basic-style: orders only)                               |
| Expenses         | Selection                                                               |
| Reports          | Free — Limited (Basic-style limits)                                     |
| Basic Settings   | Free — Limited (Basic-style)                                            |
| Branches         | Free — Limited (Basic-style: 1 branch unless raised by selection rules) |
| Users & Roles    | Selection                                                               |
| Online Payments  | Selection                                                               |
| Terminal Payment | Selection                                                               |
| Website          | Selection                                                               |
| Kiosk Platform   | Selection                                                               |
| Mobile App       | Selection                                                               |


**Rule:** For any module labeled Free — Limited on Custom, apply **Basic Plan** limitation behavior until the customer checks the module for full access (where applicable). Selection modules behave like Paid until checked.

### 9.3 Selectable modules (checkboxes)

At minimum expose checkboxes for:

- KDS  
- Order Display  
- Inventory  
- Menu Layout  
- Configuration  
- Expenses  
- Users & Roles  
- Online Payments  
- Terminal Payment  
- Website  
- Kiosk Platform  
- Mobile App

(Plus any Free — Limited modules you choose to offer as “unlock full” checkboxes: Transactions, Reports, Basic Settings, Branches, etc.)

---



## 10. Limits cheat sheet



### Catalog & org limits


| Limit                  | Free            | Basic     | Growth                          | Scale       | Pro         |
| ---------------------- | --------------- | --------- | ------------------------------- | ----------- | ----------- |
| Categories             | 5               | 15        | 30                              | 60          | Unlimited   |
| Variations             | 3               | 5         | 7                               | 10          | Unlimited   |
| Products               | 15              | 35        | 100                             | Unlimited   | Unlimited   |
| Branches               | 1               | 1         | 2                               | 5           | 10          |
| Users (per branch)     | — (Paid module) | 1         | 3                               | 5           | 10          |
| Roles (per branch)     | — (Paid module) | 1         | 3                               | 5           | 10          |
| Menu banners           | Logo only       | Logo only | Logo + main; **3** menu banners | All banners | All banners |
| Online payment methods | 0 (Paid)        | 0 (Paid)  | 1                               | 1           | Unlimited   |




### Dashboard range & widgets (summary)


| Capability               | Free    | Basic | Growth | Scale+ |
| ------------------------ | ------- | ----- | ------ | ------ |
| 7D                       | ✓       | ✓     | ✓      | ✓      |
| 14D / 30D                | ✗ crown | ✓     | ✓      | ✓      |
| Website button           | ✗       | ✗     | ✓      | ✓      |
| Kiosk button             | ✗       | ✗     | ✗      | ✓      |
| Top selling / Peak hours | blur    | blur  | ✓      | ✓      |
| Floor / Payment mix      | blur    | blur  | blur   | ✓      |


---



## 11. Checkout & purchase flows



### Standard plans (Free → Pro)

1. User selects plan on pricing page.
2. Continues to price / checkout / buy (existing SaaS payment path).



### Custom plan

1. User selects **Custom** and toggles module checkboxes.
2. Redirect to pricing page (or Custom section) where the primary CTA is **not** “Buy” but **Request to buy**.
3. Form collects at least:
  - Email  
  - Restaurant name (and any existing restaurant context)
4. Submit sends email to **platform admin**, same pattern as **demo request**.
5. Admin follows up offline / creates bespoke offer.

---



## 12. Implementation notes



### Entitlement model (recommended)

Represent each restaurant subscription as:

```ts
type PlanId = 'free' | 'basic' | 'growth' | 'scale' | 'pro' | 'custom';

type ModuleKey =
  | 'dashboard' | 'pos' | 'kds' | 'orderDisplay'
  | 'categories' | 'variations' | 'products'
  | 'inventory' | 'menuLayout' | 'configuration'
  | 'transactions' | 'expenses' | 'reports'
  | 'basicSettings' | 'branches' | 'usersRoles'
  | 'onlinePayments' | 'terminalPayment'
  | 'website' | 'kiosk' | 'mobileApp';

type ModuleEntitlement =
  | { access: 'full' }
  | { access: 'limited'; limits: Record<string, number | boolean> }
  | { access: 'paid' }; // crown + blur gate
```

Custom plan stores `selectedModules: ModuleKey[]` and merges with Basic-limited defaults for unchecked limited modules.

### UI components to reuse

- Crown badge on nav items and disabled buttons.
- `PremiumGate` overlay: blur + Upgrade → `/pricing`.
- Limit helper: `canCreate(module, count)` → disable Add + crown.
- Public Website/Kiosk gate for storefront and kiosk routes.



### Nav rule reminder

Turning order-channel switches **off** must **not** remove sidebar entries. Paid/limited modules stay visible with crown.

### Clarifications captured from the brief


| Topic                                                            | Interpretation in this doc                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------- |
| Free Branches “Only 1 products create maximum”                   | Treated as **1 branch**                                    |
| Growth “99+” / “After 100 products”                              | Cap = **100**                                              |
| Basic Users “2 Users and banners”                                | Treated as **1 user + 1 custom role per branch** (Owner/Admin excluded from role cap) |
| Scale Dashboard “Free — Limited” heading vs full feature list    | Treated as **full** for listed dashboard features          |
| Pro Payment/Terminal/Website/Kiosk labeled “Paid” in one section | Treated as **included (Free/full)** per Pro module summary |
| Custom limited modules                                           | Use **Basic** limits when unchecked                        |


---



## Appendix A — Paid module blur destinations

Whenever access is **Paid** (or Selection unchecked on Custom):


| Surface            | Behavior                                 |
| ------------------ | ---------------------------------------- |
| Dashboard nav item | Crown icon                               |
| In-app page        | Content blurred; hover Upgrade → pricing |
| Public website     | Blurred upgrade wall                     |
| Public kiosk       | Blurred upgrade wall                     |


---



## Appendix B — Plan comparison one-liner


| Plan   | One-liner                                                                                 |
| ------ | ----------------------------------------------------------------------------------------- |
| Free   | POS + tiny catalog; almost everything else crowned                                        |
| Basic  | Adds KDS + manual expenses + small team (1 user / 1 role per branch)                      |
| Growth | Adds website + configuration + single online payment                                      |
| Scale  | Ops complete (inventory, layout, kiosk, order display); terminals & multi-PSP still gated |
| Pro    | Full product; soft caps on branches (10) and users/roles (10 per branch)                  |
| Custom | Pick modules; request-to-buy email to admin                                               |


---

*End of document.*