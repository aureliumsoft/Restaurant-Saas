import type { NextRequest } from 'next/server';
import { getBranchScopeFromRequest } from '@/lib/branch/branch-scope';
import { getRealtimeHub } from '@/lib/realtime/hub';
import { getRestaurantIdForRequest } from '@/lib/restaurant-owner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await getRestaurantIdForRequest(req, {
    moduleKeys: ['dashboard', 'kds', 'pos', 'sales', 'order-display'],
    action: 'access',
  });
  if (!auth.ok) {
    return new Response(auth.error, { status: auth.status });
  }

  const branchScope = await getBranchScopeFromRequest(
    req,
    auth.userId,
    auth.restaurantId
  );
  const branchId =
    req.nextUrl.searchParams.get('branchId')?.trim() ||
    branchScope?.activeBranchId ||
    null;

  const encoder = new TextEncoder();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(chunk));
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      send(': connected\n\n');
      send(
        `data: ${JSON.stringify({
          type: 'connected',
          restaurantId: auth.restaurantId,
          branchId,
          at: new Date().toISOString(),
        })}\n\n`
      );

      unsubscribe = getRealtimeHub().subscribe({
        restaurantId: auth.restaurantId,
        branchId,
        userId: auth.userId,
        send,
        close,
      });

      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          send(': heartbeat\n\n');
        } catch {
          close();
        }
      }, 25_000);

      req.signal.addEventListener('abort', close);
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
