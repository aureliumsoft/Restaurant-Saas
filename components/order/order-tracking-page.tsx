'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { WebAppRestaurantTitle } from '@/components/customer-app/web-app-restaurant-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type TrackingResult = {
  id: string;
  shortOrderId?: string;
  ticketNumber: number | null;
  status: string;
  total: number;
  createdAt: string;
  updatedAt: string;
  customer: { name: string; phone: string; email: string | null } | null;
  payment: { amount: number; status: string; method: string; createdAt: string } | null;
  items: Array<{ id: string; name: string; quantity: number; price: number }>;
};

export function OrderTrackingPage({
  initialOrderId = '',
  restaurantSlug = '',
}: {
  initialOrderId?: string;
  restaurantSlug?: string;
}) {
  const router = useRouter();
  const [orderId, setOrderId] = useState(initialOrderId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackingResult | null>(null);

  const track = async () => {
    const id = orderId.trim();
    if (!id) {
      setError('Enter a tracking ID.');
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/customer/order-tracking?orderId=${encodeURIComponent(id)}`);
      const body = (await res.json().catch(() => ({}))) as {
        data?: TrackingResult;
        error?: string;
      };
      if (!res.ok || !body.data) {
        setError(body.error || 'Order not found.');
        return;
      }
      setResult(body.data);
    } catch {
      setError('Could not fetch order status right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-4">
        <WebAppRestaurantTitle size="compact" />
        <Card>
          <CardHeader>
            <CardTitle>Track Your Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Enter tracking ID"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
              />
              <Button type="button" onClick={() => void track()} disabled={loading}>
                <Search className="mr-2 h-4 w-4" />
                {loading ? 'Tracking…' : 'Track'}
              </Button>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/web-app/${encodeURIComponent(restaurantSlug)}`)}
              disabled={!restaurantSlug.trim()}
            >
              Back to Home
            </Button>
          </CardContent>
        </Card>

        {result ? (
          <Card>
            <CardHeader>
              <CardTitle>
                Ticket #{result.ticketNumber ?? '—'} · Tracking {result.shortOrderId ?? result.id}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                <strong>Order status:</strong> {result.status}
              </p>
              <p>
                <strong>Payment status:</strong> {result.payment?.status ?? 'N/A'}
              </p>
              <p>
                <strong>Payment method:</strong> {result.payment?.method ?? 'N/A'}
              </p>
              <p>
                <strong>Total:</strong> €{result.total.toFixed(2)}
              </p>
              {result.customer ? (
                <div className="rounded border p-3">
                  <p className="font-medium">Customer</p>
                  <p>{result.customer.name}</p>
                  <p>{result.customer.phone}</p>
                  {result.customer.email ? <p>{result.customer.email}</p> : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
