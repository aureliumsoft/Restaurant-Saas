import { NextResponse } from 'next/server';

import { publicGoogleSignInConfig } from '@/lib/customer-auth/google-oauth';

export async function GET() {
  return NextResponse.json({ data: publicGoogleSignInConfig() });
}
