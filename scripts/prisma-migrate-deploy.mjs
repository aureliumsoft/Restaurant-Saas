/**
 * Run `prisma migrate deploy` with advisory locking disabled.
 * Prisma Postgres often times out on pg_advisory_lock when the dev server
 * or a previous failed migrate holds connections (P1002).
 */
import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: 'true',
};

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env,
  shell: true,
});

process.exit(result.status ?? 1);
