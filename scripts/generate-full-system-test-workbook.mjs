/**
 * Full-system manual test workbook: modules, functionality, RBAC,
 * security, API, UI, and end-to-end. Same Result / Approved / Rejected
 * columns as Foodluk-Whitebox-Test-Cases.xlsx.
 */
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHECK_EMPTY = '☐';
const CHECK_TICKED = '☑';

const HEADERS = [
  'ID',
  'Area',
  'Title',
  'Actor',
  'Preconditions',
  'Steps',
  'Expected',
  'White-box / API',
  'Result',
  'Approved',
  'Rejected',
  'Notes',
  'Tester',
  'Tested on',
];

const COL_WIDTHS = [16, 18, 44, 18, 34, 42, 46, 40, 12, 12, 12, 28, 14, 14];

/** @typedef {[string, string, string, string, string, string, string, string]} CaseRow */

const headerFill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF111827' },
};
const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 };
const wrapAlign = { wrapText: true, vertical: 'top' };

const DASHBOARD_MODULES = [
  { key: 'dashboard', title: 'Dashboard', path: '/dashboard', mutate: false },
  { key: 'sales', title: 'Sales', path: '/sales', mutate: false },
  { key: 'pos', title: 'POS', path: '/pos', mutate: true },
  { key: 'kds', title: 'KDS', path: '/kds', mutate: true, extraPath: '/kds-screen' },
  { key: 'order-display', title: 'Order Display', path: '/order-display', mutate: false },
  { key: 'branched', title: 'Branched', path: '/branched', mutate: true },
  { key: 'tables', title: 'Tables', path: '/tables', mutate: true },
  { key: 'categories', title: 'Categories', path: '/categories', mutate: true },
  { key: 'variations', title: 'Variations', path: '/variations', mutate: true },
  { key: 'product', title: 'Products', path: '/product', mutate: true },
  { key: 'inventory', title: 'Inventory', path: '/inventory', mutate: true },
  { key: 'recommendations', title: 'Configurations', path: '/configurations', mutate: true, plan: 'GROWTH' },
  { key: 'records', title: 'Transactions', path: '/records', mutate: false },
  { key: 'settings', title: 'Settings', path: '/settings', mutate: true },
];

function c(id, area, title, actor, pre, steps, expected, wb) {
  return /** @type {CaseRow} */ ([id, area, title, actor, pre, steps, expected, wb]);
}

function buildModules() {
  /** @type {CaseRow[]} */
  const rows = [];
  for (const m of DASHBOARD_MODULES) {
    const a = m.title;
    rows.push(
      c(`MOD-${m.key}-01`, a, `${m.title} page loads`, 'Owner', `${m.key}:access; GROWTH if needed`, `Open ${m.path}`, 'Page renders; no crash; main content visible', m.path),
      c(`MOD-${m.key}-02`, a, `${m.title} in sidebar`, 'Owner', 'Logged in', 'View dashboard sidebar', `${m.title} link shown and active on ${m.path}`, 'navItemsForPermissions'),
      c(`MOD-${m.key}-03`, a, `${m.title} blocked without permission`, 'Limited employee', `No ${m.key}:* tokens`, `Open ${m.path} directly`, m.key === 'dashboard' ? 'Dashboard exception: not redirected (confirm widgets)' : 'Redirect /no-access', 'layout allowedModuleKeys'),
      c(`MOD-${m.key}-04`, a, `${m.title} hidden in nav without permission`, 'Limited employee', `No ${m.key}:*`, 'View sidebar', `${m.title} not listed`, 'canAccessDashboardModule'),
    );
    if (m.mutate) {
      rows.push(
        c(`MOD-${m.key}-05`, a, `${m.title} access-only cannot mutate`, 'Viewer', `${m.key}:access only`, `Open ${m.path}; try create/save/delete`, 'Reads OK; writes 403 Access Blocked', `${m.key}:edit / ${m.key}:delete`),
        c(`MOD-${m.key}-06`, a, `${m.title} edit works`, 'Editor', `${m.key}:edit`, `Create or update on ${m.path}`, 'Save succeeds; data persists after refresh', `${m.key}:edit`),
        c(`MOD-${m.key}-07`, a, `${m.title} delete works`, 'Manager', `${m.key}:delete`, `Delete a record on ${m.path}`, 'Deleted or blocked with a clear reason if in use', `${m.key}:delete`),
      );
    }
    if (m.extraPath) {
      rows.push(c(`MOD-${m.key}-08`, a, `${m.title} extra screen loads`, 'Kitchen', `${m.key}:access`, `Open ${m.extraPath}`, 'Kitchen screen loads', m.extraPath));
    }
    if (m.plan === 'GROWTH') {
      rows.push(c(`MOD-${m.key}-09`, a, `${m.title} gated on STARTER`, 'STARTER owner', 'STARTER plan', `Open ${m.path}`, 'Hidden or plan-denied', 'plan.recommendations'));
    }
  }
  rows.push(
    c('MOD-ANALYTICS-01', 'Analytics', 'Analytics hub loads', 'GROWTH owner', 'advancedAnalytics', 'Open /analytics', 'Hub loads', '/analytics'),
    c('MOD-ANALYTICS-02', 'Analytics', 'Income analytics', 'GROWTH owner', 'advancedAnalytics', 'Open /analytics/income', 'Charts load', '/analytics/income'),
    c('MOD-ANALYTICS-03', 'Analytics', 'Product sales analytics', 'GROWTH owner', 'advancedAnalytics', 'Open /analytics/product/sales', 'Sales table/chart', '/analytics/product/sales'),
    c('MOD-ANALYTICS-04', 'Analytics', 'Favorites analytics', 'GROWTH owner', 'advancedAnalytics', 'Open /analytics/product/favorites', 'Favorites list', '/analytics/product/favorites'),
    c('MOD-ANALYTICS-05', 'Analytics', 'STARTER cannot use advanced analytics', 'STARTER owner', 'STARTER', 'Open /analytics/income', 'Gated / upgrade prompt', 'advancedAnalytics false'),
    c('MOD-ADMIN-01', 'Admin', 'Admin dashboard module', 'Platform admin', 'ADMIN_EMAIL', 'Open /admin/dashboard', 'Platform metrics', '/admin/dashboard'),
    c('MOD-ADMIN-02', 'Admin', 'Restaurants module', 'Platform admin', '—', 'Open /admin/restaurants', 'Tenant list', '/admin/restaurants'),
    c('MOD-ADMIN-03', 'Admin', 'Subscriptions module', 'Platform admin', '—', 'Open /admin/subscriptions', 'Plans and billing', '/admin/subscriptions'),
    c('MOD-STORE-01', 'Storefront', 'Customer storefront module', 'Guest', 'Restaurant slug', 'Open /{slug}', 'Menu storefront', 'customer menu'),
    c('MOD-KIOSK-01', 'Kiosk', 'Kiosk module', 'Guest', 'slug + branch', 'Open /kiosk/{slug}/{branchId}', 'Kiosk menu', 'kiosk pages'),
    c('MOD-MKT-01', 'Marketing', 'Public SaaS marketing', 'Guest', '—', 'Open / pricing blog docs', 'Public pages load', '(saas) routes'),
  );
  return rows;
}

