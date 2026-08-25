/**
 * Generates Foodluk white-box manual test workbook (.xlsx)
 * with Result dropdowns and Approve/Reject checkbox columns.
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

const COL_WIDTHS = [14, 16, 42, 18, 32, 40, 44, 36, 12, 12, 12, 28, 14, 14];

/** @typedef {[string, string, string, string, string, string, string, string]} CaseRow */

/** @type {CaseRow[]} */
const USERS_RBAC = [
  ['USR-01', 'Staff login', 'Owner email login', 'Owner', 'GROWTH restaurant exists', 'Login with owner email/password', 'Dashboard loads; all nav items visible', 'JWT + Employee Owner role'],
  ['USR-02', 'Staff login', 'Wrong password', 'Anyone', 'Valid email', 'Submit wrong password', 'Stay on /login; no session', 'authorize returns null'],
  ['USR-03', 'Staff login', 'Employee limited login', 'Cashier', 'Custom pos+sales role', 'Login as cashier', 'Only POS/Sales in sidebar', 'navItemsForPermissions'],
  ['USR-04', 'Staff login', 'Customer cannot use dashboard', 'Customer', 'CustomerAccount only', 'Open /login then /dashboard', 'No restaurant dashboard (unless they also have a staff User)', 'CustomerAccount ≠ staff User'],
  ['USR-05', 'Staff signup', 'Google new worker', 'New Google user', 'Google OAuth on', 'Sign up as worker', 'Global pending_worker; no restaurant until invite', 'GLOBAL_ROLE_SLUG.PENDING_WORKER'],
  ['USR-06', 'Staff signup', 'Google new owner', 'New Google user', 'Google OAuth on', 'Sign up as OWNER then onboard', 'pending_owner then restaurant created', '/role + onboarding'],
  ['USR-07', 'Staff users', 'New employee weak password', 'Owner', 'settings:edit', 'Create user with 7-char password', '400; password must be ≥ 8', 'isStrongPassword'],
  ['USR-08', 'Staff users', 'Duplicate staff on same restaurant', 'Owner', 'User already employee', 'Invite same email again', '409 already part of this restaurant', 'unique userId_restaurantId'],
  ['USR-09', 'Staff login', 'Logout then protected route', 'Staff', 'Logged in', 'Logout; open /pos', 'Redirect /login?callbackUrl=', 'middleware needsAuth'],
  ['USR-10', 'Staff login', 'Empty permissions account', 'Empty-role employee', 'Custom role with no tokens', 'Login', 'Message: no dashboard permissions returned', '(root)/layout permissions.length === 0'],
  ['USR-11', 'Platform admin', 'Admin can open /admin', 'Platform admin', 'Email in ADMIN_EMAIL(S)', 'Open /admin/dashboard', 'Admin console loads', 'isPlatformAdmin'],
  ['USR-12', 'Platform admin', 'Restaurant owner blocked from /admin', 'Owner', 'Not in ADMIN_EMAILS', 'Open /admin/dashboard', 'Redirect to /', 'middleware admin gate'],
  ['TEAM-01', 'Team', 'List team with access', 'Settings viewer', 'settings:access only', 'Open Settings → User access', 'Sees employees + pending invites', 'GET /api/restaurant/employees'],
  ['TEAM-02', 'Team', 'List team denied', 'Cashier', 'No settings permission', 'Open /settings', 'Redirect /no-access', 'layout moduleKeyForPath'],
  ['TEAM-03', 'Team', 'Create brand-new user', 'Owner', 'settings:edit', 'Name + email + password + Admin role', 'flow user_created; user can login', 'POST employees; User.roleId=pending_worker'],
  ['TEAM-04', 'Team', 'New user missing name', 'Owner', 'Email not in DB', 'Submit without name', '400 name required', 'postSchema / name check'],
  ['TEAM-05', 'Team', 'New user missing password', 'Owner', 'Email not in DB', 'Submit without password', '400 password required', 'isStrongPassword'],
  ['TEAM-06', 'Team', 'Invite existing account', 'Owner', 'Email already a User', 'Invite without creating password', 'flow invite_sent; Employee not created yet', 'EmployeeInvite PENDING 7 days'],
  ['TEAM-07', 'Team', 'Duplicate pending invite', 'Owner', 'Pending invite exists', 'Invite same email again', '409 invitation already pending', 'findFirst PENDING'],
  ['TEAM-08', 'Team', 'Invite with SMTP off', 'Owner', 'SMTP not configured', 'Invite existing user', 'Invite saved; manualInviteUrl returned', 'emailDelivered false'],
  ['TEAM-09', 'Team', 'Invite email send failure', 'Owner', 'SMTP fails', 'Invite existing user', 'Invite deleted; 502', 'rollback invite row'],
  ['TEAM-10', 'Team', 'Cannot invite as Owner role', 'Owner', 'Owner role id', 'Select Owner on invite', '400 Owner role cannot be assigned through invites', 'assertAssignableRestaurantRole'],
  ['TEAM-11', 'Team', 'Custom role requires branch', 'Owner', 'GROWTH; custom role', 'Invite cashier with empty branchIds', '400 Select a branch for this team member', 'non-Admin must have branchIds'],
  ['TEAM-12', 'Team', 'Admin invite without branch', 'Owner', 'Admin preset role', 'Invite Admin; no branches', 'Allowed (all branches)', 'isAdminRole exempt'],
  ['TEAM-13', 'Team', 'Invite needs settings:edit', 'Settings viewer', 'settings:access only', 'Submit invite', '403 Access Blocked', 'POST action edit'],
  ['TEAM-14', 'Team', 'Employees pagination', 'Owner', 'Many employees', 'GET ?page=1', 'pagination meta; default page size 20', 'parsePaginationParams'],
  ['INV-01', 'Invite', 'Verify valid token', 'Anyone', 'PENDING unexpired invite', 'GET /api/restaurant/invites/verify?token=', 'Returns restaurantName roleName email', 'verify route'],
  ['INV-02', 'Invite', 'Verify missing token', 'Anyone', '—', 'GET verify without token', '400 Missing token', 'verify route'],
  ['INV-03', 'Invite', 'Verify used token', 'Anyone', 'Invite ACCEPTED/DECLINED', 'GET verify', '404 Invalid or already handled', 'status !== PENDING'],
  ['INV-04', 'Invite', 'Verify expired token', 'Anyone', 'expiresAt in the past', 'GET verify', '410 invitation has expired', 'expiresAt check'],
  ['INV-05', 'Invite', 'Accept while logged out', 'Guest', 'Valid token', 'POST /api/restaurant/invites/accept', '401 Unauthorized', 'getAppSession required'],
  ['INV-06', 'Invite', 'Accept with wrong email', 'Other staff', 'Logged in as different email', 'POST accept', '403 sign in with invited email', 'case-insensitive email match'],
  ['INV-07', 'Invite', 'Accept correct email', 'Invited user', 'Logged in as invited email', 'Accept invite', 'Employee created; invite ACCEPTED; branches synced', 'accept route + syncEmployeeBranches'],
  ['INV-08', 'Invite', 'Accept when already member', 'Invited user', 'Already employee', 'Accept again', 'alreadyMember true; invite ACCEPTED', 'existing Employee'],
  ['INV-09', 'Invite', 'One restaurant only', 'Employee of A', 'Pending invite to restaurant B', 'Accept B invite', 'Removed from A; other pending invites DECLINED', 'deleteMany other employees'],
  ['INV-10', 'Invite', 'Cancel invite', 'Owner', 'settings:delete', 'DELETE /api/restaurant/invites/[id]', 'Link stops working (404)', 'DELETE settings:delete'],
  ['INV-11', 'Invite', 'Cancel with edit-only', 'Settings editor', 'settings:edit no delete', 'Cancel invite', '403 Access Blocked', 'DELETE action delete'],
  ['INV-12', 'Invite', 'Invite landing page', 'Invited user', 'Valid token', 'Open /invite/restaurant?token=', 'Shows restaurant + Accept', 'verify then accept UI'],
  ['EMP-01', 'Employee', 'Change Admin to Cashier', 'Owner', 'Admin employee exists', 'PATCH roleId to cashier', 'Nav/APIs become cashier-only after bootstrap', 'GET /api/me/bootstrap'],
  ['EMP-02', 'Employee', 'Promote cashier to Admin', 'Owner', 'Cashier exists', 'PATCH to Admin role', 'Full dashboard nav', 'Admin preset = all tokens'],
  ['EMP-03', 'Employee', 'Assign Owner role to non-owner', 'Owner', 'Cashier exists', 'PATCH roleId to Owner', '403 Only the restaurant owner can have the Owner role', 'employees/[id] PATCH'],
  ['EMP-04', 'Employee', 'Demote account owner', 'Admin/Owner', 'Target is restaurant.ownerId', 'Change owner off Owner role', '403 owner must stay on the Owner role', 'employees/[id] PATCH'],
  ['EMP-05', 'Employee', 'Owner ignores stale role permissions', 'Owner', 'Owner role tokens emptied in DB', 'Refresh dashboard', 'Owner still has all modules', 'getEffectiveDashboardPermissionNames ownerId===userId'],
  ['EMP-06', 'Employee', 'Preset Owner slug also full access', 'Owner-slug employee', 'role.slug=owner', 'Load permissions', 'All dashboard tokens', 'slug === owner returns full'],
  ['EMP-07', 'Employee', 'Assign cashier to Branch 2 only', 'Owner/Admin', '2+ branches', 'PATCH branchIds=[B2]', 'POS/KDS/tables scoped to B2; no branch switcher', 'resolveBranchScope canSwitchBranch false'],
  ['EMP-08', 'Employee', 'Non-admin cannot change branches', 'Custom settings:edit', 'Not owner/admin', 'PATCH branchIds', '403 Only admins can change branch assignments', 'userIsOwnerOrAdmin'],
  ['EMP-09', 'Employee', 'Cannot assign branches to owner', 'Admin', 'Owner employee', 'PATCH owner branchIds', '400 Owner has access to all branches', 'employees/[id] PATCH'],
  ['EMP-10', 'Employee', 'Owner/Admin branch switcher', 'Owner', '2+ branches', 'Use header switcher', 'Cookie rs_branch_{restaurantId} updates', 'canSwitchBranch true'],
  ['EMP-11', 'Employee', 'Staff cannot forge other branch cookie', 'Cashier on B1', 'Cookie set to B2', 'Reload POS/sales', 'Still B1 (assigned branch)', 'preferred branch ignored unless owner/admin'],
  ['EMP-12', 'Employee', 'Remove employee', 'Owner', 'settings:delete', 'DELETE employee', '200; user loses restaurant dashboard', 'Employee deleted'],
  ['EMP-13', 'Employee', 'Cannot remove owner', 'Owner/Admin', 'Owner employee row', 'DELETE owner', '403 cannot be removed from the team', 'ownerId guard'],
  ['EMP-14', 'Employee', 'Remove with edit-only', 'Settings editor', 'settings:edit no delete', 'DELETE employee', '403', 'action delete'],
  ['EMP-15', 'Employee', 'Wrong restaurant employeeId', 'Owner A', 'employeeId from restaurant B', 'DELETE that id', '404 Employee not found', 'scoped restaurantId'],
  ['ROLE-01', 'Roles', 'List restaurant roles', 'Owner', 'settings:access', 'GET /api/restaurant/roles', 'Owner Admin + customs', 'GET roles'],
  ['ROLE-02', 'Roles', 'Create custom role', 'Owner', 'GROWTH', 'POST name Cashier tokens pos:access sales:access', '201; tokens normalized', 'POST roles + normalizeDashboardPermissions'],
  ['ROLE-03', 'Roles', 'Create role on STARTER', 'STARTER owner', 'STARTER plan', 'POST custom role', '403 Custom roles and permission presets', 'roleBasedSettings false'],
  ['ROLE-04', 'Roles', 'Invalid tokens dropped', 'Owner', 'GROWTH', 'POST foo:bar and product:edit', 'Only product:access + product:edit stored', 'normalizeDashboardPermissions'],
  ['ROLE-05', 'Roles', 'Delete implies edit+access', 'Owner', 'GROWTH', 'Enable product:delete', 'Stores product:access edit delete', 'toggleModuleAction'],
  ['ROLE-06', 'Roles', 'Access off clears edit+delete', 'Owner', 'GROWTH', 'Disable product:access', 'edit+delete cleared', 'toggleModuleAction'],
  ['ROLE-07', 'Roles', 'Edit off clears delete', 'Owner', 'GROWTH', 'Disable product:edit', 'delete cleared; access can remain', 'toggleModuleAction'],
  ['ROLE-08', 'Roles', 'Rename role', 'Owner', 'Custom role', 'PATCH name', 'Name updates', 'PATCH roles/[id]'],
  ['ROLE-09', 'Roles', 'Change permissions on STARTER', 'STARTER owner', 'STARTER', 'PATCH permissions', '403 Per-role dashboard permissions', 'plan gate on permissions field'],
  ['ROLE-10', 'Roles', 'Empty PATCH', 'Owner', 'Valid role', 'PATCH with no name/permissions', '400 Nothing to update', 'patchSchema'],
  ['ROLE-11', 'Roles', 'Delete unused custom role', 'Owner', 'settings:delete; unused', 'DELETE role', '200', 'DELETE roles/[id]'],
  ['ROLE-12', 'Roles', 'Cannot delete Owner/Admin presets', 'Owner', 'Preset role', 'DELETE owner or admin', '403 Preset roles cannot be deleted', 'slug owner/admin'],
  ['ROLE-13', 'Roles', 'Cannot delete role in use', 'Owner', 'Cashier assigned', 'DELETE cashier role', '409 with employee count', 'employee.count'],
  ['ROLE-14', 'Roles', 'Other restaurant roleId', 'Owner A', 'roleId from B', 'PATCH/DELETE', '404 Role not found', 'restaurantId scope'],
  ['ROLE-15', 'Roles', 'Legacy orders:* grants Sales', 'Cashier', 'Role has orders:access only', 'Open /sales', 'Sales nav/page allowed', 'SALES_MODULE_ALIASES'],
  ['RBAC-A-POS', 'RBAC matrix', 'POS access only cannot mutate', 'Cashier access-only', 'pos:access only', 'Open /pos; try place order', 'Page OK; mutating API 403', 'pos:edit required'],
  ['RBAC-E-POS', 'RBAC matrix', 'POS edit implies access', 'POS editor', 'pos:edit only in DB', 'Open /pos', 'Page opens (implied access)', 'normalize + canAccessDashboardModule'],
  ['RBAC-D-POS', 'RBAC matrix', 'POS delete implies edit+access', 'POS manager', 'pos:delete only', 'View + pay + cancel', 'All POS actions allowed', 'delete⇒edit⇒access'],
  ['RBAC-N-POS', 'RBAC matrix', 'No POS token', 'Kitchen', 'No pos:*', 'Open /pos', 'Redirect /no-access', 'layout allowedModuleKeys'],
  ['RBAC-A-PRODUCT', 'RBAC matrix', 'Product access only', 'Viewer', 'product:access only', 'Open /product; try create', 'List OK; POST 403', 'product:edit'],
  ['RBAC-N-PRODUCT', 'RBAC matrix', 'No product token', 'Cashier', 'No product:*', 'Open /product', 'Redirect /no-access', 'layout guard'],
  ['RBAC-A-SETTINGS', 'RBAC matrix', 'Settings access cannot invite', 'Viewer', 'settings:access only', 'Open Access; submit invite', 'UI may show; POST 403', 'settings:edit'],
  ['RBAC-E-SETTINGS', 'RBAC matrix', 'Settings edit cannot delete user', 'Editor', 'settings:edit no delete', 'Invite OK; remove employee', 'DELETE 403', 'settings:delete'],
  ['RBAC-N-SETTINGS', 'RBAC matrix', 'No settings token', 'Cashier', 'No settings:*', 'Open /settings', 'Redirect /no-access', 'layout'],
  ['RBAC-NAV', 'RBAC matrix', 'Sidebar hides unauthorized modules', 'Cashier', 'pos+sales only', 'View sidebar', 'Only POS and Sales (and dashboard exception)', 'navItemsForPermissions'],
  ['RBAC-DASH', 'RBAC matrix', '/dashboard exception', 'No dashboard token', 'Missing dashboard:*', 'Open /dashboard', 'Not sent to /no-access (path skipped)', "layout pathname==='/dashboard'"],
  ['RBAC-STARTER-REC', 'RBAC matrix', 'STARTER hides Configurations nav', 'STARTER owner', 'recommendations false', 'View sidebar', 'Configurations hidden even if role has tokens', 'hideRecommendations'],
  ['RBAC-SALES', 'RBAC matrix', 'Sales access', 'Cashier', 'sales:access', 'Open /sales', 'List orders; writes 403 if no edit', 'sales module'],
  ['RBAC-KDS', 'RBAC matrix', 'KDS access', 'Kitchen', 'kds:access', 'Open /kds', 'Tickets visible', 'kds module'],
  ['RBAC-KDS-N', 'RBAC matrix', 'KDS denied', 'Cashier', 'No kds:*', 'Open /kds', 'Redirect /no-access', 'layout'],
  ['RBAC-OD', 'RBAC matrix', 'Order display', 'Kitchen', 'order-display:access', 'Open /order-display', 'Screen loads', 'order-display module'],
  ['RBAC-BRANCH', 'RBAC matrix', 'Branches access vs edit', 'Host', 'branched:access only', 'Open /branched; create branch', 'List OK; POST 403', 'branched:edit'],
  ['RBAC-TABLES', 'RBAC matrix', 'Tables access vs delete', 'Host', 'tables:access only', 'Delete table', '403', 'tables:delete'],
  ['RBAC-CAT', 'RBAC matrix', 'Categories CRUD', 'Menu editor', 'categories:*', 'Create/edit/delete category', 'All succeed', 'categories APIs'],
  ['RBAC-VAR', 'RBAC matrix', 'Variations CRUD', 'Menu editor', 'variations:*', 'Create/edit/delete', 'All succeed', 'variations APIs'],
  ['RBAC-INV', 'RBAC matrix', 'Inventory clerk', 'Inventory', 'inventory:* only', 'Stock in/out; open /product', 'Inventory OK; product no-access', 'module isolation'],
  ['RBAC-REC', 'RBAC matrix', 'Recommendations GROWTH', 'Menu editor', 'recommendations:*; GROWTH', 'Open /configurations', 'Allowed', 'recommendations module'],
  ['RBAC-REC-API', 'RBAC matrix', 'Recommendation API STARTER', 'STARTER', 'Any role', 'POST attribute group', '403 plan denied', 'subscriptionPlanDeniedResponse'],
  ['RBAC-FIN', 'RBAC matrix', 'Records access', 'Viewer', 'records:access', 'Open /records', 'History visible', 'records module'],
  ['PROF-01', 'Role profile', 'Cashier E2E', 'Cashier', 'pos+sales role', 'POS sale then open /product', 'Sale OK; product no-access', 'profile'],
  ['PROF-02', 'Role profile', 'Kitchen E2E', 'Kitchen', 'kds+order-display', 'Complete ticket then open /pos', 'KDS OK; POS no-access', 'profile'],
  ['PROF-03', 'Role profile', 'Menu editor E2E', 'Menu editor', 'catalog modules', 'Create product; open /settings', 'Catalog OK; settings no-access', 'profile'],
  ['PROF-04', 'Role profile', 'Viewer E2E', 'Viewer', 'all :access only', 'Open pages; click Save', 'GET 200; PATCH 403', 'profile'],
  ['PROF-05', 'Role profile', 'Role change without re-login', 'Cashier→Kitchen', 'Change role while logged in', 'Refresh / bootstrap', 'Nav and APIs match new role', '/api/me/bootstrap'],
  ['PLAN-01', 'Plan gating', 'STARTER hides Access UI', 'STARTER owner', 'STARTER', 'Open Settings', 'Access section hidden/redirected to Basic', 'setting.tsx roleBasedSettings'],
  ['PLAN-02', 'Plan gating', 'STARTER cannot create custom role', 'STARTER owner', 'STARTER', 'POST /api/restaurant/roles', '403', 'roleBasedSettings'],
  ['PLAN-03', 'Plan gating', 'STARTER cannot invite custom role', 'STARTER owner', 'Cashier role exists leftover', 'Invite cashier', '403 Inviting team members with custom roles', 'only Admin slug allowed'],
  ['PLAN-04', 'Plan gating', 'STARTER can invite Admin via API', 'STARTER owner', 'Admin role', 'POST employee Admin', 'Allowed by API', 'slug===admin'],
  ['PLAN-05', 'Plan gating', 'STARTER cannot assign custom role', 'STARTER owner', 'Existing cashier', 'PATCH to custom role', '403', 'Assigning custom roles…'],
  ['PLAN-06', 'Plan gating', 'STARTER cannot PATCH role permissions', 'STARTER owner', 'Admin/Owner role', 'PATCH permissions array', '403', 'plan gate'],
  ['PLAN-07', 'Plan gating', 'Upgrade GROWTH unlocks roles', 'Former STARTER', 'Upgraded', 'Create Cashier + invite', 'Works', 'roleBasedSettings true'],
  ['PLAN-08', 'Plan gating', 'Downgrade STARTER leftover cashiers', 'GROWTH→STARTER', 'Cashiers exist', 'Cashiers still login; Access UI hidden; cannot create new customs', 'Leftover employees keep tokens'],
  ['OWN-01', 'Owner vs Admin', 'Account owner always full', 'Owner', 'Even if role tokens stale', 'Use all modules', 'All allowed', 'ownerId short-circuit'],
  ['OWN-02', 'Owner vs Admin', 'Preset Admin is full via role rows', 'Admin employee', 'Not ownerId', 'Use all modules', 'Full nav', 'seeded full permissions'],
  ['OWN-03', 'Owner vs Admin', 'Strip Admin role in DB', 'Admin', 'Permissions emptied', 'Refresh', 'Admin loses modules (unlike owner)', 'uses role.permissions'],
  ['OWN-04', 'Owner vs Admin', 'Admin cannot remove owner', 'Admin', 'settings:delete', 'DELETE owner', '403', 'owner guard'],
  ['OWN-05', 'Owner vs Admin', 'Admin can invite/remove cashiers', 'Admin', 'Preset Admin', 'Invite and remove cashier', 'Succeeds', 'full settings tokens'],
  ['OWN-06', 'Owner vs Admin', 'Admin can switch all branches', 'Admin', '2+ branches', 'Switcher in header', 'All branches listed', 'userIsOwnerOrAdmin'],
  ['OWN-07', 'Owner vs Admin', 'Almost-admin without settings', 'Custom full except settings', 'No settings:*', 'Open Access UI', '/settings → no-access', 'RBAC'],
  ['CUS-01', 'Customer users', 'Register on storefront', 'Guest', 'Restaurant slug', 'Register email/password', 'CustomerAccount created for that restaurant', 'unique restaurantId+emailNormalized'],
  ['CUS-02', 'Customer users', 'Same email two restaurants', 'Guest', 'Two restaurants', 'Register same email on both', 'Two separate accounts', 'composite unique'],
  ['CUS-03', 'Customer users', 'Customer Google login', 'Guest', 'Google customer OAuth', 'Login on storefront', 'customer-auth/google; not staff dashboard', 'middleware rewrite callback'],
  ['CUS-04', 'Customer users', 'Customer opens /dashboard', 'Customer', 'No staff User', 'Open /dashboard', 'Redirect /login', 'middleware'],
  ['CUS-05', 'Customer users', 'Disabled customer', 'Customer', 'disabledAt set', 'Login', 'Login fails', 'disabledAt'],
  ['CUS-06', 'Customer users', 'Guest vs logged-in order owner', 'Guest then customer', 'Place both orders', 'Guest customerAccountId null; logged-in set', 'Order model', 'Order.customerAccountId'],
  ['CUS-07', 'Customer users', 'Customer cannot list employees', 'Customer session', 'Call GET /api/restaurant/employees', '401/403', 'staff session required'],
  ['SEC-U-01', 'Security', 'Unauthenticated GET employees', 'Guest', '—', 'GET /api/restaurant/employees', '401', 'require session'],
  ['SEC-U-02', 'Security', 'Cannot list other restaurant team', 'Owner A', 'Restaurant B exists', 'GET employees', 'Only restaurant A rows', 'getRestaurantIdForRequest'],
  ['SEC-U-03', 'Security', 'Forge other restaurant roleId on invite', 'Owner A', 'roleId from B', 'POST invite', '400 Role not found for this restaurant', 'assertAssignableRestaurantRole'],
  ['SEC-U-04', 'Security', 'Forge other restaurant branchIds', 'Owner A', 'branchId from B', 'Invite/PATCH branches', 'Only valid restaurant branches saved', 'syncEmployeeBranches filters'],
  ['SEC-U-05', 'Security', 'Accept someone else invite token', 'Other user', 'Valid token for other email', 'POST accept', '403 wrong email', 'email match'],
  ['SEC-U-06', 'Security', 'Staff session ≠ customer session', 'Both accounts', 'Same browser', 'Logout staff; customer cookie remains independent', 'Separate cookies', 'NextAuth vs CustomerSession'],
];

