import { Prisma } from '@prisma/client';

export function prismaErrorMessage(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2022') {
      return 'Database schema is out of date. Run migrations on the server: npx prisma migrate deploy';
    }
    if (error.code === 'P2002') {
      return 'A record with this value already exists.';
    }
    if (error.code === 'P2003') {
      return 'Database reference error. Required roles or tables may be missing — run seed or migrations.';
    }
  }
  return 'An unexpected server error occurred.';
}

export function prismaErrorStatus(error: unknown): number {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2022') return 503;
    if (error.code === 'P2002') return 409;
    if (error.code === 'P2003') return 503;
  }
  return 500;
}