function buildFunctionality() {
  return [
    c('FN-AUTH-01', 'Auth', 'Email login success', 'Staff', 'Password ≥ 8', 'Login', 'Session + dashboard', 'POST credentials NextAuth'),
    c('FN-AUTH-02', 'Auth', 'Register owner then onboard 1–3', 'New owner', '—', 'Register OWNER; steps 1–3', 'Restaurant + trial + dashboard', '/api/onboarding/step1-3'),
    c('FN-AUTH-03', 'Auth', 'Duplicate slug rejected', 'Pending owner', 'Taken slug', 'Step 1', 'Unique error', 'Restaurant.slug'),
    c('FN-AUTH-04', 'Auth', 'Google signup role picker', 'Google UNKNOW', '—', '/role OWNER or WORKER', 'Role saved', 'POST /api/auth/role'),
    c('FN-AUTH-05', 'Auth', 'Reset password flow', 'Staff', '—', 'Request + confirm', 'Can login with new password; expired token fails', '/api/auth/reset'),
    c('FN-SUB-01', 'Subscription', 'Trial allows dashboard', 'Owner', 'TRIAL future', 'Open dashboard', 'Allowed; warning ≤3 days', 'evaluateSubscriptionAccess'),
    c('FN-SUB-02', 'Subscription', 'Expired trial blocks', 'Owner', 'trial ended', 'Open dashboard', 'Redirect /pricing', 'trial_expired'),
    c('FN-SUB-03', 'Subscription', 'STARTER 1 branch cap', 'STARTER', '1 branch', 'Add second', '403', 'maxBranches 1'),
    c('FN-SUB-04', 'Subscription', 'GROWTH 5 branch cap', 'GROWTH', '5 branches', 'Add sixth', '403', 'maxBranches 5'),
    c('FN-SUB-05', 'Subscription', 'SCALE unlimited branches', 'SCALE', '—', 'Add many', 'OK', 'Infinity'),
    c('FN-SUB-06', 'Subscription', 'STARTER branding denied', 'STARTER', '—', 'Save logo/theme', '403', 'branding false'),
    c('FN-SUB-07', 'Subscription', 'Auto-renew on/off', 'Owner', 'PayPal billing', 'Toggle auto-renew', 'Message + period behavior', 'PATCH billing/auto-renew'),
    c('FN-DASH-01', 'Dashboard', 'Revenue ignores pending/canceled payments', 'Owner', 'Mixed payments', 'View metrics', 'Only completed payments count', 'orderCountsTowardRevenue'),
    c('FN-DASH-02', 'Dashboard', 'Canceled orders excluded from charts', 'Owner', 'Canceled orders', 'View charts', 'Excluded', 'analyticsActiveOrderStatusWhere'),
    c('FN-DASH-03', 'Dashboard', 'Branch filter changes numbers', 'Owner', '2 branches', 'Switch branch', 'Metrics match branch', 'active-branch cookie'),
    c('FN-SALE-01', 'Sales', 'Filter POS / ONLINE / KIOSK', 'Staff', 'sales:access', 'Change source filter', 'List matches sourceType', 'GET sales-orders'),
    c('FN-SALE-02', 'Sales', 'Status buckets', 'Staff', 'Mixed statuses', 'View pending/completed/canceled', 'cancelled=canceled; pedding=pending', 'salesOrderStatusBucket'),
    c('FN-SALE-03', 'Sales', 'Daily ticket unique per branch', 'Cashier', 'Two orders same day', 'Place two POS orders', 'ticketNumber unique', '@@unique ticket'),
    c('FN-SALE-04', 'Sales', 'Short order id 6 chars', 'Staff', '—', 'Search shortOrderId', 'Found', 'shortOrderId'),
    c('FN-POS-01', 'POS', 'Open and close shift', 'Cashier', 'pos', 'Start; close with locker cash', 'OPEN then CLOSED + closingCashInLocker', 'POST pos-shift'),
    c('FN-POS-02', 'POS', 'Walk-up cash sale', 'Cashier', 'Shift open', 'Add items; cash pay', 'Order POS completed + kitchen ticket', 'POST pos-order'),
    c('FN-POS-03', 'POS', 'Delivery requires phone+address', 'Cashier', 'Delivery mode', 'Checkout empty fields', 'Toast; no order', 'pos-screen validation'),
    c('FN-POS-04', 'POS', 'Takeaway has no table', 'Cashier', '—', 'Takeaway pay', 'diningTableId null', 'OrderMode takeaway'),
    c('FN-POS-05', 'POS', 'Table: open send pay', 'Cashier', 'Table exists', 'Open table; send kitchen; pay', 'Pending then completed; table free', 'table-orders open/send/pay'),
    c('FN-POS-06', 'POS', 'Add courses to open table', 'Cashier', 'Pending table', 'Send kitchen again', 'Same order extra tickets', 'pending table-open-orders'),
    c('FN-POS-07', 'POS', 'Cancel open table', 'Cashier', 'Open table', 'Cancel', 'Canceled; not on KDS', 'table-orders/cancel'),
    c('FN-POS-08', 'POS', 'Variations + add-ons priced', 'Cashier', 'Configured product', 'Add to cart', 'Modifiers with unitPrice', 'OrderItemModifier'),
    c('FN-POS-09', 'POS', 'Personalize has zero price', 'Cashier', 'Personalize group', 'Select options', 'Named modifiers unitPrice 0', 'MenuItemPersonalizeGroup'),
    c('FN-POS-10', 'POS', 'Sale price used in cart', 'Cashier', 'salePrice set', 'Add item', 'Uses salePrice', 'MenuItem.salePrice'),
    c('FN-POS-11', 'POS', 'Tax discount service charge math', 'Cashier', 'All enabled', 'Checkout', 'total = items - discount + tax + serviceCharge', 'Order fields'),
    c('FN-POS-12', 'POS', 'POS service charge channel-only', 'Cashier', 'POS charge on; kiosk off', 'POS vs kiosk checkout', 'Charge only on POS', 'posServiceChargeEnabled'),
    c('FN-POS-13', 'POS', 'Cannot cancel completed order', 'Cashier', 'Completed', 'Cancel', 'Rejected', 'cancel guard'),
    c('FN-POS-14', 'POS', 'Idempotency prevents duplicate', 'Cashier', 'Same key twice', 'Retry checkout', 'One order', 'idempotencyKey unique'),
    c('FN-POS-15', 'POS', 'Recipe deducts stock', 'Cashier', 'Ingredients on product', 'Complete sale', 'IngredientStockEntry source ORDER', 'inventory ORDER'),
    c('FN-POS-16', 'POS', 'Check stock before sale', 'Cashier', 'Low stock', 'POST check-stock', 'Warning or block per rules', 'POST pos-order/check-stock'),
    c('FN-POS-17', 'POS', 'Offline retry no duplicate', 'Cashier', 'Kill network', 'Place; restore', 'Outbox flush once', 'local tickets'),
    c('FN-POS-18', 'POS', 'Card terminal payment', 'Cashier', 'paymentTerminalIp', 'Card pay', 'terminal-payment succeeds or clear error', 'POST .../terminal-payment'),
    c('FN-KDS-01', 'KDS', 'New ticket status making', 'Kitchen', 'Order sent', 'Open /kds', 'Ticket making', 'GET kds/tickets'),
    c('FN-KDS-02', 'KDS', 'Timer + complete', 'Kitchen', 'Ticket open', 'Set minutes; complete', 'Completed; order display ready', 'PATCH tickets/[id]'),
    c('FN-KDS-03', 'KDS', 'Cancel ticket', 'Kitchen', '—', 'Cancel', 'Canceled', 'PATCH'),
    c('FN-KDS-04', 'KDS', 'Manager complete order', 'Manager', 'kds', 'PATCH manager order', 'Status updates; second complete rejected', 'manager-orders/[id]'),
    c('FN-KDS-05', 'KDS', 'Realtime appears without refresh', 'Kitchen+POS', 'SSE', 'Place POS order', 'Ticket appears live', '/api/restaurant/realtime/stream'),
    c('FN-OD-01', 'Order display', 'Preparing vs ready columns', 'Staff', 'order-display', 'Open screen', 'Columns match ticket status', 'GET order-display'),
    c('FN-KSK-01', 'Kiosk', 'Dine-in requires table', 'Guest', '—', 'Submit dine_in no table', '400 Table is required', 'POST /api/kiosk/orders'),
    c('FN-KSK-02', 'Kiosk', 'Dine-in with table snapshot', 'Guest', 'Table exists', 'Order dine_in', 'Address includes table name', 'kioskDineInCustomerDisplayName'),
    c('FN-KSK-03', 'Kiosk', 'Take-away no table', 'Guest', '—', 'take_away', 'Order created', 'fulfillment take_away'),
    c('FN-KSK-04', 'Kiosk', 'Cash pending then staff pay', 'Guest+cashier', 'Cash', 'Place cash; POS confirm', 'Paid + kitchen', 'pending-cash + pay'),
    c('FN-KSK-05', 'Kiosk', 'Staff cancel unpaid kiosk', 'Cashier', 'Unpaid', 'Cancel', 'Canceled', 'PATCH cancel'),
    c('FN-KSK-06', 'Kiosk', 'Kiosk service charge', 'Guest', 'kioskServiceChargeEnabled', 'Checkout', 'Charge applied', 'flag'),
    c('FN-KSK-07', 'Kiosk', 'Check stock on kiosk', 'Guest', 'Low stock item', 'POST kiosk check-stock', 'Blocked or warned', 'POST kiosk/orders/check-stock'),
    c('FN-WEB-01', 'Storefront', 'Delivery needs address+phone', 'Guest', 'delivery', 'Checkout empty', 'Zod errors', 'create-customer-order'),
    c('FN-WEB-02', 'Storefront', 'Pickup without address', 'Guest', 'pickUp', 'Checkout', 'Allowed', 'orderType pickUp'),
    c('FN-WEB-03', 'Storefront', 'Schedule ASAP vs slot', 'Guest', 'slot 15/30/60', 'ASAP then slotted', 'orderScheduleMode/slot saved', 'Order schedule fields'),
    c('FN-WEB-04', 'Storefront', 'Cutlery and comment', 'Guest', '—', 'Toggle + note', 'Stored on order', 'cutleryRequested customerComment'),
    c('FN-WEB-05', 'Storefront', 'Online service charge', 'Guest', 'online charge on', 'Checkout', 'Applied', 'onlineServiceChargeEnabled'),
    c('FN-WEB-06', 'Storefront', 'Cart offers shown', 'Guest', 'Offers linked', 'Open cart', 'Offers listed', 'GET cart-offers'),
    c('FN-WEB-07', 'Storefront', 'Guest track by short id', 'Guest', 'shortOrderId', 'Track', 'Found', 'GET customer/order-tracking'),
    c('FN-WEB-08', 'Storefront', 'Customer register unique per restaurant', 'Guest', 'Two restaurants', 'Same email both', 'Two CustomerAccounts', 'restaurantId+emailNormalized'),
    c('FN-WEB-09', 'Storefront', 'Logged-in order history', 'Customer', 'Prior orders', 'Open /orders', 'Only this restaurant', 'GET customer/me/orders'),
    c('FN-PAY-01', 'Payments', 'Provider NONE blocks card', 'Guest', 'NONE', 'Checkout pay', 'No card/wallet', 'customerPaymentProvider'),
    c('FN-PAY-02', 'Payments', 'Stripe checkout + webhook + verify', 'Guest', 'Stripe on', 'Pay; return', 'Payment completed; order created', 'create-order-checkout-session verify-order-session'),
    c('FN-PAY-03', 'Payments', 'PayPal create capture', 'Guest', 'PayPal on', 'Pay', 'Order paid', 'paypal/create-order capture-order'),
    c('FN-PAY-04', 'Payments', 'JazzCash return success/fail/cancel', 'Guest', 'Wallets', 'Pay each outcome', 'Handled; no double charge', 'jazzcash/return GET+POST'),
    c('FN-PAY-05', 'Payments', 'Easypaisa return', 'Guest', 'Wallets', 'Pay', 'Handled', 'easypaisa/return'),
    c('FN-PAY-06', 'Payments', 'Webhook replay idempotent', 'System', 'Already completed', 'Replay webhook', 'No second capture', 'completed skip'),
    c('FN-PAY-07', 'Payments', 'Save/test/delete Stripe keys', 'Owner', 'settings:edit', 'PUT test DELETE', 'Encrypted; test result; removed', '/api/restaurant/payments/stripe'),
    c('FN-CAT-01', 'Catalog', 'Category CRUD + image', 'Menu editor', 'categories:*', 'Create edit delete', 'Appears on storefront', 'categories API'),
    c('FN-CAT-02', 'Catalog', 'Product multi-category', 'Menu editor', 'product:edit', 'Assign many categories', 'Links + primary categoryId', 'MenuItemCategory'),
    c('FN-CAT-03', 'Catalog', 'Variation priceDelta is absolute', 'Menu editor', '—', 'Set variation price', 'Cart uses that unit price', 'MenuItemVariation.priceDelta'),
    c('FN-CAT-04', 'Catalog', 'Recommendation SINGLE required', 'GROWTH', '—', 'Guest omit pick', 'Blocked until 1 selected', 'AttributeGroup required'),
    c('FN-CAT-05', 'Catalog', 'MULTIPLE CHECKBOX vs QUANTITY free', 'GROWTH', '—', 'Checkbox then qty+freeQuantity', 'Limits and free units correct', 'RecommendationMultipleMode'),
    c('FN-CAT-06', 'Catalog', 'Per-variation min/max', 'GROWTH', 'Limits Small 2 Large 4', 'Change size', 'Limits follow variation', 'AttributeGroupVariationLimit'),
    c('FN-CAT-07', 'Catalog', 'CSV export then import skip dupes', 'Menu editor', 'product:edit', 'Export; re-import skipDuplicates true', 'Existing skipped; extras added', 'GET export POST import'),
    c('FN-CAT-08', 'Catalog', 'CSV non-csv rejected', 'Menu editor', '—', 'Upload .txt', '400 only .csv', 'import route'),
    c('FN-CAT-09', 'Catalog', 'Delete product keeps order snapshot', 'Menu editor', 'Old orders', 'Delete product', 'productName remains on lines', 'onDelete SetNull'),
    c('FN-INV-01', 'Inventory', 'Unique ingredient name', 'Clerk', 'inventory:edit', 'Create duplicate name', 'Error', '@@unique name'),
    c('FN-INV-02', 'Inventory', 'Manual stock entry', 'Clerk', '—', 'In/out', 'MANUAL entry; qty updates', 'POST inventory/entries'),
    c('FN-INV-03', 'Inventory', 'Below minQuantity warning', 'Clerk', 'min set', 'Drop below', 'Warning', 'minQuantity'),
    c('FN-INV-04', 'Inventory', 'Inactive hidden from recipes', 'Clerk', 'isActive false', 'New recipe picker', 'Hidden', 'isActive'),
    c('FN-LOC-01', 'Locations', 'Duplicate table name same branch', 'Owner', 'Name exists', 'Create same', 'Error', 'DiningTable unique'),
    c('FN-LOC-02', 'Locations', 'Same table name other branch OK', 'Owner', '2 branches', 'Same name', 'Allowed', 'unique includes branchId'),
    c('FN-LOC-03', 'Locations', 'Delete table keeps tableLabel on orders', 'Owner', 'Paid table order', 'Delete table', 'Snapshot remains', 'Order.tableLabel'),
    c('FN-SET-01', 'Settings', 'Currency/country apply everywhere', 'Owner', 'settings:edit', 'Change EUR→PKR', 'POS kiosk web format change', 'currencyCode'),
    c('FN-SET-02', 'Settings', 'Service charges independent by channel', 'Owner', '—', 'Enable only online', 'POS 0; online charged', 'PATCH service-charges'),
    c('FN-ADM-01', 'Admin', 'Change tenant plan/period', 'Platform admin', '—', 'PATCH subscription', 'adminPeriodEndAt respected', 'PATCH admin/subscriptions'),
    c('FN-MKT-01', 'Marketing', 'Newsletter duplicate is already', 'Guest', 'Subscribed email', 'Subscribe again', 'Already message', 'POST newsletter/subscribe'),
    c('FN-MKT-02', 'Marketing', 'Demo request appears in admin', 'Guest then admin', '—', 'Submit demo; open /admin/requests', 'Lead listed', 'POST demo-request'),
  ];
}

