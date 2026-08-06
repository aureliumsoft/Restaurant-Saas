import { NextResponse } from 'next/server';

import {
  loadPublicDocModules,
  loadPublicDocNav,
} from '@/lib/documentation/public';

/** Public published documentation (nav tree + flat modules for index cards). */
export async function GET() {
  try {
    const [nav, modules] = await Promise.all([
      loadPublicDocNav(),
      loadPublicDocModules(),
    ]);
    return NextResponse.json({
      data: {
        headings: nav.headings,
        modules,
      },
    });
  } catch (e) {
    console.error('documentation GET', e);
    return NextResponse.json(
      { error: 'Failed to load documentation' },
      { status: 500 }
    );
  }
}
