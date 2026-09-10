/**
 * Run `prisma migrate deploy` with advisory locking disabled.
 * Automatically resolves any previously failed migrations (P3009) by marking
 * them as rolled-back so Prisma can re-apply them cleanly.
 */
import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: 'true',
};

function tryResolveRolledBack(migrationName) {
  console.log(`[migrate] Attempting to mark "${migrationName}" as rolled-back if failed...`);
  const res = spawnSync('npx', ['prisma', 'migrate', 'resolve', '--rolled-back', migrationName], {
    stdio: 'pipe',
    env,
    shell: true,
    encoding: 'utf-8',
  });
  const output = (res.stdout || '') + '\n' + (res.stderr || '');
  if (res.status === 0) {
    console.log(`[migrate] Successfully marked "${migrationName}" as rolled-back.`);
    return true;
  }
  // If not in failed state, ignore error
  return false;
}

function runDeploy() {
  console.log('[migrate] Running prisma migrate deploy...');
  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'pipe',
    env,
    shell: true,
    encoding: 'utf-8',
  });

  const output = (result.stdout || '') + '\n' + (result.stderr || '');
  process.stdout.write(output);

  if (result.status === 0) {
    console.log('[migrate] Prisma migrations applied successfully.');
    return 0;
  }

  // Check for P3009: failed migration in target database
  const match = output.match(/The `([^`]+)` migration started at .* failed/);
  if (match && match[1]) {
    const failedName = match[1];
    console.log(`[migrate] Detected failed migration: "${failedName}". Resolving...`);
    tryResolveRolledBack(failedName);
    console.log('[migrate] Retrying prisma migrate deploy...');
    const retry = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
      stdio: 'inherit',
      env,
      shell: true,
    });
    return retry.status ?? 1;
  }

  return result.status ?? 1;
}

// Proactively attempt to resolve known failed migration
tryResolveRolledBack('20260909115831_recomendation_enhanced');

const status = runDeploy();
process.exit(status);