function buildRbac() {
  return [
    c('RBAC-OWN-01', 'Owner', 'Account owner always full modules', 'Owner', 'Even if role tokens emptied', 'Open all modules', 'All allowed', 'ownerId short-circuit'),
    c('RBAC-OWN-02', 'Owner', 'Cannot demote owner', 'Admin', 'Owner employee', 'PATCH off Owner role', '403 must stay Owner', 'employees PATCH'),
    c('RBAC-OWN-03', 'Owner', 'Cannot remove owner', 'Admin', '—', 'DELETE owner', '403', 'employees DELETE'),
    c('RBAC-OWN-04', 'Owner', 'Cannot invite Owner role', 'Owner', '—', 'Invite with Owner roleId', '400', 'assertAssignableRestaurantRole'),
    c('RBAC-ADM-01', 'Admin preset', 'Admin has all module tokens', 'Admin employee', 'Not ownerId', 'Open all pages', 'Full nav', 'seeded full permissions'),
    c('RBAC-ADM-02', 'Admin preset', 'Stripped Admin role loses access', 'Admin', 'Permissions emptied in DB', 'Refresh', 'Modules gone (unlike owner)', 'role.permissions'),
    c('RBAC-ADM-03', 'Admin preset', 'Admin can switch all branches', 'Admin', '2+ branches', 'Header switcher', 'All branches', 'userIsOwnerOrAdmin'),
    c('RBAC-IMP-01', 'Implications', 'delete implies edit+access', 'Custom', 'product:delete only', 'View edit delete product', 'All work', 'normalizeDashboardPermissions'),
    c('RBAC-IMP-02', 'Implications', 'edit implies access', 'Custom', 'product:edit only', 'Open /product', 'Page opens; cannot delete', 'toggleModuleAction'),
    c('RBAC-IMP-03', 'Implications', 'access off clears edit+delete', 'Owner', 'GROWTH', 'Disable product:access', 'edit+delete cleared', 'toggleModuleAction'),
    c('RBAC-IMP-04', 'Implications', 'legacy orders:* opens Sales', 'Cashier', 'orders:access only', 'Open /sales', 'Allowed', 'SALES_MODULE_ALIASES'),
    c('RBAC-NAV-01', 'Nav', 'Sidebar matches tokens', 'Cashier', 'pos+sales only', 'View sidebar', 'Only those items (+ dashboard exception)', 'navItemsForPermissions'),
    c('RBAC-NAV-02', 'Nav', '/dashboard exception', 'No dashboard token', '—', 'Open /dashboard', 'Not sent to /no-access', 'layout skip /dashboard'),
    c('RBAC-NAV-03', 'Nav', 'STARTER hides Configurations', 'STARTER owner', '—', 'Sidebar', 'recommendations hidden', 'hideRecommendations'),
    c('RBAC-EMPTY-01', 'Empty role', 'Zero tokens message', 'Empty-role employee', 'No tokens', 'Login', 'No dashboard permissions returned', 'layout permissions.length===0'),
    c('RBAC-TEAM-01', 'Team', 'settings:access lists team', 'Viewer', 'settings:access', 'Open Access', 'Employees + invites', 'GET employees'),
    c('RBAC-TEAM-02', 'Team', 'settings:access cannot invite', 'Viewer', 'access only', 'POST employee', '403', 'action edit'),
    c('RBAC-TEAM-03', 'Team', 'settings:edit cannot delete user', 'Editor', 'edit no delete', 'DELETE employee', '403', 'action delete'),
    c('RBAC-TEAM-04', 'Team', 'Create new user with password', 'Owner', 'settings:edit', 'Name email password Admin', 'flow user_created', 'POST employees'),
    c('RBAC-TEAM-05', 'Team', 'Invite existing user', 'Owner', 'User exists', 'Invite', 'flow invite_sent PENDING 7d', 'EmployeeInvite'),
    c('RBAC-TEAM-06', 'Team', 'Custom role requires branch', 'Owner', 'GROWTH cashier role', 'Invite no branchIds', '400 Select a branch', 'non-Admin'),
    c('RBAC-TEAM-07', 'Team', 'Admin invite no branch OK', 'Owner', 'Admin role', 'Invite no branches', 'Allowed all branches', 'isAdminRole'),
    c('RBAC-INV-01', 'Invite', 'Accept wrong email 403', 'Other user', 'Valid token', 'POST accept', '403 invited email', 'email match'),
    c('RBAC-INV-02', 'Invite', 'Accept logged out 401', 'Guest', 'Token', 'POST accept', '401', 'getAppSession'),
    c('RBAC-INV-03', 'Invite', 'Expired invite 410', 'Invited', 'expiresAt past', 'Verify/accept', '410', 'expiresAt'),
    c('RBAC-INV-04', 'Invite', 'One restaurant only', 'Employee of A', 'Invite to B', 'Accept B', 'Removed from A; other invites DECLINED', 'deleteMany employees'),
    c('RBAC-BR-01', 'Branches', 'Cashier scoped to assigned branch', 'Cashier', 'branchIds=[B2]', 'POS/sales', 'Only B2 data; no switcher', 'resolveBranchScope'),
    c('RBAC-BR-02', 'Branches', 'Cannot forge branch cookie', 'Cashier B1', 'Cookie B2', 'Reload', 'Still B1', 'preferred ignored'),
    c('RBAC-BR-03', 'Branches', 'Non-admin cannot PATCH branches', 'settings:edit custom', 'Not admin', 'PATCH branchIds', '403 Only admins', 'userIsOwnerOrAdmin'),
    c('RBAC-BR-04', 'Branches', 'Cannot assign branches to owner', 'Admin', '—', 'PATCH owner branches', '400 Owner has all branches', 'employees PATCH'),
    c('RBAC-ROLE-01', 'Roles', 'Create custom role GROWTH', 'Owner', 'GROWTH', 'POST Cashier tokens', '201 normalized', 'POST roles'),
    c('RBAC-ROLE-02', 'Roles', 'STARTER cannot create custom role', 'STARTER', '—', 'POST role', '403', 'roleBasedSettings'),
    c('RBAC-ROLE-03', 'Roles', 'STARTER Access UI hidden', 'STARTER', '—', 'Open Settings Access', 'Redirected to Basic', 'setting.tsx'),
    c('RBAC-ROLE-04', 'Roles', 'STARTER invite custom role denied', 'STARTER', 'Cashier leftover', 'Invite cashier', '403', 'only Admin slug'),
    c('RBAC-ROLE-05', 'Roles', 'STARTER invite Admin allowed by API', 'STARTER', 'Admin role', 'POST Admin', '200', 'slug admin'),
    c('RBAC-ROLE-06', 'Roles', 'Cannot delete Owner/Admin presets', 'Owner', '—', 'DELETE', '403', 'slug owner/admin'),
    c('RBAC-ROLE-07', 'Roles', 'Cannot delete role in use', 'Owner', 'Assigned cashier', 'DELETE role', '409 count', 'employee.count'),
    c('RBAC-ROLE-08', 'Roles', 'Invalid tokens dropped', 'Owner', 'GROWTH', 'POST foo:bar + product:edit', 'Only product:access+edit stored', 'normalizeDashboardPermissions'),
    c('RBAC-PROF-01', 'Profiles', 'Cashier cannot open products', 'Cashier', 'pos+sales', 'Open /product', '/no-access', 'RBAC'),
    c('RBAC-PROF-02', 'Profiles', 'Kitchen cannot open POS', 'Kitchen', 'kds+order-display', 'Open /pos', '/no-access', 'RBAC'),
    c('RBAC-PROF-03', 'Profiles', 'Menu editor cannot open settings', 'Menu editor', 'catalog modules', 'Open /settings', '/no-access', 'RBAC'),
    c('RBAC-PROF-04', 'Profiles', 'Viewer GET ok PATCH 403', 'Viewer', 'all :access', 'Save anywhere', '403', 'edit missing'),
    c('RBAC-PROF-05', 'Profiles', 'Role change applies after bootstrap', 'Cashier→Kitchen', 'Still logged in', 'Refresh', 'Nav matches new role', '/api/me/bootstrap'),
    c('RBAC-PLAT-01', 'Platform', 'Owner cannot open /admin', 'Owner', 'Not ADMIN_EMAIL', 'Open /admin/dashboard', 'Redirect /', 'middleware'),
    c('RBAC-PLAT-02', 'Platform', 'Platform admin opens /admin', 'Platform admin', 'ADMIN_EMAIL', 'Open admin', 'OK', 'isPlatformAdmin'),
    c('RBAC-CUS-01', 'Customer', 'CustomerAccount ≠ staff User', 'Customer', 'Storefront account only', 'Open /dashboard', 'Login as staff or blocked', 'separate models'),
    c('RBAC-CUS-02', 'Customer', 'Customer cannot list employees', 'Customer session', '—', 'GET /api/restaurant/employees', '401/403', 'staff session'),
  ];
}

function buildSecurity() {
  return [
    c('SEC-AUTH-01', 'Authn', 'Protected routes redirect login', 'Guest', '—', 'Open /dashboard /pos /kds /order-display /admin', 'Redirect /login?callbackUrl=', 'middleware needsAuth'),
    c('SEC-AUTH-02', 'Authn', 'Staff API without cookie 401', 'Guest', '—', 'GET /api/restaurant/menu/products', '401', 'requireRestaurantSession'),
    c('SEC-AUTH-03', 'Authn', 'Wrong password no session', 'Anyone', 'Valid email', 'Login bad password', 'Stay on login', 'authorize null'),
    c('SEC-AUTH-04', 'Authn', 'Unknown email no enumeration', 'Guest', '—', 'Login unknown', 'Same generic fail', 'no user leak'),
    c('SEC-AUTH-05', 'Authn', 'Password min 8', 'Owner', 'New employee', 'Password 7 chars', '400', 'isStrongPassword'),
    c('SEC-AUTH-06', 'Authn', 'Customer session hashed not raw', 'Customer', 'Logged in', 'Inspect DB CustomerSession', 'tokenHash SHA-256 only', 'CustomerSession.tokenHash'),
    c('SEC-AUTHZ-01', 'Authz', 'Forge other restaurant itemId', 'Owner A', 'B itemId', 'GET/PATCH item', '404 no leak', 'restaurantId scope'),
    c('SEC-AUTHZ-02', 'Authz', 'Forge other restaurant employeeId', 'Owner A', 'B employee', 'DELETE', '404', 'scoped findFirst'),
    c('SEC-AUTHZ-03', 'Authz', 'Forge roleId from other restaurant', 'Owner A', 'B roleId', 'Invite', '400 Role not found for this restaurant', 'assertAssignableRestaurantRole'),
    c('SEC-AUTHZ-04', 'Authz', 'Forge branchIds from other restaurant', 'Owner A', 'B branchId', 'PATCH branches', 'Ignored; only valid ids saved', 'syncEmployeeBranches'),
    c('SEC-AUTHZ-05', 'Authz', 'Customer APIs resolve slug/host not staff restaurant', 'Staff+guest', '—', 'Call customer menu with other slug', 'Other tenant menu or 404', 'customer restaurant route'),
    c('SEC-AUTHZ-06', 'Authz', 'Admin API as restaurant owner 403', 'Owner', '—', 'GET /api/admin/overview', '403 Access Blocked', 'adminRequest.ts'),
    c('SEC-AUTHZ-07', 'Authz', 'Accept someone else invite token', 'Other user', 'Token', 'POST accept', '403 wrong email', 'email match'),
    c('SEC-TENANT-01', 'Isolation', 'Two restaurants never mix orders', 'Owner A', 'B orders exist', 'Sales list', 'Only A', 'getRestaurantForUser'),
    c('SEC-TENANT-02', 'Isolation', 'Same customer email two restaurants', 'Guest', 'Two slugs', 'Register both', 'Two accounts', 'composite unique'),
    c('SEC-PAY-01', 'Payments', 'Webhook invalid signature', 'Attacker', '—', 'POST webhook junk', '400; order unchanged', 'signature verify'),
    c('SEC-PAY-02', 'Payments', 'Double-submit pay', 'Guest', '—', 'Double click pay', 'One payment', 'idempotency / completed guard'),
    c('SEC-PAY-03', 'Payments', 'Pay canceled order rejected', 'Guest', 'Canceled', 'Pay', 'Rejected', 'status guard'),
    c('SEC-PAY-04', 'Payments', 'Secrets not returned to client', 'Owner', 'Stripe saved', 'GET payments/stripe', 'No raw secretKeyEnc', 'encrypted fields stripped'),
    c('SEC-INJ-01', 'Injection', 'XSS in product name', 'Menu editor', '—', 'Name <script>alert(1)</script>', 'Escaped on POS KDS storefront', 'React encoding'),
    c('SEC-INJ-02', 'Injection', 'XSS in customer comment', 'Guest', '—', 'Comment with HTML', 'Escaped on sales/KDS', 'encoding'),
    c('SEC-INJ-03', 'Injection', 'SQL-like category name', 'Menu editor', '—', "Name ' OR 1=1 --", 'Stored as text; no query break', 'Prisma parameterized'),
    c('SEC-CSRF-01', 'Session', 'Logout clears staff session', 'Staff', 'Logged in', 'Logout; call staff API', '401', 'NextAuth'),
    c('SEC-CSRF-02', 'Session', 'Staff cookie ≠ customer cookie', 'Both', 'Same browser', 'Logout staff', 'Customer session independent', 'separate cookies'),
    c('SEC-UPLOAD-01', 'Upload', 'CSV huge file', 'Menu editor', '—', 'Huge CSV import', 'Sensible error; no crash', 'import route'),
    c('SEC-UPLOAD-02', 'Upload', 'Non-image as product image', 'Menu editor', '—', 'Upload exe/html', 'Rejected or not executed', 'image route'),
    c('SEC-MW-01', 'Middleware', 'Legacy /web-app 308', 'Guest', '—', 'Open /web-app/{slug}', '308 to route-group URL', 'legacyWebAppRedirectPath'),
    c('SEC-MW-02', 'Middleware', 'Customer Google state rewrite', 'Guest', 'Customer OAuth state', 'Hit /api/auth/callback/google', 'Rewrite customer-auth callback', 'looksLikeCustomerGoogleOAuthState'),
    c('SEC-MW-03', 'Middleware', 'Subdomain rewrite not APIs', 'Guest', 'slug.localhost', 'Call /api/*', 'API untouched', 'middleware API skip'),
    c('SEC-RATE-01', 'Abuse', 'Invalid JSON body', 'Staff', 'Logged in', 'POST {', '400 Invalid JSON', 'JSON parse catch'),
    c('SEC-IDOR-01', 'IDOR', 'Kiosk order of other restaurant', 'Staff A', 'B kiosk orderId', 'GET/PATCH', '404', 'restaurant scope'),
    c('SEC-IDOR-02', 'IDOR', 'Customer me/orders other id', 'Customer A', 'B orderId', 'GET me/orders/[id]', '404', 'account scoped'),
  ];
}

