/**
 * Adds resolveRouteParams to API route handlers that still destructure raw params.
 * Run: node scripts/patch-api-route-ids.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = path.join(root, 'app', 'api');

const SKIP = new Set([
  path.join('webhooks', 'stripe'),
  path.join('webhooks', 'paypal'),
  path.join('auth', '[...nextauth]'),
]);

const PARAM_KEYS = [
  'orderId',
  'itemId',
  'branchId',
  'tableId',
  'ticketId',
  'ingredientId',
  'categoryId',
  'variationId',
  'groupId',
  'offerId',
  'roleId',
  'employeeId',
  'inviteId',
  'subscriberId',
  'requestId',
  'restaurantId',
  'id',
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name === 'route.ts') files.push(full);
  }
  return files;
}

function shouldSkip(file) {
  const rel = path.relative(apiRoot, file).split(path.sep);
  const prefix = rel.slice(0, 2).join(path.sep);
  if (SKIP.has(prefix)) return true;
  if (rel[0] === 'webhooks') return true;
  return false;
}

function patchFile(file) {
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('resolveRouteParams')) return false;
  if (!src.includes('await ctx.params') && !src.includes('await context.params')) {
    return false;
  }

  const importLine =
    "import { resolveRouteParams } from '@/lib/resolve-route-id';\n";
  if (!src.includes("from '@/lib/resolve-route-id'")) {
    const lines = src.split('\n');
    let insertAt = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) insertAt = i + 1;
    }
    lines.splice(insertAt, 0, importLine.trimEnd());
    src = lines.join('\n');
  }

  const patterns = [
    /const\s+\{([^}]+)\}\s*=\s*await\s+ctx\.params;/g,
    /const\s+\{([^}]+)\}\s*=\s*await\s+context\.params;/g,
  ];

  let changed = false;
  for (const pattern of patterns) {
    src = src.replace(pattern, (match, inner) => {
      const keys = inner
        .split(',')
        .map((k) => k.trim().split(':')[0].trim())
        .filter((k) => PARAM_KEYS.includes(k));
      if (keys.length === 0) return match;
      changed = true;
      const paramName = match.includes('context.params')
        ? 'context.params'
        : 'ctx.params';
      return `const { ${inner.trim()} } = await resolveRouteParams(${paramName}, [${keys.map((k) => `'${k}'`).join(', ')}]);`;
    });
  }

  if (!changed) return false;
  fs.writeFileSync(file, src);
  return true;
}

const files = walk(apiRoot);
let count = 0;
for (const file of files) {
  if (shouldSkip(file)) continue;
  if (patchFile(file)) {
    count += 1;
    console.log('patched', path.relative(root, file));
  }
}
console.log(`Done. Patched ${count} files.`);
