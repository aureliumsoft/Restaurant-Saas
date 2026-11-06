/**
 * Migrate one restaurant's base64 (or data-URL) images to Supabase Storage.
 *
 * Usage:
 *   npm run migrate:images -- --slug=<restaurant-slug>
 *   npm run migrate:images -- --slug=<restaurant-slug> --dry-run
 */

import fs from 'fs';
import path from 'path';

function loadEnvFile(fileName: string, override = false) {
  const full = path.join(process.cwd(), fileName);
  if (!fs.existsSync(full)) return;
  const text = fs.readFileSync(full, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!override && process.env[key] != null && process.env[key] !== '') continue;
    process.env[key] = value;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local', true);

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name: string) => {
    const prefix = `--${name}=`;
    const hit = args.find((a) => a.startsWith(prefix));
    if (hit) return hit.slice(prefix.length).trim();
    const idx = args.indexOf(`--${name}`);
    if (idx >= 0) return args[idx + 1]?.trim() ?? '';
    return '';
  };

  const slug =
    getArg('slug') || getArg('restaurantSlug') || getArg('restaurant');
  const dryRun = args.includes('--dry-run') || args.includes('--dryRun');

  if (!slug) {
    console.error(
      'Missing --slug=<restaurant-slug>\nExample:\n  npm run migrate:images -- --slug=my-restaurant'
    );
    process.exit(1);
  }

  const { db } = await import('@/lib/db');
  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
  if (!restaurant) {
    console.error(`Restaurant not found for slug: ${slug}`);
    process.exit(1);
  }

  console.log(
    `Resolving slug "${restaurant.slug}" → ${restaurant.name} (${restaurant.id})`
  );

  const { migrateRestaurantBase64ImagesToSupabase } = await import(
    '@/lib/migrate-base64-images-to-supabase'
  );

  const result = await migrateRestaurantBase64ImagesToSupabase({
    restaurantId: restaurant.id,
    dryRun,
    onProgress: (msg) => console.log(msg),
  });

  console.log('\nSummary');
  console.log(
    JSON.stringify(
      {
        slug: restaurant.slug,
        restaurantId: result.restaurantId,
        restaurantName: result.restaurantName,
        dryRun: result.dryRun,
        scanned: result.scanned,
        migrated: result.migrated,
        failed: result.failed,
      },
      null,
      2
    )
  );

  if (result.failed > 0) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