/** @type {{method: string, path: string, auth: string, area: string, title: string, expect: string}[]} */
const API_ENDPOINTS = [
  { method: 'GET', path: '/api/me/bootstrap', auth: 'staff', area: 'Me', title: 'Bootstrap permissions branches subscription', expect: '200 payload' },
  { method: 'GET', path: '/api/me/dashboard-permissions', auth: 'staff', area: 'Me', title: 'Dashboard permission tokens', expect: '200 string[]' },
  { method: 'GET', path: '/api/me/subscription-access', auth: 'staff', area: 'Me', title: 'Subscription access evaluation', expect: '200 allowed/reason' },
  { method: 'GET', path: '/api/me/branch-context', auth: 'staff', area: 'Me', title: 'Branch scope', expect: '200 allowedBranchIds' },
  { method: 'POST', path: '/api/me/active-branch', auth: 'staff', area: 'Me', title: 'Set active branch cookie', expect: '200 owner/admin only switch' },
  { method: 'GET', path: '/api/restaurant', auth: 'staff', area: 'Restaurant', title: 'Get restaurant profile', expect: '200' },
  { method: 'PATCH', path: '/api/restaurant', auth: 'settings:edit', area: 'Restaurant', title: 'Update restaurant / branding', expect: '200 or plan 403' },
  { method: 'GET', path: '/api/restaurant/regional', auth: 'staff', area: 'Restaurant', title: 'Get currency country', expect: '200' },
  { method: 'PATCH', path: '/api/restaurant/regional', auth: 'settings:edit', area: 'Restaurant', title: 'Patch currency country', expect: '200' },
  { method: 'GET', path: '/api/restaurant/service-charges', auth: 'settings:access', area: 'Restaurant', title: 'Get service charges', expect: '200' },
  { method: 'PATCH', path: '/api/restaurant/service-charges', auth: 'settings:edit', area: 'Restaurant', title: 'Patch POS/kiosk/online charges', expect: '200' },
  { method: 'GET', path: '/api/restaurant/dashboard-analytics', auth: 'dashboard:access', area: 'Dashboard', title: 'Dashboard analytics', expect: '200 metrics' },
  { method: 'GET', path: '/api/dashboard', auth: 'staff', area: 'Dashboard', title: 'Legacy dashboard API', expect: '200 or scoped' },
  { method: 'GET', path: '/api/restaurant/sales-orders', auth: 'sales:access', area: 'Sales', title: 'List sales orders', expect: '200 filtered' },
  { method: 'GET', path: '/api/restaurant/orders/[orderId]', auth: 'sales:access', area: 'Sales', title: 'Order detail', expect: '200 or 404' },
  { method: 'GET', path: '/api/restaurant/pos-shift', auth: 'pos:access', area: 'POS', title: 'Get current shift', expect: '200 open or none' },
  { method: 'POST', path: '/api/restaurant/pos-shift', auth: 'pos:edit', area: 'POS', title: 'Open/close shift', expect: '200' },
  { method: 'POST', path: '/api/restaurant/pos-order', auth: 'pos:edit', area: 'POS', title: 'Create POS order', expect: '201/200 order' },
  { method: 'POST', path: '/api/restaurant/pos-order/check-stock', auth: 'pos:access', area: 'POS', title: 'Check POS stock', expect: '200 availability' },
  { method: 'GET', path: '/api/restaurant/pos-order/recent', auth: 'pos:access', area: 'POS', title: 'Recent POS orders', expect: '200' },
  { method: 'GET', path: '/api/restaurant/pos-order/pending-kitchen', auth: 'pos:access', area: 'POS', title: 'Pending kitchen', expect: '200' },
  { method: 'GET', path: '/api/restaurant/pos-order/[orderId]', auth: 'pos:access', area: 'POS', title: 'Get POS order', expect: '200' },
  { method: 'PATCH', path: '/api/restaurant/pos-order/[orderId]', auth: 'pos:edit', area: 'POS', title: 'Update POS order', expect: '200' },
  { method: 'PATCH', path: '/api/restaurant/pos-order/[orderId]/cancel', auth: 'pos:edit', area: 'POS', title: 'Cancel POS order', expect: '200 or 400 if completed' },
  { method: 'POST', path: '/api/restaurant/pos-order/[orderId]/terminal-payment', auth: 'pos:edit', area: 'POS', title: 'Terminal payment', expect: '200 or error' },
  { method: 'GET', path: '/api/restaurant/table-orders/open', auth: 'pos:access', area: 'POS', title: 'Open table orders', expect: '200' },
  { method: 'POST', path: '/api/restaurant/table-orders/send-kitchen', auth: 'pos:edit', area: 'POS', title: 'Send table to kitchen', expect: '200 tickets' },
  { method: 'POST', path: '/api/restaurant/table-orders/pay', auth: 'pos:edit', area: 'POS', title: 'Pay table order', expect: '200 completed' },
  { method: 'POST', path: '/api/restaurant/table-orders/cancel', auth: 'pos:edit', area: 'POS', title: 'Cancel table order', expect: '200' },
  { method: 'GET', path: '/api/restaurant/kds/tickets', auth: 'kds:access', area: 'KDS', title: 'List tickets', expect: '200' },
  { method: 'POST', path: '/api/restaurant/kds/tickets', auth: 'kds:edit', area: 'KDS', title: 'Create ticket', expect: '200' },
  { method: 'PATCH', path: '/api/restaurant/kds/tickets/[ticketId]', auth: 'kds:edit', area: 'KDS', title: 'Update ticket status', expect: '200' },
  { method: 'GET', path: '/api/restaurant/kds/manager-orders', auth: 'kds:access', area: 'KDS', title: 'Manager orders', expect: '200' },
  { method: 'PATCH', path: '/api/restaurant/kds/manager-orders/[orderId]', auth: 'kds:edit', area: 'KDS', title: 'Complete/cancel manager order', expect: '200 or rejected if done' },
  { method: 'GET', path: '/api/restaurant/order-display', auth: 'order-display:access', area: 'KDS', title: 'Order display payload', expect: '200 columns' },
  { method: 'GET', path: '/api/restaurant/realtime/stream', auth: 'staff', area: 'Realtime', title: 'SSE stream', expect: 'text/event-stream' },
  { method: 'GET', path: '/api/kiosk/order-tracking', auth: 'public', area: 'Kiosk', title: 'Track kiosk order', expect: '200 or 404' },
  { method: 'POST', path: '/api/kiosk/orders', auth: 'public', area: 'Kiosk', title: 'Place kiosk order', expect: '200; 400 if dine_in no table' },
  { method: 'POST', path: '/api/kiosk/orders/check-stock', auth: 'public', area: 'Kiosk', title: 'Kiosk check stock', expect: '200' },
  { method: 'GET', path: '/api/restaurant/kiosk-order/[orderId]', auth: 'pos:access', area: 'Kiosk', title: 'Get kiosk order', expect: '200' },
  { method: 'PATCH', path: '/api/restaurant/kiosk-order/[orderId]', auth: 'pos:edit', area: 'Kiosk', title: 'Patch kiosk order', expect: '200' },
  { method: 'GET', path: '/api/restaurant/kiosk-order/pending-cash', auth: 'pos:access', area: 'Kiosk', title: 'Pending cash kiosk', expect: '200' },
  { method: 'POST', path: '/api/restaurant/kiosk-order/[orderId]/pay', auth: 'pos:edit', area: 'Kiosk', title: 'Confirm kiosk cash', expect: '200' },
  { method: 'PATCH', path: '/api/restaurant/kiosk-order/[orderId]/cancel', auth: 'pos:edit', area: 'Kiosk', title: 'Cancel unpaid kiosk', expect: '200' },
  { method: 'GET', path: '/api/customer/restaurant', auth: 'public', area: 'Customer', title: 'Restaurant by slug/host', expect: '200' },
  { method: 'GET', path: '/api/customer/restaurant/media', auth: 'public', area: 'Customer', title: 'Restaurant media', expect: '200' },
  { method: 'GET', path: '/api/customer/menu', auth: 'public', area: 'Customer', title: 'Full customer menu', expect: '200' },
  { method: 'GET', path: '/api/customer/menu/categories', auth: 'public', area: 'Customer', title: 'Categories', expect: '200' },
  { method: 'GET', path: '/api/customer/menu/categories/[categoryId]', auth: 'public', area: 'Customer', title: 'Category detail', expect: '200/404' },
  { method: 'GET', path: '/api/customer/menu/items/[itemId]', auth: 'public', area: 'Customer', title: 'Item detail', expect: '200/404' },
  { method: 'GET', path: '/api/customer/menu/cart-offers', auth: 'public', area: 'Customer', title: 'Cart offers', expect: '200' },
  { method: 'GET', path: '/api/customer/branches', auth: 'public', area: 'Customer', title: 'Branches', expect: '200' },
  { method: 'GET', path: '/api/customer/tables', auth: 'public', area: 'Customer', title: 'Tables', expect: '200' },
  { method: 'GET', path: '/api/customer/payment-config', auth: 'public', area: 'Customer', title: 'Payment config', expect: '200 no secrets' },
  { method: 'POST', path: '/api/customer/orders', auth: 'public', area: 'Customer', title: 'Place online order', expect: '200/400 validation' },
  { method: 'GET', path: '/api/customer/order-tracking', auth: 'public', area: 'Customer', title: 'Track order', expect: '200/404' },
  { method: 'GET', path: '/api/customer/me/orders', auth: 'customer', area: 'Customer', title: 'My orders', expect: '200 own restaurant only' },
  { method: 'GET', path: '/api/customer/me/orders/[orderId]', auth: 'customer', area: 'Customer', title: 'My order detail', expect: '200/404' },
  { method: 'POST', path: '/api/customer-auth/register', auth: 'public', area: 'Customer auth', title: 'Register customer', expect: '200/409' },
  { method: 'POST', path: '/api/customer-auth/login', auth: 'public', area: 'Customer auth', title: 'Login customer', expect: '200 cookie' },
  { method: 'POST', path: '/api/customer-auth/logout', auth: 'customer', area: 'Customer auth', title: 'Logout customer', expect: '200' },
  { method: 'GET', path: '/api/customer-auth/session', auth: 'customer', area: 'Customer auth', title: 'Customer session', expect: '200/401' },
  { method: 'GET', path: '/api/customer-auth/google/config', auth: 'public', area: 'Customer auth', title: 'Google config', expect: '200' },
  { method: 'GET', path: '/api/customer-auth/google/start', auth: 'public', area: 'Customer auth', title: 'Google start', expect: 'Redirect' },
  { method: 'POST', path: '/api/customer-auth/google/native', auth: 'public', area: 'Customer auth', title: 'Google native', expect: '200/401' },
  { method: 'GET', path: '/api/restaurant/menu', auth: 'staff', area: 'Catalog', title: 'Staff menu', expect: '200' },
  { method: 'GET', path: '/api/restaurant/menu/products', auth: 'product:access', area: 'Catalog', title: 'List products', expect: '200' },
  { method: 'POST', path: '/api/restaurant/menu/items', auth: 'product:edit', area: 'Catalog', title: 'Create product', expect: '201' },
  { method: 'GET', path: '/api/restaurant/menu/items/[itemId]', auth: 'product:access', area: 'Catalog', title: 'Get product', expect: '200' },
  { method: 'PATCH', path: '/api/restaurant/menu/items/[itemId]', auth: 'product:edit', area: 'Catalog', title: 'Update product', expect: '200' },
  { method: 'DELETE', path: '/api/restaurant/menu/items/[itemId]', auth: 'product:delete', area: 'Catalog', title: 'Delete product', expect: '200' },
  { method: 'GET', path: '/api/restaurant/menu/products/export', auth: 'product:access', area: 'Catalog', title: 'Export CSV', expect: 'text/csv' },
  { method: 'POST', path: '/api/restaurant/menu/products/import', auth: 'product:edit', area: 'Catalog', title: 'Import CSV', expect: '200 or 400' },
  { method: 'GET', path: '/api/restaurant/menu/categories', auth: 'categories:access', area: 'Catalog', title: 'List categories', expect: '200' },
  { method: 'POST', path: '/api/restaurant/menu/categories', auth: 'categories:edit', area: 'Catalog', title: 'Create category', expect: '201' },
  { method: 'PATCH', path: '/api/restaurant/menu/categories/[categoryId]', auth: 'categories:edit', area: 'Catalog', title: 'Update category', expect: '200' },
  { method: 'DELETE', path: '/api/restaurant/menu/categories/[categoryId]', auth: 'categories:delete', area: 'Catalog', title: 'Delete category', expect: '200/409' },
  { method: 'GET', path: '/api/restaurant/variations', auth: 'variations:access', area: 'Catalog', title: 'List variations', expect: '200' },
  { method: 'POST', path: '/api/restaurant/variations', auth: 'variations:edit', area: 'Catalog', title: 'Create variation', expect: '201' },
  { method: 'PATCH', path: '/api/restaurant/variations/[variationId]', auth: 'variations:edit', area: 'Catalog', title: 'Update variation', expect: '200' },
  { method: 'DELETE', path: '/api/restaurant/variations/[variationId]', auth: 'variations:delete', area: 'Catalog', title: 'Delete variation', expect: '200' },
  { method: 'POST', path: '/api/restaurant/menu/items/[itemId]/attributes', auth: 'recommendations:edit', area: 'Catalog', title: 'Add recommendation group', expect: '201 or plan 403' },
  { method: 'PATCH', path: '/api/restaurant/menu/attributes/[groupId]', auth: 'recommendations:edit', area: 'Catalog', title: 'Update group', expect: '200 or 403' },
  { method: 'DELETE', path: '/api/restaurant/menu/attributes/[groupId]', auth: 'recommendations:delete', area: 'Catalog', title: 'Delete group', expect: '200 or 403' },
  { method: 'POST', path: '/api/restaurant/menu/items/[itemId]/offers', auth: 'recommendations:edit', area: 'Catalog', title: 'Add offer', expect: '201 or 403' },
  { method: 'DELETE', path: '/api/restaurant/menu/offers/[offerId]', auth: 'recommendations:delete', area: 'Catalog', title: 'Delete offer', expect: '200 or 403' },
  { method: 'GET', path: '/api/restaurant/menu/items/[itemId]/personalize', auth: 'product:access', area: 'Catalog', title: 'Get personalize', expect: '200' },
  { method: 'PUT', path: '/api/restaurant/menu/items/[itemId]/personalize', auth: 'product:edit', area: 'Catalog', title: 'Put personalize', expect: '200' },
  { method: 'GET', path: '/api/restaurant/inventory/ingredients', auth: 'inventory:access', area: 'Inventory', title: 'List ingredients', expect: '200' },
  { method: 'POST', path: '/api/restaurant/inventory/ingredients', auth: 'inventory:edit', area: 'Inventory', title: 'Create ingredient', expect: '201/409' },
  { method: 'GET', path: '/api/restaurant/inventory/ingredients/[ingredientId]', auth: 'inventory:access', area: 'Inventory', title: 'Get ingredient', expect: '200' },
  { method: 'PATCH', path: '/api/restaurant/inventory/ingredients/[ingredientId]', auth: 'inventory:edit', area: 'Inventory', title: 'Update ingredient', expect: '200' },
  { method: 'DELETE', path: '/api/restaurant/inventory/ingredients/[ingredientId]', auth: 'inventory:delete', area: 'Inventory', title: 'Delete ingredient', expect: '200/409' },
  { method: 'GET', path: '/api/restaurant/inventory/entries', auth: 'inventory:access', area: 'Inventory', title: 'Stock entries', expect: '200' },
  { method: 'POST', path: '/api/restaurant/inventory/entries', auth: 'inventory:edit', area: 'Inventory', title: 'Create stock entry', expect: '201' },
  { method: 'GET', path: '/api/restaurant/branches', auth: 'branched:access', area: 'Locations', title: 'List branches', expect: '200' },
  { method: 'POST', path: '/api/restaurant/branches', auth: 'branched:edit', area: 'Locations', title: 'Create branch', expect: '201 or plan 403' },
  { method: 'PATCH', path: '/api/restaurant/branches/[branchId]', auth: 'branched:edit', area: 'Locations', title: 'Update branch', expect: '200' },
  { method: 'DELETE', path: '/api/restaurant/branches/[branchId]', auth: 'branched:delete', area: 'Locations', title: 'Delete branch', expect: '200' },
  { method: 'GET', path: '/api/restaurant/tables', auth: 'tables:access', area: 'Locations', title: 'List tables', expect: '200' },
  { method: 'POST', path: '/api/restaurant/tables', auth: 'tables:edit', area: 'Locations', title: 'Create table', expect: '201/409' },
  { method: 'PATCH', path: '/api/restaurant/tables/[tableId]', auth: 'tables:edit', area: 'Locations', title: 'Update table', expect: '200' },
  { method: 'DELETE', path: '/api/restaurant/tables/[tableId]', auth: 'tables:delete', area: 'Locations', title: 'Delete table', expect: '200' },
  { method: 'GET', path: '/api/restaurant/transaction-history', auth: 'records:access', area: 'Finance', title: 'Transaction history', expect: '200' },
  { method: 'GET', path: '/api/transactions', auth: 'records:access', area: 'Finance', title: 'Transactions list', expect: '200' },
  { method: 'GET', path: '/api/transactions/[id]', auth: 'records:access', area: 'Finance', title: 'Transaction detail', expect: '200/404' },
  { method: 'GET', path: '/api/profit', auth: 'staff', area: 'Finance', title: 'Profit report', expect: '200 or gated' },
  { method: 'GET', path: '/api/productsale', auth: 'staff', area: 'Finance', title: 'Product sales report', expect: '200 or gated' },
  { method: 'GET', path: '/api/favorite', auth: 'staff', area: 'Finance', title: 'Favorites report', expect: '200 or gated' },
  { method: 'GET', path: '/api/restaurant/roles', auth: 'settings:access', area: 'RBAC API', title: 'List roles', expect: '200' },
  { method: 'POST', path: '/api/restaurant/roles', auth: 'settings:edit', area: 'RBAC API', title: 'Create role', expect: '201 or plan 403' },
  { method: 'PATCH', path: '/api/restaurant/roles/[roleId]', auth: 'settings:edit', area: 'RBAC API', title: 'Update role', expect: '200 or 403' },
  { method: 'DELETE', path: '/api/restaurant/roles/[roleId]', auth: 'settings:delete', area: 'RBAC API', title: 'Delete role', expect: '200/403/409' },
  { method: 'GET', path: '/api/restaurant/employees', auth: 'settings:access', area: 'RBAC API', title: 'List employees', expect: '200' },
  { method: 'POST', path: '/api/restaurant/employees', auth: 'settings:edit', area: 'RBAC API', title: 'Invite/create employee', expect: '200/400/409' },
  { method: 'PATCH', path: '/api/restaurant/employees/[employeeId]', auth: 'settings:edit', area: 'RBAC API', title: 'Update employee', expect: '200/403' },
  { method: 'DELETE', path: '/api/restaurant/employees/[employeeId]', auth: 'settings:delete', area: 'RBAC API', title: 'Remove employee', expect: '200/403' },
  { method: 'GET', path: '/api/restaurant/invites/verify', auth: 'public', area: 'RBAC API', title: 'Verify invite token', expect: '200/400/404/410' },
  { method: 'POST', path: '/api/restaurant/invites/accept', auth: 'staff', area: 'RBAC API', title: 'Accept invite', expect: '200/401/403' },
  { method: 'DELETE', path: '/api/restaurant/invites/[inviteId]', auth: 'settings:delete', area: 'RBAC API', title: 'Cancel invite', expect: '200/404' },
  { method: 'GET', path: '/api/restaurant/billing', auth: 'settings:access', area: 'Billing', title: 'Billing info', expect: '200' },
  { method: 'PATCH', path: '/api/restaurant/billing/auto-renew', auth: 'settings:edit', area: 'Billing', title: 'Toggle auto-renew', expect: '200' },
  { method: 'GET', path: '/api/restaurant/payment-provider', auth: 'settings:access', area: 'Payments API', title: 'Get provider', expect: '200' },
  { method: 'PUT', path: '/api/restaurant/payment-provider', auth: 'settings:edit', area: 'Payments API', title: 'Set provider', expect: '200' },
  { method: 'GET', path: '/api/restaurant/payments/stripe', auth: 'settings:access', area: 'Payments API', title: 'Get Stripe (no secret)', expect: '200' },
  { method: 'PUT', path: '/api/restaurant/payments/stripe', auth: 'settings:edit', area: 'Payments API', title: 'Save Stripe', expect: '200' },
  { method: 'DELETE', path: '/api/restaurant/payments/stripe', auth: 'settings:delete', area: 'Payments API', title: 'Delete Stripe', expect: '200' },
  { method: 'POST', path: '/api/restaurant/payments/stripe/test', auth: 'settings:edit', area: 'Payments API', title: 'Test Stripe', expect: '200/400' },
  { method: 'GET', path: '/api/restaurant/payments/paypal', auth: 'settings:access', area: 'Payments API', title: 'Get PayPal', expect: '200' },
  { method: 'PUT', path: '/api/restaurant/payments/paypal', auth: 'settings:edit', area: 'Payments API', title: 'Save PayPal', expect: '200' },
  { method: 'DELETE', path: '/api/restaurant/payments/paypal', auth: 'settings:delete', area: 'Payments API', title: 'Delete PayPal', expect: '200' },
  { method: 'POST', path: '/api/restaurant/payments/paypal/test', auth: 'settings:edit', area: 'Payments API', title: 'Test PayPal', expect: '200/400' },
  { method: 'GET', path: '/api/restaurant/payments/jazzcash', auth: 'settings:access', area: 'Payments API', title: 'Get JazzCash', expect: '200' },
  { method: 'PUT', path: '/api/restaurant/payments/jazzcash', auth: 'settings:edit', area: 'Payments API', title: 'Save JazzCash', expect: '200' },
  { method: 'DELETE', path: '/api/restaurant/payments/jazzcash', auth: 'settings:delete', area: 'Payments API', title: 'Delete JazzCash', expect: '200' },
  { method: 'POST', path: '/api/restaurant/payments/jazzcash/test', auth: 'settings:edit', area: 'Payments API', title: 'Test JazzCash', expect: '200/400' },
  { method: 'GET', path: '/api/restaurant/payments/easypaisa', auth: 'settings:access', area: 'Payments API', title: 'Get Easypaisa', expect: '200' },
  { method: 'PUT', path: '/api/restaurant/payments/easypaisa', auth: 'settings:edit', area: 'Payments API', title: 'Save Easypaisa', expect: '200' },
  { method: 'DELETE', path: '/api/restaurant/payments/easypaisa', auth: 'settings:delete', area: 'Payments API', title: 'Delete Easypaisa', expect: '200' },
  { method: 'POST', path: '/api/restaurant/payments/easypaisa/test', auth: 'settings:edit', area: 'Payments API', title: 'Test Easypaisa', expect: '200/400' },
  { method: 'POST', path: '/api/stripe/create-order-checkout-session', auth: 'public', area: 'Payments API', title: 'Stripe order checkout', expect: '200 session' },
  { method: 'GET', path: '/api/stripe/verify-order-session', auth: 'public', area: 'Payments API', title: 'Verify Stripe order session', expect: '200 completed or 4xx/5xx' },
  { method: 'POST', path: '/api/stripe/create-checkout-session', auth: 'staff', area: 'Payments API', title: 'SaaS Stripe checkout', expect: '200' },
  { method: 'GET', path: '/api/stripe/verify-session', auth: 'staff', area: 'Payments API', title: 'Verify SaaS Stripe', expect: '200' },
  { method: 'POST', path: '/api/stripe/webhook', auth: 'signature', area: 'Payments API', title: 'SaaS Stripe webhook', expect: '200 valid sig; 400 invalid' },
  { method: 'POST', path: '/api/webhooks/stripe/[restaurantId]', auth: 'signature', area: 'Payments API', title: 'Restaurant Stripe webhook', expect: '200/400' },
  { method: 'POST', path: '/api/paypal/create-order', auth: 'public', area: 'Payments API', title: 'PayPal create order', expect: '200' },
  { method: 'POST', path: '/api/paypal/capture-order', auth: 'public', area: 'Payments API', title: 'PayPal capture', expect: '200' },
  { method: 'GET', path: '/api/paypal/mobile-complete', auth: 'public', area: 'Payments API', title: 'PayPal mobile return', expect: 'Redirect/JSON' },
  { method: 'POST', path: '/api/paypal/webhook', auth: 'signature', area: 'Payments API', title: 'PayPal SaaS webhook', expect: '200/400' },
  { method: 'POST', path: '/api/webhooks/paypal/[restaurantId]', auth: 'signature', area: 'Payments API', title: 'Restaurant PayPal webhook', expect: '200/400' },
  { method: 'POST', path: '/api/jazzcash/create-order-checkout', auth: 'public', area: 'Payments API', title: 'JazzCash checkout', expect: '200' },
  { method: 'GET', path: '/api/jazzcash/return', auth: 'public', area: 'Payments API', title: 'JazzCash return GET', expect: 'Redirect' },
  { method: 'POST', path: '/api/jazzcash/return', auth: 'public', area: 'Payments API', title: 'JazzCash return POST', expect: 'Handled' },
  { method: 'POST', path: '/api/easypaisa/create-order-checkout', auth: 'public', area: 'Payments API', title: 'Easypaisa checkout', expect: '200' },
  { method: 'GET', path: '/api/easypaisa/return', auth: 'public', area: 'Payments API', title: 'Easypaisa return GET', expect: 'Redirect' },
  { method: 'POST', path: '/api/easypaisa/return', auth: 'public', area: 'Payments API', title: 'Easypaisa return POST', expect: 'Handled' },
  { method: 'POST', path: '/api/auth/signup', auth: 'public', area: 'Auth API', title: 'Staff signup', expect: '200/409' },
  { method: 'GET', path: '/api/auth/register-roles', auth: 'public', area: 'Auth API', title: 'Register role options', expect: '200 pending_owner/worker' },
  { method: 'POST', path: '/api/auth/role', auth: 'staff', area: 'Auth API', title: 'Set OWNER/WORKER', expect: '200' },
  { method: 'POST', path: '/api/auth/reset', auth: 'public', area: 'Auth API', title: 'Request reset', expect: '200 generic' },
  { method: 'POST', path: '/api/auth/reset/confirm', auth: 'public', area: 'Auth API', title: 'Confirm reset', expect: '200/400' },
  { method: 'POST', path: '/api/onboarding/step1', auth: 'pending owner', area: 'Auth API', title: 'Create restaurant', expect: '200/409 slug' },
  { method: 'PATCH', path: '/api/onboarding/step2', auth: 'pending owner', area: 'Auth API', title: 'Save branch hours', expect: '200' },
  { method: 'POST', path: '/api/onboarding/step3', auth: 'pending owner', area: 'Auth API', title: 'Finish onboarding', expect: '200 trial' },
  { method: 'GET', path: '/api/pricing-plans', auth: 'public', area: 'Public API', title: 'Pricing plans', expect: '200' },
  { method: 'GET', path: '/api/faqs', auth: 'public', area: 'Public API', title: 'Public FAQs', expect: '200' },
  { method: 'GET', path: '/api/documentation', auth: 'public', area: 'Public API', title: 'Docs list', expect: '200' },
  { method: 'GET', path: '/api/documentation/[id]', auth: 'public', area: 'Public API', title: 'Doc module', expect: '200/404' },
  { method: 'POST', path: '/api/newsletter/subscribe', auth: 'public', area: 'Public API', title: 'Newsletter', expect: '200 success/already' },
  { method: 'POST', path: '/api/demo-request', auth: 'public', area: 'Public API', title: 'Demo request', expect: '200' },
  { method: 'POST', path: '/api/contact', auth: 'public', area: 'Public API', title: 'Contact', expect: '200/400' },
  { method: 'GET', path: '/api/admin/overview', auth: 'platform admin', area: 'Admin API', title: 'Admin overview', expect: '200; owner 403' },
  { method: 'GET', path: '/api/admin/restaurants', auth: 'platform admin', area: 'Admin API', title: 'List restaurants', expect: '200' },
  { method: 'PATCH', path: '/api/admin/subscriptions/[restaurantId]', auth: 'platform admin', area: 'Admin API', title: 'Patch subscription', expect: '200' },
  { method: 'GET', path: '/api/admin/subscriptions/[restaurantId]/payments', auth: 'platform admin', area: 'Admin API', title: 'List sub payments', expect: '200' },
  { method: 'POST', path: '/api/admin/subscriptions/[restaurantId]/payments', auth: 'platform admin', area: 'Admin API', title: 'Record sub payment', expect: '201' },
  { method: 'GET', path: '/api/admin/requests', auth: 'platform admin', area: 'Admin API', title: 'Demo requests', expect: '200' },
  { method: 'POST', path: '/api/admin/requests/[requestId]/email', auth: 'platform admin', area: 'Admin API', title: 'Email demo lead', expect: '200' },
  { method: 'GET', path: '/api/admin/blog', auth: 'platform admin', area: 'Admin API', title: 'List blog', expect: '200' },
  { method: 'POST', path: '/api/admin/blog', auth: 'platform admin', area: 'Admin API', title: 'Create blog', expect: '201' },
  { method: 'PATCH', path: '/api/admin/blog/[id]', auth: 'platform admin', area: 'Admin API', title: 'Update blog', expect: '200' },
  { method: 'DELETE', path: '/api/admin/blog/[id]', auth: 'platform admin', area: 'Admin API', title: 'Delete blog', expect: '200' },
  { method: 'GET', path: '/api/admin/faqs', auth: 'platform admin', area: 'Admin API', title: 'Admin FAQs', expect: '200' },
  { method: 'POST', path: '/api/admin/faqs', auth: 'platform admin', area: 'Admin API', title: 'Create FAQ', expect: '201' },
  { method: 'POST', path: '/api/admin/faqs/reorder', auth: 'platform admin', area: 'Admin API', title: 'Reorder FAQs', expect: '200' },
  { method: 'GET', path: '/api/admin/newsletter', auth: 'platform admin', area: 'Admin API', title: 'Subscribers', expect: '200' },
  { method: 'POST', path: '/api/admin/newsletter/send', auth: 'platform admin', area: 'Admin API', title: 'Send campaign', expect: '200' },
  { method: 'GET', path: '/api/admin/settings', auth: 'platform admin', area: 'Admin API', title: 'Platform settings', expect: '200' },
  { method: 'PUT', path: '/api/admin/settings', auth: 'platform admin', area: 'Admin API', title: 'Save platform settings', expect: '200' },
  { method: 'GET', path: '/api/admin/seo/traffic-metrics', auth: 'platform admin', area: 'Admin API', title: 'SEO metrics', expect: '200' },
];

