import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { loadOrderInfoFromLocationId } from '@/lib/load-order-info-from-location';

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')?.trim();
    const modeParam = req.nextUrl.searchParams.get('mode')?.trim();
    const mode =
      modeParam === 'delivery' || modeParam === 'pickUp' ? modeParam : 'pickUp';

    if (!id) {
      return NextResponse.json({ error: 'Missing location id.' }, { status: 400 });
    }

    const data = await loadOrderInfoFromLocationId(id, mode);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('customer order location', error);
    return NextResponse.json(
      { error: 'Failed to load order location.' },
      { status: 500 }
    );
  }
}
