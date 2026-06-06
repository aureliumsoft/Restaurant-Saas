'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import FullscreenButton from '@/components/fullscreen/fullscreen';
import { SalesOrdersTabs } from '@/components/sales/sales-orders-tabs';
import { useRef } from 'react';
import { Button } from '../ui/button';
import { PlusIcon } from 'lucide-react';

export function Orders() {
  const tableRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Sale Records</h2>
          <p className="text-sm text-muted-foreground">
            Online, POS, and kiosk orders with fulfillment method, totals, and
            per-order details.
          </p>
        </div>
      </div>
      <Card
        className="flex min-h-0 w-full flex-1 flex-col overflow-hidden"
        ref={tableRef}
      >
        <div className="relative shrink-0">
          <CardHeader>
            <CardTitle>Orders</CardTitle>
           
            <FullscreenButton targetRef={tableRef} />
          </CardHeader>
        </div>
        <CardContent className="z-0 flex min-h-0 flex-1 flex-col p-6 pt-0">
          <SalesOrdersTabs />
        </CardContent>
      </Card>
    </div>
  );
}