function buildApi() {
  /** @type {CaseRow[]} */
  const rows = [];
  API_ENDPOINTS.forEach((e, i) => {
    const n = String(i + 1).padStart(3, '0');
    rows.push(
      c(
        `API-${n}`,
        e.area,
        `${e.method} ${e.title}`,
        e.auth,
        `Auth = ${e.auth}`,
        `${e.method} ${e.path} with valid payload`,
        e.expect,
        `${e.method} ${e.path}`,
      ),
    );
  });
  rows.push(
    c('API-NEG-01', 'Negatives', 'Staff route without cookie', 'Guest', '—', 'GET /api/restaurant/menu/products', '401', 'requireRestaurantSession'),
    c('API-NEG-02', 'Negatives', 'Staff route missing module permission', 'Cashier', 'No product:*', 'GET /api/restaurant/menu/products', '403 Access Blocked', 'moduleKey product'),
    c('API-NEG-03', 'Negatives', 'Invalid JSON on POST', 'Owner', 'Logged in', 'POST /api/restaurant/employees body {', '400 Invalid JSON', 'JSON parse'),
    c('API-NEG-04', 'Negatives', 'Zod validation fail', 'Owner', '—', 'POST employees email=bad', '400 flatten errors', 'zod'),
    c('API-NEG-05', 'Negatives', 'Wrong restaurant UUID', 'Owner A', 'B ids', 'GET other tenant resource', '404', 'scope'),
    c('API-NEG-06', 'Negatives', 'Admin route as owner', 'Owner', '—', 'GET /api/admin/overview', '403', 'isPlatformAdmin'),
    c('API-NEG-07', 'Negatives', 'Webhook bad signature', 'Attacker', '—', 'POST /api/webhooks/stripe/[id]', '400', 'signature'),
    c('API-NEG-08', 'Negatives', 'Customer me/orders without session', 'Guest', '—', 'GET /api/customer/me/orders', '401', 'customer session'),
    c('API-NEG-09', 'Negatives', 'Idempotent POS retry', 'Cashier', 'Same idempotencyKey', 'POST pos-order twice', 'One order', 'unique key'),
    c('API-NEG-10', 'Negatives', 'Plan-denied recommendations POST', 'STARTER', '—', 'POST attributes', '403 plan message', 'subscriptionPlanDeniedResponse'),
  );
  return rows;
}

