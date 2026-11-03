import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

/**
 * Single PrismaClient for the Node process.
 * On a shared VPS (~100 restaurants), keep one pool — set
 * `?connection_limit=10` (or similar) on DATABASE_URL in Coolify if needed.
 */
export const db = globalThis.prisma || new PrismaClient();

// Always pin to globalThis so Coolify/Nixpacks reloads do not multiply clients.
globalThis.prisma = db;