/** @type {CaseRow[]} */
const FULL_SYSTEM = [
  ['XC-01', 'Cross-cutting', 'Unauthenticated dashboard', 'Guest', '—', 'Open /dashboard /pos /admin', 'Redirect /login?callbackUrl=', 'middleware needsAuth'],
  ['XC-02', 'Cross-cutting', 'Non-admin hits admin', 'Owner', '—', 'Open /admin/dashboard', 'Redirect /', 'isPlatformAdmin'],
  ['XC-03', 'Cross-cutting', 'Missing module permission', 'Employee', 'No product:access', 'Open /product', '/no-access or API Access Blocked', 'permissionName'],
  ['XC-04', 'Cross-cutting', 'Delete implies edit+access', 'Custom role', 'product:delete only', 'Use product module', 'Can view edit delete', 'normalizeDashboardPermissions'],
  ['XC-05', 'Cross-cutting', 'Edit implies access', 'Custom role', 'product:edit only', 'Use product module', 'View+edit; cannot delete', 'same'],
  ['XC-06', 'Cross-cutting', 'Access only', 'Custom role', 'product:access only', 'Create/update/delete', 'Writes 403', 'action edit/delete'],
  ['XC-07', 'Cross-cutting', 'Tenant isolation', 'Owner A', 'Restaurant B ids', 'Hit B resource ids', '404 / Access Blocked', 'getRestaurantForUser'],
  ['XC-08', 'Cross-cutting', 'Branch cookie scope', 'Cashier', 'Assigned Branch 1', 'Switch/forge other branch', 'Other branches hidden; orders scoped', '/api/me/active-branch EmployeeBranch'],
  ['XC-09', 'Cross-cutting', 'Subscription expired', 'Expired owner', 'Trial/period ended', 'Open dashboard', 'Blocked / pricing', 'evaluateSubscriptionAccess'],
  ['XC-10', 'Cross-cutting', 'Plan feature denied', 'STARTER', 'STARTER', 'Save logo or recommendation', '403 plan-denied', 'subscriptionPlanDeniedResponse'],
  ['XC-11', 'Cross-cutting', 'SSE live updates', 'POS+KDS users', 'Two browsers', 'Place POS order', 'KDS updates without refresh', '/api/restaurant/realtime/stream'],
  ['XC-12', 'Cross-cutting', 'Legacy storefront URL', 'Guest', '—', 'Open /web-app/{slug}', '308 redirect', 'legacyWebAppRedirectPath'],
  ['XC-13', 'Cross-cutting', 'Subdomain rewrite', 'Guest', 'slug.localhost', 'Open /', 'Rewrites to /{slug}', 'getSubdomainFromHost'],
  ['XC-14', 'Cross-cutting', 'Customer Google OAuth rewrite', 'Guest', 'Customer Google state', 'Hit /api/auth/callback/google', 'Rewrite to customer-auth callback', 'middleware Google state'],
  ['MKT-01', 'Marketing', 'Landing loads', 'Guest', '—', 'Open /', 'Hero pricing FAQ newsletter', '(saas) routes'],
  ['MKT-02', 'Marketing', 'Newsletter subscribe', 'Guest', '—', 'Submit email', 'Success; duplicate already', 'POST /api/newsletter/subscribe'],
  ['MKT-03', 'Marketing', 'Newsletter invalid email', 'Guest', '—', 'Bad email', 'Validation error', 'same'],
  ['MKT-04', 'Marketing', 'Demo request', 'Guest', '—', 'Submit demo form', 'Saved; appears in /admin/requests', 'POST /api/demo-request'],
  ['MKT-05', 'Marketing', 'Pricing plans', 'Guest', '—', 'Open /pricing', 'STARTER/GROWTH/SCALE features match', 'GET /api/pricing-plans'],
  ['MKT-06', 'Marketing', 'Blog published only', 'Guest', '—', 'Open /blog and slug', 'Published posts only', 'BlogPost'],
  ['MKT-07', 'Marketing', 'Docs nested pages', 'Guest', '—', 'Open documentation tree', 'Headings/modules render', 'DocumentationHeading'],
  ['MKT-08', 'Marketing', 'Contact form', 'Guest', '—', 'Submit contact', 'Success / validation', 'POST /api/contact'],
  ['MKT-09', 'Marketing', 'Legal pages', 'Guest', '—', 'Open privacy refund policies', 'Pages load', 'static saas'],
  ['AUTH-01', 'Auth', 'Email login valid', 'Staff', 'Password ≥ 8', 'Login', 'JWT session dashboard', 'CredentialsProvider'],
  ['AUTH-02', 'Auth', 'Wrong password', 'Staff', 'Valid email', 'Bad password', 'No session', 'authorize null'],
  ['AUTH-03', 'Auth', 'Unknown email', 'Guest', '—', 'Login unknown', 'Same generic fail', 'no enumeration'],
  ['AUTH-04', 'Auth', 'Password too short', 'Guest', '—', '< 8 chars', 'Client+Zod reject', 'credentialsSchema'],
  ['AUTH-05', 'Auth', 'Google existing user', 'Staff', 'Existing email', 'Google login', 'Signs in no new user', 'Google provider'],
  ['AUTH-06', 'Auth', 'Google new user', 'Guest', '—', 'Google login', 'Creates User pending role', 'signIn callback'],
  ['AUTH-07', 'Auth', 'Register OWNER', 'New user', '—', 'Pick owner signup', 'Then onboarding', 'POST /api/auth/signup'],
  ['AUTH-08', 'Auth', 'Register WORKER', 'New user', '—', 'Worker role', 'Wait for invite/role page', 'same'],
  ['AUTH-09', 'Auth', 'Duplicate email register', 'Guest', 'Email exists', 'Signup', 'Error no second user', 'User.email unique'],
  ['AUTH-10', 'Auth', 'Role picker UNKNOW', 'Google user', 'role UNKNOW', 'Open /role pick OWNER/WORKER', 'Role updated', 'POST /api/auth/role'],
  ['AUTH-11', 'Auth', 'Onboarding step 1', 'Pending owner', '—', 'Name slug subdomain', 'Restaurant created', 'POST /api/onboarding/step1'],
  ['AUTH-12', 'Auth', 'Duplicate slug/subdomain', 'Pending owner', 'Taken slug', 'Submit', 'Unique error', 'Restaurant.slug unique'],
  ['AUTH-13', 'Auth', 'Onboarding step 2', 'Pending owner', 'Step 1 done', 'Branch hours slot 15/30/60', 'Branch saved', 'PATCH /api/onboarding/step2'],
  ['AUTH-14', 'Auth', 'Onboarding step 3', 'Pending owner', 'Step 2 done', 'Finish', 'Dashboard; trial subscription', 'POST /api/onboarding/step3'],
  ['AUTH-15', 'Auth', 'Reset password', 'Staff', '—', 'Request and reset', 'Works; expired token fails', 'reset-password'],
  ['AUTH-16', 'Auth', 'Employee invite email', 'Owner', 'settings:edit', 'Invite', 'Pending invite', 'POST /api/restaurant/employees'],
  ['AUTH-17', 'Auth', 'Accept invite logged in', 'Invited', 'Valid token', 'Accept', 'Employee+role+branches', 'POST invites/accept'],
  ['AUTH-18', 'Auth', 'Accept invite new user', 'New', 'Invite to new email', 'Register then accept', 'Linked to restaurant', 'accept'],
  ['AUTH-19', 'Auth', 'Verify invite invalid', 'Guest', 'Bad token', 'Open invite', 'Error', 'GET invites/verify'],
  ['AUTH-20', 'Auth', 'Revoke invite', 'Owner', 'settings:delete', 'Delete pending', 'Accept fails', 'DELETE invites/[id]'],
  ['AUTH-21', 'Auth', 'Logout', 'Staff', 'Logged in', 'Logout', 'Protected routes redirect', 'NextAuth'],
  ['SUB-01', 'Subscription', 'Trial active', 'Owner', 'TRIAL future end', 'Open dashboard', 'Allowed; warning if ≤3 days', 'evaluateSubscriptionAccess TRIAL'],
  ['SUB-02', 'Subscription', 'Trial expired', 'Owner', 'trialEndsAt past', 'Open dashboard', 'Blocked trial_expired', 'same'],
  ['SUB-03', 'Subscription', 'ACTIVE within period', 'Owner', 'ACTIVE', 'Open dashboard', 'Allowed; warning ≤3 days', 'currentPeriodEnd'],
  ['SUB-04', 'Subscription', 'ACTIVE period ended', 'Owner', 'period past', 'Open dashboard', 'subscription_expired', 'periodEndsMs'],
  ['SUB-05', 'Subscription', 'PAST_DUE or CANCELED', 'Owner', 'inactive status', 'Open dashboard', 'inactive_status blocked', 'status not TRIAL/ACTIVE'],
  ['SUB-06', 'Subscription', 'No subscription row', 'Owner', 'null sub', 'Open dashboard', 'no_subscription', 'null input'],
  ['SUB-07', 'Subscription', 'Checkout plans', 'Owner', '—', 'Pay STARTER/GROWTH/SCALE', 'Checkout session', 'stripe/paypal checkout'],
  ['SUB-08', 'Subscription', 'Payment success return', 'Owner', 'Paid', 'Open /payment/success', 'Status ACTIVE period set', 'verify-session'],
  ['SUB-09', 'Subscription', 'Auto-renew on', 'Owner', 'PayPal', 'Enable auto-renew', 'Renews after period', 'PATCH billing/auto-renew'],
  ['SUB-10', 'Subscription', 'Auto-renew off', 'Owner', '—', 'Disable', 'Ends at period no charge', 'same'],
  ['SUB-11', 'Subscription', 'STARTER max 1 branch', 'STARTER', '1 branch', 'Add 2nd', '403', 'maxBranches 1'],
  ['SUB-12', 'Subscription', 'GROWTH max 5 branches', 'GROWTH', '5 branches', 'Add 6th', '403', 'maxBranches 5'],
  ['SUB-13', 'Subscription', 'SCALE unlimited branches', 'SCALE', '—', 'Add many', 'OK', 'Infinity'],
  ['SUB-14', 'Subscription', 'STARTER no branding', 'STARTER', '—', 'Save logo/theme', '403', 'branding false'],
  ['SUB-15', 'Subscription', 'STARTER no custom roles', 'STARTER', '—', 'Create role', '403', 'roleBasedSettings'],
  ['SUB-16', 'Subscription', 'STARTER no recommendations', 'STARTER', '—', 'Add offer/group', '403', 'recommendations'],
  ['SUB-17', 'Subscription', 'STARTER no advanced analytics', 'STARTER', '—', 'Open analytics', 'Gated', 'advancedAnalytics'],
  ['SUB-18', 'Subscription', 'GROWTH unlocks features', 'GROWTH', '—', 'Branding roles recs analytics', 'Work', 'plan matrix'],
  ['DASH-01', 'Dashboard', 'Owner dashboard access', 'Owner', 'dashboard:access', 'Open /dashboard', 'Metrics load', 'dashboard-analytics'],
  ['DASH-02', 'Dashboard', 'Canceled excluded from charts', 'Owner', 'Canceled orders exist', 'View charts', 'Excluded', 'analyticsActiveOrderStatusWhere'],
  ['DASH-03', 'Dashboard', 'Revenue completed payments only', 'Owner', 'Pending+paid', 'View revenue', 'Only completed payments', 'orderCountsTowardRevenue'],
  ['DASH-04', 'Dashboard', 'Branch filter', 'Owner', '2 branches', 'Filter branch', 'Numbers match', 'branch scope'],
  ['DASH-05', 'Dashboard', 'Empty restaurant', 'New owner', 'No orders', 'Open dashboard', 'Zeros no crash', 'analytics'],
  ['SALE-01', 'Sales', 'List by sourceType', 'Staff', 'sales:access', 'Filter POS/ONLINE/KIOSK', 'Filter works', 'GET sales-orders'],
  ['SALE-02', 'Sales', 'Status buckets', 'Staff', 'Mixed statuses', 'View buckets', 'completed/pending/canceled', 'salesOrderStatusBucket'],
  ['SALE-03', 'Sales', 'Order detail', 'Staff', '—', 'Open order', 'Items modifiers tax discount service charge', 'GET orders/[id]'],
  ['SALE-04', 'Sales', 'Daily ticket number', 'Staff', 'Same branch same day', 'Two orders', 'Unique ticket per branch/date', 'unique ticketNumber'],
  ['SALE-05', 'Sales', 'Short order id search', 'Staff', '—', 'Search 6-char id', 'Found', 'shortOrderId'],
  ['SALE-06', 'Sales', 'No sales access', 'Cashier without sales', 'No sales:*', 'Open /sales', '/no-access', 'RBAC'],
  ['POS-01', 'POS', 'Open shift', 'Cashier', 'pos', 'Start shift', 'PosShift OPEN', 'POST pos-shift'],
  ['POS-02', 'POS', 'Shift already open', 'Cashier', 'OPEN shift', 'Start again', 'Reuse or reject duplicate', 'open-by-branch'],
  ['POS-03', 'POS', 'Close shift', 'Cashier', 'OPEN shift', 'Enter locker cash', 'CLOSED closingCashInLocker', 'pos-shift'],
  ['POS-04', 'POS', 'Order without shift', 'Cashier', 'No shift', 'Checkout', 'Fail or auto-open', 'posShiftId'],
  ['POS-05', 'POS', 'Walk-up cash order', 'Cashier', 'Shift open', 'Add items cash pay', 'POS order completed + kitchen ticket', 'POST pos-order'],
  ['POS-06', 'POS', 'Delivery requires phone+address', 'Cashier', 'Delivery mode', 'Checkout without them', 'Toast warning', 'pos-screen validation'],
  ['POS-07', 'POS', 'Takeaway no table', 'Cashier', '—', 'Takeaway checkout', 'No diningTableId', 'sourceType POS'],
  ['POS-08', 'POS', 'Dine-in send kitchen', 'Cashier', 'Table exists', 'Select table send kitchen', 'Open pending table order', 'table-orders/open send-kitchen'],
  ['POS-09', 'POS', 'Add courses to open table', 'Cashier', 'Pending table', 'Send kitchen again', 'Same order extra tickets', 'table-open-orders pending'],
  ['POS-10', 'POS', 'Pay table', 'Cashier', 'Open table', 'Cash/card pay', 'Completed; table free', 'table-orders/pay'],
  ['POS-11', 'POS', 'Cancel table', 'Cashier', 'Open table', 'Cancel', 'Canceled; not on KDS', 'table-orders/cancel'],
  ['POS-12', 'POS', 'Variations and add-ons', 'Cashier', 'Configured product', 'Add to cart', 'OrderItemModifier prices', 'modifiers'],
  ['POS-13', 'POS', 'Personalize no price', 'Cashier', 'Personalize group', 'Select prefs', 'Named modifiers unitPrice 0', 'MenuItemPersonalizeGroup'],
  ['POS-14', 'POS', 'Sale price', 'Cashier', 'salePrice set', 'Add item', 'Cart uses salePrice', 'MenuItem.salePrice'],
  ['POS-15', 'POS', 'Tax + discount + service', 'Cashier', 'Charges on', 'Checkout', 'total = items - discount + tax + serviceCharge', 'Order fields'],
  ['POS-16', 'POS', 'POS service charge on', 'Cashier', 'posServiceChargeEnabled', 'Checkout', 'Flat amount on POS only', 'restaurant flag'],
  ['POS-17', 'POS', 'POS service charge off', 'Cashier', 'Disabled', 'Checkout', '0 service charge', 'flag'],
  ['POS-18', 'POS', 'Cash pay', 'Cashier', '—', 'Pay cash', 'Payment cash completed', 'Payment.method'],
  ['POS-19', 'POS', 'Card terminal', 'Cashier', 'paymentTerminalIp set', 'Card pay', 'terminal-payment route', 'POS terminal'],
  ['POS-20', 'POS', 'Cancel unpaid', 'Cashier', 'Unpaid order', 'Cancel', 'Canceled; no revenue', 'PATCH cancel'],
  ['POS-21', 'POS', 'Cannot cancel completed', 'Cashier', 'Completed order', 'Cancel', 'Rejected', 'cancel guard'],
  ['POS-22', 'POS', 'Idempotency retry', 'Cashier', 'Same idempotencyKey twice', 'Submit twice', 'One order', 'Order.idempotencyKey unique'],
  ['POS-23', 'POS', 'Recipe stock deduct', 'Cashier', 'Product has ingredients', 'Complete order', 'IngredientStockEntry source ORDER', 'inventory'],
  ['POS-24', 'POS', 'Recent orders', 'Cashier', '—', 'Open recent', 'Recent POS orders', 'pos-order/recent'],
  ['POS-25', 'POS', 'Pending kitchen', 'Cashier', 'Unsent items', 'View pending', 'Listed', 'pos-order/pending-kitchen'],
  ['POS-26', 'POS', 'Offline retry', 'Cashier', 'Kill network then restore', 'Place order offline', 'Flush no duplicate', 'outbox + idempotency'],
  ['POS-27', 'POS', 'No pos access', 'Kitchen', 'No pos:*', 'Open /pos', '/no-access', 'middleware+API'],
  ['POS-28', 'POS', 'Currency formatting', 'Cashier', 'EUR vs PKR', 'Checkout', 'Totals formatted', 'currencyCode'],
  ['KDS-01', 'KDS', 'Tickets list making', 'Kitchen', 'Order sent', 'Open KDS', 'status making', 'GET kds/tickets'],
  ['KDS-02', 'KDS', 'Start timer', 'Kitchen', 'Ticket open', 'Set minutes', 'selectedMinutes startedAt', 'PATCH ticket'],
  ['KDS-03', 'KDS', 'Mark complete', 'Kitchen', '—', 'Complete', 'Ticket completed; display ready', 'PATCH'],
  ['KDS-04', 'KDS', 'Cancel ticket', 'Kitchen', '—', 'Cancel', 'Canceled', 'PATCH'],
  ['KDS-05', 'KDS', 'Manager orders', 'Manager', 'kds', 'Open manager list', 'In-progress orders', 'kds/manager-orders'],
  ['KDS-06', 'KDS', 'Manager complete/cancel', 'Manager', '—', 'PATCH order', 'Status updates', 'manager-orders/[id]'],
  ['KDS-07', 'KDS', 'Already completed', 'Kitchen', 'Completed ticket', 'Complete again', 'Rejected', 'status guard'],
  ['KDS-08', 'KDS', 'Order display columns', 'Staff', 'order-display', 'Open screen', 'Preparing vs ready', 'GET order-display'],
  ['KDS-09', 'KDS', 'Branch filter', 'Kitchen', '2 branches', 'Filter', 'Only that branch', 'scope'],
  ['KDS-10', 'KDS', 'Realtime ticket', 'Kitchen+POS', '—', 'New order', 'Appears without refresh', 'SSE'],
  ['KDS-11', 'KDS', 'No kds permission', 'Cashier', 'No kds', 'Open /kds', '/no-access', 'RBAC'],
  ['KSK-01', 'Kiosk', 'Pick branch', 'Guest', 'Valid slug', 'Open kiosk branch', 'Menu for branch', 'kiosk pages'],
  ['KSK-02', 'Kiosk', 'Dine-in without table', 'Guest', '—', 'Submit dine_in no table', '400 Table is required', 'POST /api/kiosk/orders'],
  ['KSK-03', 'Kiosk', 'Dine-in with table', 'Guest', 'Table exists', 'Order', 'Address snapshot has table name', 'kioskDineInCustomerDisplayName'],
  ['KSK-04', 'Kiosk', 'Take-away', 'Guest', '—', 'fulfillment take_away', 'No table needed', 'kiosk orders'],
  ['KSK-05', 'Kiosk', 'Cash pending', 'Guest then cashier', 'Cash pay', 'Place kiosk cash', 'Appears POS pending cash', 'kiosk-order/pending-cash'],
  ['KSK-06', 'Kiosk', 'Staff confirm cash', 'Cashier', 'Pending cash', 'Pay', 'Paid + kitchen', 'kiosk-order/[id]/pay'],
  ['KSK-07', 'Kiosk', 'Staff cancel unpaid', 'Cashier', 'Unpaid kiosk', 'Cancel', 'Canceled', '.../cancel'],
  ['KSK-08', 'Kiosk', 'Card/PayPal/Stripe/wallets', 'Guest', 'Provider configured', 'Pay', 'Completes via provider', 'payment routes'],
  ['KSK-09', 'Kiosk', 'Kiosk service charge', 'Guest', 'kioskServiceChargeEnabled', 'Checkout', 'Charge applied', 'flag'],
  ['KSK-10', 'Kiosk', 'Track order', 'Guest', 'shortOrderId', 'Track', 'Found', 'GET kiosk/order-tracking'],
  ['KSK-11', 'Kiosk', 'Success page', 'Guest', 'Paid', 'Open success', 'Shows ticket/short id', 'success page'],
  ['KSK-12', 'Kiosk', 'Invalid slug/branch', 'Guest', 'Bad ids', 'Open URL', '404', 'kiosk pages'],
  ['WEB-01', 'Storefront', 'Menu by slug', 'Guest', 'Products exist', 'Open /{slug}', 'Categories items images', 'GET customer/menu'],
  ['WEB-02', 'Storefront', 'Images load', 'Guest', '—', 'Open item/category', 'Images load', 'media routes'],
  ['WEB-03', 'Storefront', 'Guest pickup checkout', 'Guest', '—', 'pickUp checkout', 'Allowed', 'create-customer-order'],
  ['WEB-04', 'Storefront', 'Delivery missing address', 'Guest', 'delivery', 'Checkout', 'Delivery address is required', 'Zod'],
  ['WEB-05', 'Storefront', 'Delivery missing phone', 'Guest', 'delivery', 'Checkout', 'Customer phone is required', 'Zod'],
  ['WEB-06', 'Storefront', 'Schedule ASAP', 'Guest', '—', 'ASAP', 'orderScheduleMode asap', 'Order fields'],
  ['WEB-07', 'Storefront', 'Schedule slot', 'Guest', 'slotDurationMinutes', 'Pick slot', 'Matches 15/30/60', 'Branch'],
  ['WEB-08', 'Storefront', 'Cutlery and comment', 'Guest', '—', 'Toggle + comment', 'Stored', 'cutleryRequested customerComment'],
  ['WEB-09', 'Storefront', 'Online service charge', 'Guest', 'onlineServiceChargeEnabled', 'Checkout', 'Applied', 'flag'],
  ['WEB-10', 'Storefront', 'Cart offers', 'Guest', 'Offers linked', 'Open cart', 'Offers shown', 'GET cart-offers'],
  ['WEB-11', 'Storefront', 'Guest track', 'Guest', 'shortOrderId', 'Track', 'Found', 'GET customer/order-tracking'],
  ['WEB-12', 'Storefront', 'Register customer', 'Guest', '—', 'Register', 'Unique per restaurant+email', 'POST customer-auth/register'],
  ['WEB-13', 'Storefront', 'Customer login/logout', 'Customer', '—', 'Login logout', 'Cookie session hashed', 'CustomerSession.tokenHash'],
  ['WEB-14', 'Storefront', 'Customer Google', 'Guest', '—', 'Google', 'Works', 'customer-auth/google'],
  ['WEB-15', 'Storefront', 'Order history', 'Customer', 'Logged in', 'Open /orders', 'Only that restaurant', 'GET customer/me/orders'],
  ['WEB-16', 'Storefront', 'Order detail fulfillment', 'Customer', '—', 'Open order', 'delivery vs pickup from address snapshot', 'Fulfillment: Delivery string'],
  ['WEB-17', 'Storefront', 'Disabled account', 'Customer', 'disabledAt', 'Login', 'Fails', 'disabledAt'],
  ['WEB-18', 'Storefront', 'Guest vs account on order', 'Both', '—', 'Place orders', 'Account id null vs set', 'Order.customerAccountId'],
  ['WEB-19', 'Storefront', 'Subdomain storefront', 'Guest', 'slug.domain', 'Open /', 'Works', 'middleware rewrite'],
  ['WEB-20', 'Storefront', 'Pay at checkout', 'Guest', 'Provider on', 'Pay', 'See PAY cases', 'payments'],
  ['PAY-01', 'Payments', 'Provider NONE', 'Guest', 'NONE', 'Online/kiosk card', 'Cannot take card/wallet', 'customerPaymentProvider'],
  ['PAY-02', 'Payments', 'Save Stripe keys', 'Owner', 'settings', 'Save keys', 'Secret encrypted; test mode', 'PUT payments/stripe'],
  ['PAY-03', 'Payments', 'Stripe test connection', 'Owner', 'Keys saved', 'Test', 'Pass/fail', 'payments/stripe/test'],
  ['PAY-04', 'Payments', 'Stripe checkout + webhook', 'Guest', 'Stripe on', 'Pay', 'Webhook completes payment', 'create-order-checkout-session + webhook'],
  ['PAY-05', 'Payments', 'Verify Stripe return', 'Guest', 'Paid session', 'Return to success', 'Paid → completed', 'verify-order-session'],
  ['PAY-06', 'Payments', 'PayPal REST keys', 'Owner', '—', 'Save + test', 'Works', 'payments/paypal'],
  ['PAY-07', 'Payments', 'PayPal create+capture', 'Guest', '—', 'Pay', 'Order paid', 'paypal create-order capture'],
  ['PAY-08', 'Payments', 'PayPal partner onboard', 'Owner', '—', 'Onboard', 'permissionsGranted + paymentsReceivable', 'paypal/onboard complete status'],
  ['PAY-09', 'Payments', 'JazzCash save + test', 'Owner', '—', 'Save; return URL match', 'Test OK', 'jazzcash credentials'],
  ['PAY-10', 'Payments', 'JazzCash checkout return', 'Guest', '—', 'Pay success/fail/cancel', 'Handled', 'jazzcash return GET+POST'],
  ['PAY-11', 'Payments', 'Easypaisa checkout return', 'Guest', '—', 'Same as JazzCash', 'Handled', 'easypaisa routes'],
  ['PAY-12', 'Payments', 'Wallet picker', 'Guest', 'WALLETS', 'Pick JazzCash vs Easypaisa', 'Correct provider', 'WALLETS'],
  ['PAY-13', 'Payments', 'Webhook replay', 'System', 'Already completed', 'Replay webhook', 'No double capture', 'completed skip'],
  ['PAY-14', 'Payments', 'Delete credentials', 'Owner', '—', 'DELETE keys', 'Falls back safely', 'DELETE payment routes'],
  ['PAY-15', 'Payments', 'Mobile PayPal complete', 'Guest', 'Mobile', 'Success/cancel query', 'Handled', 'paypal/mobile-complete'],
  ['PAY-16', 'Payments', 'Card flow cancel', 'Guest', '—', 'Cancel card', 'Order not completed', 'card-payment-flow'],
  ['LOC-01', 'Locations', 'CRUD branch', 'Owner', 'Plan allows', 'Create update', 'Saved', 'branches API'],
  ['LOC-02', 'Locations', 'Delete branch with orders', 'Owner', 'Orders exist', 'Delete', 'SetNull or blocked', 'onDelete SetNull'],
  ['LOC-03', 'Locations', 'Plan branch cap', 'Owner', 'At cap', 'Add one more', '403', 'SUB-11-13'],
  ['LOC-04', 'Locations', 'CRUD table per branch', 'Owner', '—', 'Create unique name', 'OK', 'DiningTable unique'],
  ['LOC-05', 'Locations', 'Duplicate table same branch', 'Owner', 'Name exists', 'Create same name', 'Error', '@@unique'],
  ['LOC-06', 'Locations', 'Same table name other branch', 'Owner', '2 branches', 'Same name', 'Allowed', 'unique includes branchId'],
  ['LOC-07', 'Locations', 'Delete table keeps snapshot', 'Owner', 'Paid order with table', 'Delete table', 'Order.tableLabel remains', 'snapshot'],
  ['LOC-08', 'Locations', 'Employee branch assignment', 'Owner', '—', 'Invite scoped', 'EmployeeBranch set', 'syncEmployeeBranches'],
  ['CAT-01', 'Catalog', 'Create category + image', 'Menu editor', '—', 'Create', 'Appears on menu', 'categories API'],
  ['CAT-02', 'Catalog', 'Edit reorder delete category', 'Menu editor', '—', 'Edit/delete', 'Delete blocked if linked (confirm)', 'categories'],
  ['CAT-03', 'Catalog', 'Variation catalog unique', 'Menu editor', '—', 'Duplicate name', 'Error', 'RestaurantVariation unique name'],
  ['CAT-04', 'Catalog', 'Product create', 'Menu editor', 'product:edit', 'Create price salePrice image', 'Created', 'POST menu/items'],
  ['CAT-05', 'Catalog', 'Multi-category product', 'Menu editor', '—', 'Assign many', 'MenuItemCategory + primary categoryId', 'links'],
  ['CAT-06', 'Catalog', 'Product variations absolute price', 'Menu editor', '—', 'Set priceDelta', 'Absolute unit price', 'MenuItemVariation'],
  ['CAT-07', 'Catalog', 'Personalize groups', 'Menu editor', '—', 'maxItems options', 'No price', 'personalize API'],
  ['CAT-08', 'Catalog', 'Recommendation SINGLE required', 'GROWTH', '—', 'Required group', 'Guest must pick 1', 'AttributeGroup'],
  ['CAT-09', 'Catalog', 'MULTIPLE CHECKBOX', 'GROWTH', '—', 'Checkbox mode', 'Each option ≤ 1', 'RecommendationMultipleMode'],
  ['CAT-10', 'Catalog', 'QUANTITY + freeQuantity', 'GROWTH', '—', 'First N free', 'Pricing correct', 'freeQuantity'],
  ['CAT-11', 'Catalog', 'Per-variation min/max', 'GROWTH', '—', 'Small 2 Large 4', 'Limits apply', 'AttributeGroupVariationLimit'],
  ['CAT-12', 'Catalog', 'CATEGORY source default item', 'GROWTH', '—', 'Default linked item', 'Delta vs default', 'sourceType CATEGORY'],
  ['CAT-13', 'Catalog', 'Default variation price included vs free', 'GROWTH', '—', 'Toggle includeDefaultLinkedVariationPrice', 'Price changes', 'flag'],
  ['CAT-14', 'Catalog', 'useVariationPricing', 'GROWTH', '—', 'Enable', 'Add-on follows base variation', 'flag'],
  ['CAT-15', 'Catalog', 'Offers STARTER denied', 'STARTER', '—', 'Link offer', '403', 'offers API'],
  ['CAT-16', 'Catalog', 'Recipe ingredients', 'Menu editor', '—', 'Product and/or variation', 'MenuItemIngredient', 'recipe'],
  ['CAT-17', 'Catalog', 'Export CSV', 'Menu editor', 'product access', 'Export', 'Download', 'GET products/export'],
  ['CAT-18', 'Catalog', 'Import CSV happy', 'Menu editor', 'product or recommendations edit', 'Import mapped CSV', 'Products created', 'POST products/import'],
  ['CAT-19', 'Catalog', 'Import skipDuplicates true', 'Menu editor', '—', 'Re-import', 'Existing names skipped', 'skipDuplicates'],
  ['CAT-20', 'Catalog', 'Import skipDuplicates false', 'Menu editor', '—', 'Re-import', 'Updates per code', 'flag'],
  ['CAT-21', 'Catalog', 'Import non-CSV', 'Menu editor', '—', 'Upload .txt', '400 only .csv', 'import route'],
  ['CAT-22', 'Catalog', 'Import bad mapping JSON', 'Menu editor', '—', 'Invalid mapping', '400', 'columnMapping parse'],
  ['CAT-23', 'Catalog', 'Import recs on STARTER', 'STARTER', 'CSV with recs', 'Import', 'Plan denied', 'import plan check'],
  ['CAT-24', 'Catalog', 'Delete product snapshot', 'Menu editor', 'Old orders', 'Delete product', 'Order lines keep productName', 'onDelete SetNull'],
  ['CAT-25', 'Catalog', 'Access-only cannot PATCH', 'Viewer', 'product:access', 'PATCH/DELETE', '403', 'RBAC'],
  ['INV-01', 'Inventory', 'Create ingredient', 'Clerk', 'inventory:edit', 'Create', 'Unique name per restaurant', 'ingredients POST'],
  ['INV-02', 'Inventory', 'Duplicate ingredient name', 'Clerk', 'Name exists', 'Create again', 'Error', '@@unique name'],
  ['INV-03', 'Inventory', 'Ingredient fields', 'Clerk', '—', 'Image SKU min qty major active', 'Saved', 'Ingredient model'],
  ['INV-04', 'Inventory', 'Manual stock in/out', 'Clerk', '—', 'Add entry', 'MANUAL entry; qty updates', 'IngredientStockEntry'],
  ['INV-05', 'Inventory', 'Order deducts recipe', 'Cashier', 'Recipe set', 'Complete sale', 'Source ORDER linked orderId', 'ORDER source'],
  ['INV-06', 'Inventory', 'Cancel order stock', 'Cashier', 'Deducted', 'Cancel order', 'Confirm restore or not', 'cancel path'],
  ['INV-07', 'Inventory', 'Below minQuantity warning', 'Clerk', 'min set', 'Drop below', 'Warning on page', 'minQuantity'],
  ['INV-08', 'Inventory', 'Inactive hidden from recipes', 'Clerk', 'isActive false', 'New recipe picker', 'Hidden', 'isActive'],
  ['INV-09', 'Inventory', 'Delete in-use ingredient', 'Clerk', 'Used in recipe', 'Delete', 'Blocked or cascade', 'DELETE ingredient'],
  ['INV-10', 'Inventory', 'Realtime stock', 'Two tabs', '—', 'Manual adjust', 'Other tab updates', 'publishInventoryStockUpdate'],
  ['FIN-01', 'Finance', 'Transaction history', 'Staff', 'records:access', 'Filter date/source', 'List', 'transaction-history'],
  ['FIN-02', 'Finance', 'Record detail', 'Staff', '—', 'Open /records/[id]', 'Line items', 'detail page'],
  ['FIN-03', 'Finance', 'Income analytics gated', 'STARTER vs GROWTH', '—', 'Open analytics', 'STARTER gated GROWTH OK', 'advancedAnalytics'],
  ['FIN-04', 'Finance', 'Product sales/favorites', 'Staff', 'Paid orders', 'Open reports', 'Matches completed paid', 'productsale favorite profit'],
  ['FIN-05', 'Finance', 'Canceled not in revenue', 'Staff', 'Canceled orders', 'Check reports', 'Excluded', 'orderCountsTowardRevenue'],
  ['SET-01', 'Settings', 'Name slug subdomain', 'Owner', 'settings:edit', 'Change unique', 'Storefront URLs update', 'PATCH restaurant'],
  ['SET-02', 'Settings', 'Currency country', 'Owner', '—', 'Change', 'POS/kiosk/web use currencyCode', 'regional'],
  ['SET-03', 'Settings', 'Branding GROWTH', 'GROWTH', '—', 'Logo banners theme', 'Saved', 'restaurant PATCH'],
  ['SET-04', 'Settings', 'Branding STARTER', 'STARTER', '—', 'Save branding', 'Denied', 'branding false'],
  ['SET-05', 'Settings', 'Service charges per channel', 'Owner', '—', 'POS kiosk online independently', 'Saved', 'PATCH service-charges'],
  ['SET-06', 'Settings', 'Payment terminal IP', 'Owner', '—', 'Set IP', 'Used by POS card', 'paymentTerminalIp'],
  ['SET-07', 'Settings', 'List roles', 'Owner', 'settings:access', 'Open Access', 'Owner/Admin presets', 'GET roles'],
  ['SET-08', 'Settings', 'Create custom role GROWTH', 'GROWTH', '—', 'Matrix modules', 'Created', 'POST roles'],
  ['SET-09', 'Settings', 'Toggle delete on', 'GROWTH', '—', 'Enable delete', 'Auto access+edit', 'toggleModuleAction'],
  ['SET-10', 'Settings', 'Toggle access off', 'GROWTH', '—', 'Disable access', 'Clears edit+delete', 'toggleModuleAction'],
  ['SET-11', 'Settings', 'Invite employee', 'Owner', '—', 'Role + branches', 'Email invite', 'POST employees'],
  ['SET-12', 'Settings', 'STARTER custom role assign', 'STARTER', '—', 'Assign custom', 'Denied', 'plan'],
  ['SET-13', 'Settings', 'Remove employee', 'Owner', 'settings:delete', 'Remove', 'Loses dashboard', 'DELETE employee'],
  ['SET-14', 'Settings', 'Owner always full access', 'Owner', 'Stale Role.permissions', 'Use all modules', 'Still full', 'getEffectiveDashboardPermissionNames'],
  ['SET-15', 'Settings', 'Billing invoices', 'Owner', '—', 'Open billing', 'Invoices show', 'GET billing'],
  ['ADM-01', 'Admin', 'Overview metrics', 'Platform admin', '—', 'Open /admin/dashboard', 'Metrics', 'GET admin/overview'],
  ['ADM-02', 'Admin', 'Restaurant directory', 'Platform admin', '—', 'Open restaurants', 'All tenants', 'GET admin/restaurants'],
  ['ADM-03', 'Admin', 'Change plan/status/period', 'Platform admin', '—', 'Set adminPeriodEndAt', 'Not overwritten until PayPal renewal', 'adminPeriodEndAt'],
  ['ADM-04', 'Admin', 'Record subscription payment', 'Platform admin', '—', 'Add payment', 'SubscriptionPayment row', 'admin payments'],
  ['ADM-05', 'Admin', 'Demo requests + email', 'Platform admin', '—', 'View/email', 'Works', '/admin/requests'],
  ['ADM-06', 'Admin', 'Newsletter CRUD + send', 'Platform admin', '—', 'Create send', 'Campaigns', 'admin newsletter'],
  ['ADM-07', 'Admin', 'Blog CRUD publish', 'Platform admin', '—', 'Publish', 'Public blog only published', 'admin blog'],
  ['ADM-08', 'Admin', 'FAQ CRUD reorder', 'Platform admin', '—', 'Reorder', 'Landing FAQs update', 'admin faqs'],
  ['ADM-09', 'Admin', 'Docs tree reorder', 'Platform admin', '—', 'Headings/modules', 'Public docs update', 'admin documentation'],
  ['ADM-10', 'Admin', 'SEO traffic', 'Platform admin', '—', 'GSC/GA4', 'Saved', '/admin/seo'],
  ['ADM-11', 'Admin', 'Platform settings', 'Platform admin', '—', 'Save', 'PlatformSetting', '/admin/settings'],
  ['ADM-12', 'Admin', 'Non-admin API', 'Owner', '—', 'Call /api/admin/*', '403 Access Blocked', 'adminRequest.ts'],
  ['E2E-01', 'E2E', 'Signup to POS to KDS to analytics', 'Owner', 'Fresh restaurant', 'Onboard menu POS KDS display sales inventory', 'Full path works', 'multi-module'],
  ['E2E-02', 'E2E', 'Table open send pay complete', 'Cashier', 'Tables exist', 'Open send pay complete', 'Table flow', 'table-orders'],
  ['E2E-03', 'E2E', 'Kiosk dine-in cash', 'Guest+cashier', '—', 'Kiosk cash then POS confirm then KDS', 'Works', 'kiosk pending-cash'],
  ['E2E-04', 'E2E', 'Online delivery Stripe', 'Guest', 'Stripe on', 'Cart pay webhook kitchen track', 'Works', 'customer orders + stripe'],
  ['E2E-05', 'E2E', 'Online pickup JazzCash', 'Guest', 'Wallets', 'Pay JazzCash', 'Works', 'jazzcash return'],
  ['E2E-06', 'E2E', 'POS-only employee', 'Cashier', 'Limited role', 'Sell; cannot edit menu/settings', 'RBAC holds', 'RBAC'],
  ['E2E-07', 'E2E', 'STARTER vs GROWTH', 'Two owners', '—', '2nd branch logo rec group', 'STARTER denied GROWTH OK', 'plan enforcement'],
  ['E2E-08', 'E2E', 'Trial expire mid-shift', 'Owner', 'Expire trial', 'Use dashboard', 'Blocked', 'subscription-access'],
  ['E2E-09', 'E2E', 'CSV export import skip dupes', 'Menu editor', '—', 'Export import', 'Unchanged + extras added', 'import/export'],
  ['E2E-10', 'E2E', 'Same customer email two restaurants', 'Guest', 'Two restaurants', 'Register both', 'Separate CustomerAccounts', 'unique per restaurant'],
  ['SEC-01', 'Security', 'API without cookie', 'Guest', '—', 'GET menu items staff', '401', 'require session'],
  ['SEC-02', 'Security', 'Forge other restaurant itemId', 'Owner A', "B's itemId", 'GET/PATCH', '404 not leaked', 'tenant scope'],
  ['SEC-03', 'Security', 'Customer API uses slug not staff restaurant', 'Staff+customer', '—', 'Call customer APIs', 'Resolves restaurant from slug/host', 'customer restaurant route'],
  ['SEC-04', 'Security', 'Admin API as owner', 'Owner', '—', 'Call admin', '403', 'adminRequest'],
  ['SEC-05', 'Security', 'XSS in product name', 'Menu editor', '—', 'Name with script', 'Escaped on KDS/POS/storefront', 'encoding'],
  ['SEC-06', 'Security', 'Huge CSV', 'Menu editor', '—', 'Upload huge file', 'Sensible error no crash', 'import'],
  ['SEC-07', 'Security', 'Double-submit pay', 'Guest/cashier', '—', 'Double click pay', 'One payment', 'idempotency/completed guard'],
  ['SEC-08', 'Security', 'Pay canceled order', 'Guest', 'Canceled', 'Pay', 'Rejected', 'status guard'],
  ['SEC-09', 'Security', 'Webhook invalid signature', 'Attacker', '—', 'POST webhook', '400 order unchanged', 'signature check'],
];