const UI_PAGES = [
  ['/', 'Marketing', 'Landing', 'Guest'],
  ['/pricing', 'Marketing', 'Pricing', 'Guest'],
  ['/blog', 'Marketing', 'Blog list', 'Guest'],
  ['/blog/[slug]', 'Marketing', 'Blog post', 'Guest'],
  ['/documentation', 'Marketing', 'Docs home', 'Guest'],
  ['/documentation/[heading]/[sub]', 'Marketing', 'Docs article', 'Guest'],
  ['/demo-request', 'Marketing', 'Demo request', 'Guest'],
  ['/privacy', 'Marketing', 'Privacy', 'Guest'],
  ['/privacy-policy', 'Marketing', 'Privacy policy alias', 'Guest'],
  ['/refund-policy', 'Marketing', 'Refund policy', 'Guest'],
  ['/policies', 'Marketing', 'Policies', 'Guest'],
  ['/subscription-returns', 'Marketing', 'Subscription returns', 'Guest'],
  ['/sitemap', 'Marketing', 'Sitemap page', 'Guest'],
  ['/restaurant-signup', 'Marketing', 'Restaurant signup CTA', 'Guest'],
  ['/order-path/table-orders', 'Marketing', 'Order path tables', 'Guest'],
  ['/order-path/click-and-collect', 'Marketing', 'Click and collect', 'Guest'],
  ['/order-path/curbside-pickup', 'Marketing', 'Curbside', 'Guest'],
  ['/order-path/customer-facing-delivery', 'Marketing', 'Delivery path', 'Guest'],
  ['/order-path/mobile-ordering-application', 'Marketing', 'Mobile ordering', 'Guest'],
  ['/payment', 'SaaS billing', 'Choose plan pay', 'Owner'],
  ['/payment/success', 'SaaS billing', 'Payment success', 'Owner'],
  ['/login', 'Auth UI', 'Login', 'Guest'],
  ['/register', 'Auth UI', 'Register', 'Guest'],
  ['/role', 'Auth UI', 'Pick OWNER/WORKER', 'Google user'],
  ['/reset-password', 'Auth UI', 'Reset password', 'Guest'],
  ['/onboarding/1', 'Auth UI', 'Onboarding step 1', 'Pending owner'],
  ['/onboarding/2', 'Auth UI', 'Onboarding step 2', 'Pending owner'],
  ['/onboarding/3', 'Auth UI', 'Onboarding step 3', 'Pending owner'],
  ['/invite/restaurant', 'Auth UI', 'Accept invite', 'Invited'],
  ['/dashboard', 'Dashboard UI', 'Overview', 'Owner'],
  ['/sales', 'Dashboard UI', 'Sales', 'Staff'],
  ['/pos', 'POS UI', 'POS register', 'Cashier'],
  ['/kds', 'KDS UI', 'KDS manager', 'Kitchen'],
  ['/kds-screen', 'KDS UI', 'KDS kitchen screen', 'Kitchen'],
  ['/order-display', 'KDS UI', 'Customer order display', 'Staff'],
  ['/branched', 'Dashboard UI', 'Branches', 'Owner'],
  ['/tables', 'Dashboard UI', 'Tables', 'Owner'],
  ['/categories', 'Dashboard UI', 'Categories', 'Menu editor'],
  ['/variations', 'Dashboard UI', 'Variations', 'Menu editor'],
  ['/product', 'Dashboard UI', 'Products list', 'Menu editor'],
  ['/product/create', 'Dashboard UI', 'Create product', 'Menu editor'],
  ['/product/edit/[id]', 'Dashboard UI', 'Edit product', 'Menu editor'],
  ['/inventory', 'Dashboard UI', 'Inventory', 'Clerk'],
  ['/inventory/ingredients/create', 'Dashboard UI', 'Create ingredient', 'Clerk'],
  ['/inventory/ingredients/[id]/edit', 'Dashboard UI', 'Edit ingredient', 'Clerk'],
  ['/configurations', 'Dashboard UI', 'Configurations', 'GROWTH owner'],
  ['/recommendations', 'Dashboard UI', 'Recommendations alias', 'GROWTH owner'],
  ['/records', 'Dashboard UI', 'Transactions', 'Staff'],
  ['/records/[id]', 'Dashboard UI', 'Transaction detail', 'Staff'],
  ['/analytics', 'Dashboard UI', 'Analytics hub', 'GROWTH owner'],
  ['/analytics/income', 'Dashboard UI', 'Income', 'GROWTH owner'],
  ['/analytics/product', 'Dashboard UI', 'Product analytics', 'GROWTH owner'],
  ['/analytics/product/sales', 'Dashboard UI', 'Product sales', 'GROWTH owner'],
  ['/analytics/product/favorites', 'Dashboard UI', 'Favorites', 'GROWTH owner'],
  ['/settings', 'Dashboard UI', 'Settings basic/access/payments/billing', 'Owner'],
  ['/settings/payments/stripe', 'Dashboard UI', 'Stripe settings', 'Owner'],
  ['/settings/payments/paypal', 'Dashboard UI', 'PayPal settings', 'Owner'],
  ['/settings/payments/easypaisa', 'Dashboard UI', 'Easypaisa settings', 'Owner'],
  ['/settings/payments/jazzcash', 'Dashboard UI', 'JazzCash settings', 'Owner'],
  ['/settings/paypal/return', 'Dashboard UI', 'PayPal onboard return', 'Owner'],
  ['/no-access', 'Dashboard UI', 'No access card', 'Limited employee'],
  ['/{slug}', 'Storefront UI', 'Menu home', 'Guest'],
  ['/{slug}/orders', 'Storefront UI', 'Customer orders', 'Customer'],
  ['/{slug}/orders/[orderId]', 'Storefront UI', 'Customer order detail', 'Customer'],
  ['/{slug}/track-order', 'Storefront UI', 'Track', 'Guest'],
  ['/order/[type]/[id]', 'Storefront UI', 'Order type page', 'Guest'],
  ['/order/[type]/[id]/cart', 'Storefront UI', 'Cart', 'Guest'],
  ['/order/[type]/[id]/checkout', 'Storefront UI', 'Checkout', 'Guest'],
  ['/order/[type]/[id]/success', 'Storefront UI', 'Order success', 'Guest'],
  ['/track-order', 'Storefront UI', 'Global track', 'Guest'],
  ['/kiosk/[slug]', 'Kiosk UI', 'Pick branch', 'Guest'],
  ['/kiosk/[slug]/[branchId]', 'Kiosk UI', 'Kiosk menu', 'Guest'],
  ['/kiosk/[slug]/[branchId]/success', 'Kiosk UI', 'Kiosk success', 'Guest'],
  ['/mobile-payment/[result]', 'Payments UI', 'Mobile payment result', 'Guest'],
  ['/admin/dashboard', 'Admin UI', 'Admin overview', 'Platform admin'],
  ['/admin/restaurants', 'Admin UI', 'Restaurants', 'Platform admin'],
  ['/admin/subscriptions', 'Admin UI', 'Subscriptions', 'Platform admin'],
  ['/admin/requests', 'Admin UI', 'Demo requests', 'Platform admin'],
  ['/admin/newsletter', 'Admin UI', 'Newsletter', 'Platform admin'],
  ['/admin/blog', 'Admin UI', 'Blog list', 'Platform admin'],
  ['/admin/blog/new', 'Admin UI', 'New blog', 'Platform admin'],
  ['/admin/blog/[id]', 'Admin UI', 'Edit blog', 'Platform admin'],
  ['/admin/faqs', 'Admin UI', 'FAQs', 'Platform admin'],
  ['/admin/documentation', 'Admin UI', 'Docs modules', 'Platform admin'],
  ['/admin/documentation/new', 'Admin UI', 'New doc', 'Platform admin'],
  ['/admin/documentation/headings', 'Admin UI', 'Doc headings', 'Platform admin'],
  ['/admin/seo', 'Admin UI', 'SEO', 'Platform admin'],
  ['/admin/settings', 'Admin UI', 'Platform settings', 'Platform admin'],
];

