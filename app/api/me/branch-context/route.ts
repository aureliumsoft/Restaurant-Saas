import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  getBranchScopeFromRequest,
  readActiveBranchCookie,
} from '@/lib/branch/branch-scope';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';

export async function GET(req: NextRequest) {
  const auth = await getRestaurantIdForRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = await getBranchScopeFromRequest(
    req,
    auth.userId,
    auth.restaurantId
  );
  if (!scope) {
    return NextResponse.json({ error: 'Branch scope unavailable' }, { status: 500 });
  }

  const cookieBranch = readActiveBranchCookie(req, auth.restaurantId);

  return NextResponse.json({
    data: {
      branches: scope.branches,
      allowedBranchIds: scope.allowedBranchIds,
      activeBranchId: scope.activeBranchId,
      canSwitchBranch: scope.canSwitchBranch,
      isOwnerOrAdmin: scope.isOwnerOrAdmin,
      cookieBranchId: cookieBranch,
    },
  });
}