const headerFill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF111827' },
};
const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 };
const wrapAlign = { wrapText: true, vertical: 'top' };

function styleHeader(sheet) {
  const row = sheet.getRow(1);
  row.height = 22;
  row.font = headerFont;
  row.alignment = { vertical: 'middle', wrapText: true };
  HEADERS.forEach((_, i) => {
    const cell = row.getCell(i + 1);
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF1F2937' } },
    };
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
  const ref = `I2:I${lastRow}`;
  sheet.addConditionalFormatting({
    ref,
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

  cases.forEach((c, idx) => {
    const r = idx + 2;
    const values = [
      c[0],
      c[1],
      c[2],
      c[3],
      c[4],
      c[5],
      c[6],
      c[7],
      'Not Run',
      CHECK_EMPTY,
      CHECK_EMPTY,
      '',
      '',
      '',
    ];
    const row = sheet.getRow(r);
    row.height = 36;
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

  const lastRow = cases.length + 1;
  paintResultRules(sheet, lastRow);
  sheet.pageSetup = {
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    orientation: 'landscape',
    paperSize: 9,
  };
}

function addInstructions(sheet) {
  sheet.getColumn(1).width = 22;
  sheet.getColumn(2).width = 92;
  sheet.mergeCells('A1:B1');
  sheet.getCell('A1').value = 'Foodluk white-box manual test workbook';
  sheet.getCell('A1').font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF111827' } };

  const lines = [
    ['How to mark results', 'On Users & RBAC or Full system: pick Result (Not Run / Pass / Fail / Blocked). Then tick Approved (☑) or Rejected (☑) using the dropdown. Do not tick both.'],
    ['Approved', 'Use only when Result = Pass. Green cell when ☑.'],
    ['Rejected', 'Use only when Result = Fail or the case is invalid. Red cell when ☑.'],
    ['Filter', 'Row 1 is frozen with AutoFilter. Filter by Area, Result, Approved, or Rejected.'],
    ['Actors to prepare', 'Owner (GROWTH), Owner (STARTER), Admin employee, Cashier (pos+sales), Kitchen (kds), Settings access-only, Settings edit-only, empty-permission user, platform admin, customer account, second restaurant.'],
    ['RBAC tokens', 'Each dashboard module has access / edit / delete. Delete implies edit implies access. Account owner always has full access.'],
    ['Sheets', 'Users & RBAC = team, invites, roles, permissions, plan gates. Full system = marketing through POS, kiosk, storefront, payments, catalog, admin, E2E, security.'],
    ['Summary', 'Counts update automatically from Result / Approved / Rejected columns.'],
  ];

  sheet.getCell('A3').value = 'Field';
  sheet.getCell('B3').value = 'Instructions';
  sheet.getCell('A3').font = headerFont;
  sheet.getCell('B3').font = headerFont;
  sheet.getCell('A3').fill = headerFill;
  sheet.getCell('B3').fill = headerFill;

  lines.forEach((pair, i) => {
    const r = i + 4;
    sheet.getCell(`A${r}`).value = pair[0];
    sheet.getCell(`B${r}`).value = pair[1];
    sheet.getCell(`A${r}`).font = { bold: true, name: 'Calibri', size: 11 };
    sheet.getCell(`B${r}`).alignment = { wrapText: true, vertical: 'top' };
    sheet.getRow(r).height = 36;
  });
}

function addSummary(sheet, rbacLast, systemLast) {
  sheet.getColumn(1).width = 28;
  sheet.getColumn(2).width = 16;
  sheet.getColumn(3).width = 16;
  sheet.getColumn(4).width = 16;

  sheet.getCell('A1').value = 'Test progress';
  sheet.getCell('A1').font = { size: 16, bold: true };

  const headers = ['Metric', 'Users & RBAC', 'Full system', 'Total'];
  headers.forEach((h, i) => {
    const cell = sheet.getCell(3, i + 1);
    cell.value = h;
    cell.fill = headerFill;
    cell.font = headerFont;
  });

  const metrics = [
    ['Total cases', `COUNTA('Users & RBAC'!A2:A${rbacLast})`, `COUNTA('Full system'!A2:A${systemLast})`],
    ['Not Run', `COUNTIF('Users & RBAC'!I:I,"Not Run")`, `COUNTIF('Full system'!I:I,"Not Run")`],
    ['Pass', `COUNTIF('Users & RBAC'!I:I,"Pass")`, `COUNTIF('Full system'!I:I,"Pass")`],
    ['Fail', `COUNTIF('Users & RBAC'!I:I,"Fail")`, `COUNTIF('Full system'!I:I,"Fail")`],
    ['Blocked', `COUNTIF('Users & RBAC'!I:I,"Blocked")`, `COUNTIF('Full system'!I:I,"Blocked")`],
    [`Approved (${CHECK_TICKED})`, `COUNTIF('Users & RBAC'!J:J,"${CHECK_TICKED}")`, `COUNTIF('Full system'!J:J,"${CHECK_TICKED}")`],
    [`Rejected (${CHECK_TICKED})`, `COUNTIF('Users & RBAC'!K:K,"${CHECK_TICKED}")`, `COUNTIF('Full system'!K:K,"${CHECK_TICKED}")`],
  ];

  metrics.forEach((m, i) => {
    const r = i + 4;
    sheet.getCell(`A${r}`).value = m[0];
    sheet.getCell(`B${r}`).value = { formula: m[1] };
    sheet.getCell(`C${r}`).value = { formula: m[2] };
    sheet.getCell(`D${r}`).value = { formula: `B${r}+C${r}` };
    sheet.getRow(r).font = { name: 'Calibri', size: 11 };
  });

  sheet.getCell('A12').value =
    'Tip: filter Result = Fail on a case sheet, then tick Rejected. Filter Result = Pass, then tick Approved.';
  sheet.mergeCells('A12:D12');
  sheet.getCell('A12').alignment = { wrapText: true };
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Foodluk QA';
  workbook.created = new Date();
  workbook.modified = new Date();

  const instructions = workbook.addWorksheet('Instructions', {
    properties: { tabColor: { argb: 'FF6366F1' } },
  });
  addInstructions(instructions);

  const rbac = workbook.addWorksheet('Users & RBAC', {
    properties: { tabColor: { argb: 'FF2563EB' } },
  });
  fillCases(rbac, USERS_RBAC);

  const system = workbook.addWorksheet('Full system', {
    properties: { tabColor: { argb: 'FF059669' } },
  });
  fillCases(system, FULL_SYSTEM);

  const summary = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: 'FFD97706' } },
  });
  addSummary(summary, USERS_RBAC.length + 1, FULL_SYSTEM.length + 1);

  const fileName = 'Foodluk-Whitebox-Test-Cases.xlsx';
  const downloads = path.join(os.homedir(), 'Downloads', fileName);
  const localDir = path.join(process.cwd(), 'docs');
  fs.mkdirSync(localDir, { recursive: true });
  const local = path.join(localDir, fileName);

  await workbook.xlsx.writeFile(downloads);
  await workbook.xlsx.writeFile(local);

  console.log(`Wrote ${USERS_RBAC.length + FULL_SYSTEM.length} cases`);
  console.log(`Downloads: ${downloads}`);
  console.log(`Project:   ${local}`);
}

await main();