function buildUi() {
  /** @type {CaseRow[]} */
  const rows = [];
  UI_PAGES.forEach((p, i) => {
    const n = String(i + 1).padStart(3, '0');
    const [url, area, name, actor] = p;
    rows.push(
      c(`UI-${n}-L`, area, `${name} loads`, actor, 'Valid data/session', `Open ${url}`, 'Renders; no blank crash; title/nav correct', url),
    );
  });
  rows.push(
    c('UI-X-01', 'Cross UI', 'Login form validation', 'Guest', '—', 'Submit empty /login', 'Inline errors; no request or 400', '/login'),
    c('UI-X-02', 'Cross UI', 'Toast on API Access Blocked', 'Viewer', 'access only', 'Click Save', 'Toast shows Access Blocked', 'api-error-message'),
    c('UI-X-03', 'Cross UI', 'Loading skeleton/spinner', 'Owner', 'Slow network throttle', 'Open /dashboard and /product', 'Loading state then content', 'SWR/bootstrap'),
    c('UI-X-04', 'Cross UI', 'Empty states', 'New owner', 'No products/orders', 'Open product sales inventory', 'Empty copy not infinite spinner', 'list pages'),
    c('UI-X-05', 'Cross UI', 'Mobile sidebar/sheet', 'Owner', 'Width < 768', 'Open dashboard; toggle nav', 'Sheet opens; pages usable', 'NavbarSheet'),
    c('UI-X-06', 'Cross UI', 'Desktop sidebar collapse', 'Owner', 'Width ≥ 768', 'Toggle sidebar', 'Content reflows', 'toggleNav'),
    c('UI-X-07', 'Cross UI', 'CSV import wizard steps', 'Menu editor', 'product:edit', 'Open import; map columns; preview; import', 'Wizard completes; products appear', 'product-csv-import-wizard'),
    c('UI-X-08', 'Cross UI', 'POS modes switch', 'Cashier', 'pos', 'new / tables / delivery / takeaway / queue', 'UI mode changes; required fields appear', 'OrderMode'),
    c('UI-X-09', 'Cross UI', 'KDS tickets readable on kitchen display', 'Kitchen', 'Tickets exist', 'Open /kds-screen', 'Large type; status colors', 'kds-kitchen-screen'),
    c('UI-X-10', 'Cross UI', 'Order display from 2m away', 'Staff', 'making + completed', 'Open /order-display', 'Preparing vs ready clear', 'order-display'),
    c('UI-X-11', 'Cross UI', 'Storefront cart qty +/-', 'Guest', 'Item in cart', 'Change qty', 'Totals update', 'cart page'),
    c('UI-X-12', 'Cross UI', 'Checkout disabled until required fields', 'Guest', 'delivery', 'Leave address empty', 'Pay disabled or error', 'checkout validation'),
    c('UI-X-13', 'Cross UI', 'Settings section tabs', 'Owner', 'GROWTH', 'basic access payments billing', 'Section content switches', 'SETTINGS_SECTIONS'),
    c('UI-X-14', 'Cross UI', 'No-access copy', 'Limited employee', '—', 'Open /no-access', 'Contact admin message', '/no-access'),
    c('UI-X-15', 'Cross UI', 'i18n language if available', 'Guest', 'i18n', 'Switch language', 'Labels change', 'i18next'),
    c('UI-X-16', 'Cross UI', 'Dark/light if theme toggle exists', 'Staff', '—', 'Toggle theme', 'Readable contrast', 'next-themes'),
    c('UI-X-17', 'Cross UI', 'Expired subscription banner', 'Expired owner', 'trial ended', 'Open dashboard', 'Redirect pricing + toast', 'subscriptionAllowed'),
    c('UI-X-18', 'Cross UI', 'Branch switcher only owner/admin', 'Cashier vs Owner', '2 branches', 'Compare header', 'Cashier no switcher', 'canSwitchBranch'),
    c('UI-X-19', 'Cross UI', 'Images broken fallback', 'Guest', 'Missing image', 'Open menu item', 'Placeholder not broken icon loop', 'image routes'),
    c('UI-X-20', 'Cross UI', 'Admin sidebar groups', 'Platform admin', '—', 'Open /admin', 'Overview Management System groups', 'ADMIN_NAV_GROUPS'),
  );
  return rows;
}

function buildFullSystem() {
  return [
    c('E2E-01', 'Journey', 'Owner signup → menu → POS cash → KDS → display → sales → stock', 'Owner', 'Fresh GROWTH', 'Onboard; create category/product/recipe; POS sale; complete KDS; check sales+inventory', 'All consistent; stock deducted; revenue counts', 'multi-module'),
    c('E2E-02', 'Journey', 'Table dine-in full cycle', 'Cashier', 'Tables', 'Open; send kitchen; add course; pay; complete KDS', 'One order; table free; tickets closed', 'table-orders'),
    c('E2E-03', 'Journey', 'Kiosk dine-in cash', 'Guest+cashier', 'Kiosk+POS', 'Kiosk cash; POS pending cash; pay; KDS', 'Paid kitchen ticket', 'kiosk pending-cash'),
    c('E2E-04', 'Journey', 'Kiosk take-away card', 'Guest', 'Stripe/PayPal', 'Pay on kiosk; success page; KDS', 'Completed payment + ticket', 'kiosk + payments'),
    c('E2E-05', 'Journey', 'Online delivery Stripe', 'Guest', 'Stripe', 'Menu cart checkout pay webhook track', 'Order ONLINE delivery; kitchen; track works', 'customer/orders + stripe'),
    c('E2E-06', 'Journey', 'Online pickup JazzCash', 'Guest', 'WALLETS', 'Pickup + JazzCash return', 'Paid pickup order', 'jazzcash return'),
    c('E2E-07', 'Journey', 'Online Easypaisa fail then retry', 'Guest', 'WALLETS', 'Fail return; pay again', 'One successful payment', 'idempotency'),
    c('E2E-08', 'Journey', 'Logged-in customer reorder history', 'Customer', 'Prior paid order', 'Login; orders; open detail', 'Matches fulfillment snapshot', 'me/orders'),
    c('E2E-09', 'Journey', 'Cashier RBAC cannot edit menu mid-shift', 'Cashier', 'pos+sales', 'Sell; open /product', 'Sale OK; product no-access', 'RBAC'),
    c('E2E-10', 'Journey', 'Invite cashier → accept → POS only', 'Owner+new user', 'GROWTH', 'Invite custom role; accept; login POS', 'Only POS/sales modules', 'invite + RBAC'),
    c('E2E-11', 'Journey', 'STARTER vs GROWTH feature split', 'Two owners', 'Both restaurants', '2nd branch; logo; recommendation; analytics', 'STARTER denied; GROWTH OK', 'plan matrix'),
    c('E2E-12', 'Journey', 'Trial expires during open shift', 'Owner', 'Expire trial', 'Use POS then dashboard', 'Ops blocked per access rules; pricing redirect', 'subscription-access'),
    c('E2E-13', 'Journey', 'CSV catalog bootstrap then storefront', 'Menu editor', 'Export template', 'Import products; open /{slug}', 'Items visible to guests', 'import + customer menu'),
    c('E2E-14', 'Journey', 'Two restaurants isolation', 'Owner A+B', 'Two tenants', 'Place orders both; inspect lists', 'No cross data', 'tenant scope'),
    c('E2E-15', 'Journey', 'Same email customer on two restaurants', 'Guest', 'Two slugs', 'Register/order both', 'Separate accounts and history', 'CustomerAccount unique'),
    c('E2E-16', 'Journey', 'Admin publishes blog/FAQ/docs', 'Platform admin', '—', 'Create publish; view public pages', 'Public only published content', 'admin CMS'),
    c('E2E-17', 'Journey', 'PayPal partner onboard then guest pay', 'Owner+guest', 'PayPal partner', 'Onboard; guest checkout', 'permissionsGranted + capture', 'paypal onboard'),
    c('E2E-18', 'Journey', 'Realtime POS + KDS + order-display', '3 browsers', 'SSE', 'Place POS', 'All three update live', 'realtime/stream'),
    c('E2E-19', 'Journey', 'Offline POS then online flush', 'Cashier', 'Network down', 'Cash sale offline; reconnect', 'One order; stock/KDS catch up', 'outbox'),
    c('E2E-20', 'Journey', 'Remove employee loses access immediately after refresh', 'Owner+cashier', '—', 'DELETE employee; cashier refresh', 'No dashboard', 'Employee deleted'),
    c('E2E-21', 'Journey', 'Accept invite leaves previous restaurant', 'Worker', 'Member of A; invite B', 'Accept B', 'Only B member', 'INV-09'),
    c('E2E-22', 'Journey', 'Mobile wallet + mobile-payment result page', 'Guest', 'JazzCash/Easypaisa', 'Pay on phone; land /mobile-payment/[result]', 'Success/fail UI matches payment', 'mobile-payment page'),
    c('E2E-23', 'Journey', 'Subdomain storefront full order', 'Guest', 'slug.localhost', 'Browse cart checkout', 'Rewrite works; order created', 'middleware subdomain'),
    c('E2E-24', 'Journey', 'Legacy /web-app URL still orders', 'Guest', 'Old bookmark', 'Open /web-app/{slug}/...', '308 then order flow', 'legacy redirect'),
    c('E2E-25', 'Journey', 'Platform admin changes plan; restaurant features change', 'Admin+owner', 'STARTER', 'Admin PATCH to GROWTH; owner retry recs', 'Recommendations unlock', 'admin subscriptions'),
  ];
}

function styleHeader(sheet) {
  const row = sheet.getRow(1);
  row.height = 22;
  HEADERS.forEach((_, i) => {
    const cell = row.getCell(i + 1);
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: HEADERS.length },
  };
  COL_WIDTHS.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
}

function addDropdown(cell, list) {
  cell.dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: [`"${list}"`],
    showErrorMessage: true,
    errorStyle: 'stop',
    errorTitle: 'Invalid value',
    error: 'Pick a value from the dropdown.',
    showDropDown: true,
  };
}

function paintResultRules(sheet, lastRow) {
  if (lastRow < 2) return;
  sheet.addConditionalFormatting({
    ref: `I2:I${lastRow}`,
    rules: [
      {
        type: 'containsText',
        operator: 'containsText',
        text: 'Pass',
        priority: 1,
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFC6EFCE' } },
          font: { color: { argb: 'FF006100' }, bold: true },
        },
      },
      {
        type: 'containsText',
        operator: 'containsText',
        text: 'Fail',
        priority: 2,
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } },
          font: { color: { argb: 'FF9C0006' }, bold: true },
        },
      },
      {
        type: 'containsText',
        operator: 'containsText',
        text: 'Blocked',
        priority: 3,
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFEB9C' } },
          font: { color: { argb: 'FF9C5700' }, bold: true },
        },
      },
    ],
  });
  sheet.addConditionalFormatting({
    ref: `J2:J${lastRow}`,
    rules: [
      {
        type: 'containsText',
        operator: 'containsText',
        text: CHECK_TICKED,
        priority: 1,
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFC6EFCE' } },
          font: { color: { argb: 'FF006100' }, bold: true },
        },
      },
    ],
  });
  sheet.addConditionalFormatting({
    ref: `K2:K${lastRow}`,
    rules: [
      {
        type: 'containsText',
        operator: 'containsText',
        text: CHECK_TICKED,
        priority: 1,
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } },
          font: { color: { argb: 'FF9C0006' }, bold: true },
        },
      },
    ],
  });
}

function fillCases(sheet, cases) {
  sheet.columns = HEADERS.map((header, i) => ({
    header,
    key: String(i),
    width: COL_WIDTHS[i],
  }));
  styleHeader(sheet);
  cases.forEach((rowVals, idx) => {
    const row = sheet.getRow(idx + 2);
    row.height = 34;
    const values = [...rowVals, 'Not Run', CHECK_EMPTY, CHECK_EMPTY, '', '', ''];
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.alignment = wrapAlign;
      cell.font = { name: 'Calibri', size: 10 };
      if (i >= 8 && i <= 10) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 12 };
      }
      if (idx % 2 === 1 && i < 8) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }
    });
    addDropdown(row.getCell(9), 'Not Run,Pass,Fail,Blocked');
    addDropdown(row.getCell(10), `${CHECK_EMPTY},${CHECK_TICKED}`);
    addDropdown(row.getCell(11), `${CHECK_EMPTY},${CHECK_TICKED}`);
  });
  paintResultRules(sheet, cases.length + 1);
  sheet.pageSetup = {
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    orientation: 'landscape',
    paperSize: 9,
  };
}

function addInstructions(sheet, counts) {
  sheet.getColumn(1).width = 24;
  sheet.getColumn(2).width = 100;
  sheet.mergeCells('A1:B1');
  sheet.getCell('A1').value = 'Foodluk full-system test workbook';
  sheet.getCell('A1').font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF111827' } };

  const lines = [
    ['How to mark', 'Set Result (Not Run / Pass / Fail / Blocked). Tick Approved ☑ only for Pass. Tick Rejected ☑ only for Fail. Never both.'],
    ['Modules', 'Each dashboard module: load, sidebar, no-access, access-only, edit, delete. Plus analytics, admin, storefront, kiosk, marketing.'],
    ['Functionality', 'Business rules: auth, subscription caps, POS/KDS/kiosk/storefront/payments/catalog/inventory math and flows.'],
    ['RBAC', 'Owner vs Admin vs custom roles, invites, branches, plan gating, customer vs staff.'],
    ['Security', 'Authn/authz, tenant isolation, IDOR, webhooks, XSS, uploads, middleware.'],
    ['API', 'One happy-path case per endpoint (method + path) plus shared negatives (401/403/400/plan).'],
    ['UI', 'Every major page load plus cross-UI (mobile, empty, wizard, toasts, theme).'],
    ['Full system', 'End-to-end journeys across modules (highest priority after smoke).'],
    ['Actors', 'Owner GROWTH, Owner STARTER, Admin, Cashier, Kitchen, Viewer, Settings access/edit, empty role, platform admin, customer, second restaurant, guest.'],
    ['Counts', Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join('  |  ')],
  ];

  sheet.getCell('A3').value = 'Topic';
  sheet.getCell('B3').value = 'Instructions';
  sheet.getCell('A3').fill = headerFill;
  sheet.getCell('B3').fill = headerFill;
  sheet.getCell('A3').font = headerFont;
  sheet.getCell('B3').font = headerFont;

  lines.forEach((pair, i) => {
    const r = i + 4;
    sheet.getCell(`A${r}`).value = pair[0];
    sheet.getCell(`B${r}`).value = pair[1];
    sheet.getCell(`A${r}`).font = { bold: true, name: 'Calibri', size: 11 };
    sheet.getCell(`B${r}`).alignment = { wrapText: true, vertical: 'top' };
    sheet.getRow(r).height = 40;
  });
}

function addSummary(sheet, sheets) {
  sheet.getColumn(1).width = 22;
  for (let i = 0; i < sheets.length + 1; i++) sheet.getColumn(i + 2).width = 14;

  sheet.getCell('A1').value = 'Test progress (formulas update as you mark Result)';
  sheet.getCell('A1').font = { size: 16, bold: true };
  sheet.mergeCells('A1:H1');

  const headers = ['Metric', ...sheets.map((s) => s.name), 'Total'];
  headers.forEach((h, i) => {
    const cell = sheet.getCell(3, i + 1);
    cell.value = h;
    cell.fill = headerFill;
    cell.font = headerFont;
  });

  const metrics = [
    ['Total cases', (n) => `COUNTA('${n}'!A2:A${sheets.find((s) => s.name === n).last})`],
    ['Not Run', (n) => `COUNTIF('${n}'!I:I,"Not Run")`],
    ['Pass', (n) => `COUNTIF('${n}'!I:I,"Pass")`],
    ['Fail', (n) => `COUNTIF('${n}'!I:I,"Fail")`],
    ['Blocked', (n) => `COUNTIF('${n}'!I:I,"Blocked")`],
    [`Approved ${CHECK_TICKED}`, (n) => `COUNTIF('${n}'!J:J,"${CHECK_TICKED}")`],
    [`Rejected ${CHECK_TICKED}`, (n) => `COUNTIF('${n}'!K:K,"${CHECK_TICKED}")`],
  ];

  metrics.forEach((m, i) => {
    const r = i + 4;
    sheet.getCell(`A${r}`).value = m[0];
    sheets.forEach((s, si) => {
      sheet.getCell(r, si + 2).value = { formula: m[1](s.name) };
    });
    const start = sheet.getCell(r, 2).address;
    const end = sheet.getCell(r, sheets.length + 1).address;
    sheet.getCell(r, sheets.length + 2).value = { formula: `SUM(${start}:${end})` };
  });

  sheet.getCell('A13').value =
    'Suggested order: Modules smoke → UI page loads → Functionality → API happy paths → RBAC → Security → Full system E2E.';
  sheet.mergeCells('A13:H13');
}

async function main() {
  const modules = buildModules();
  const functionality = buildFunctionality();
  const rbac = buildRbac();
  const security = buildSecurity();
  const api = buildApi();
  const ui = buildUi();
  const e2e = buildFullSystem();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Foodluk QA';
  workbook.created = new Date();

  const counts = {
    Modules: modules.length,
    Functionality: functionality.length,
    RBAC: rbac.length,
    Security: security.length,
    API: api.length,
    UI: ui.length,
    'Full system': e2e.length,
  };

  const instructions = workbook.addWorksheet('Instructions', {
    properties: { tabColor: { argb: 'FF6366F1' } },
  });
  addInstructions(instructions, counts);

  const defs = [
    ['01-Modules', modules, 'FF2563EB'],
    ['02-Functionality', functionality, 'FF059669'],
    ['03-RBAC', rbac, 'FF7C3AED'],
    ['04-Security', security, 'FFDC2626'],
    ['05-API', api, 'FF0891B2'],
    ['06-UI', ui, 'FFD97706'],
    ['07-Full-system', e2e, 'FF0F766E'],
  ];

  const summarySheets = [];
  for (const [name, cases, color] of defs) {
    const ws = workbook.addWorksheet(name, {
      properties: { tabColor: { argb: color } },
    });
    fillCases(ws, cases);
    summarySheets.push({ name, last: cases.length + 1 });
  }

  const summary = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: 'FF111827' } },
  });
  addSummary(summary, summarySheets);

  const fileName = 'Foodluk-Full-System-Test-Cases.xlsx';
  const downloads = path.join(os.homedir(), 'Downloads', fileName);
  const localDir = path.join(process.cwd(), 'docs');
  fs.mkdirSync(localDir, { recursive: true });
  const local = path.join(localDir, fileName);

  await workbook.xlsx.writeFile(downloads);
  await workbook.xlsx.writeFile(local);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`Wrote ${total} cases`);
  console.log(JSON.stringify(counts, null, 2));
  console.log(`Downloads: ${downloads}`);
  console.log(`Project:   ${local}`);
}

await main();
