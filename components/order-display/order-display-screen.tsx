'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  CheckCircle2,
  Clock3,
  RefreshCw,
  Utensils,
  Volume2,
  VolumeX,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import type {
  OrderDisplayPayload,
  OrderDisplayTicket,
} from '@/app/api/restaurant/order-display/route';
import { isKioskSyntheticCustomerPhone } from '@/lib/kiosk-customer';

const REFRESH_INTERVAL_MS = 5000;
const VOICE_STORAGE_KEY = 'order-display:voice-enabled';

/**
 * Build the speech string for a newly-ready order.
 *
 * Reads digits when the order has a real daily ticket number (so "07" is
 * spoken as "seven", not "zero-seven"), and falls back to spelling out the
 * 6-char tracking id letter-by-letter when there's no ticket number.
 */
function buildAnnouncement(ticket: OrderDisplayTicket): string {
  const name = ticket.customerName?.trim() || 'Walk-in customer';
  let tokenSpoken: string;
  if (typeof ticket.ticketNumber === 'number' && ticket.ticketNumber > 0) {
    tokenSpoken = String(ticket.ticketNumber);
  } else {
    const id = (ticket.shortOrderId ?? ticket.orderId.slice(0, 6)).toUpperCase();
    tokenSpoken = id.split('').join(' ');
  }
  return `Order number ${tokenSpoken} completed. ${name}, please come to the counter to pick up your order.`;
}

function speakAnnouncement(text: string): void {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  utter.rate = 0.95;
  utter.pitch = 1;
  utter.volume = 1;
  // Don't queue indefinitely — cap to ~3 pending so a long absence + many
  // new orders doesn't cause a 30-second backlog of announcements.
  if (synth.pending && synth.speaking) {
    // Already speaking + queued; let the new one wait its turn.
  }
  synth.speak(utter);
}

/**
 * Mask the middle digits of a phone number so the customer is identifiable
 * to themselves (first 3 + last 2 digits visible) but not to bystanders
 * watching the screen.
 */
function maskPhone(raw: string | null): string {
  if (!raw || isKioskSyntheticCustomerPhone(raw)) return '—';
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.length <= 5) return digits;
  const head = digits.slice(0, 3);
  const tail = digits.slice(-2);
  const middle = '•'.repeat(Math.max(2, digits.length - 5));
  return `${head}${middle}${tail}`;
}

function trackingId(t: OrderDisplayTicket): string {
  return (t.shortOrderId ?? t.orderId.slice(0, 6)).toUpperCase();
}

function tokenLabel(t: OrderDisplayTicket): string {
  if (typeof t.ticketNumber === 'number' && t.ticketNumber >= 0) {
    return String(t.ticketNumber).padStart(2, '0');
  }
  // Fallback when the daily ticket number isn't set yet (legacy orders) —
  // use the short tracking id so the card still has a prominent identifier.
  return trackingId(t);
}

/** Format API YYYY-MM-DD using the numeric parts (avoids UTC shift bugs). */
function formatFilterDateLabel(isoYmd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoYmd.trim());
  if (!m) return isoYmd;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(y, mo - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function OrderDisplayScreen() {
  const [completed, setCompleted] = useState<OrderDisplayTicket[]>([]);
  const [inProgress, setInProgress] = useState<OrderDisplayTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterTimezone, setFilterTimezone] = useState<string>('UTC');

  // Track which completed tickets we've already shown so we can briefly
  // pulse new ones when they first appear.
  const seenCompletedRef = useRef<Set<string>>(new Set());
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());

  // Voice announcement state. We persist the on/off toggle in localStorage
  // so the wall display remembers it across reloads.
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const voiceEnabledRef = useRef(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(VOICE_STORAGE_KEY);
    if (stored === 'off') {
      setVoiceEnabled(false);
      voiceEnabledRef.current = false;
    }
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      voiceEnabledRef.current = next;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          VOICE_STORAGE_KEY,
          next ? 'on' : 'off'
        );
        // Cancel any in-flight speech when muting.
        if (!next && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        // Some browsers won't speak until the synth has been "primed" by a
        // user gesture. Playing a near-silent utterance on the click warms
        // it up so the very next real announcement actually fires.
        if (next && window.speechSynthesis) {
          const warm = new SpeechSynthesisUtterance(' ');
          warm.volume = 0;
          window.speechSynthesis.speak(warm);
        }
      }
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await axios.get<OrderDisplayPayload>(
        '/api/restaurant/order-display'
      );
      const next = res.data.data;
      setCompleted(next.completed);
      setInProgress(next.inProgress);
      setFilterDate(next.filterDate ?? '');
      setFilterTimezone(next.filterTimezone ?? 'UTC');
      setError(null);
      setLastUpdated(new Date());

      const freshTickets: OrderDisplayTicket[] = [];
      for (const t of next.completed) {
        if (!seenCompletedRef.current.has(t.ticketId)) {
          freshTickets.push(t);
          seenCompletedRef.current.add(t.ticketId);
        }
      }
      if (freshTickets.length > 0) {
        const freshIds = new Set(freshTickets.map((t) => t.ticketId));
        setHighlighted((prev) => new Set([...prev, ...freshIds]));
        window.setTimeout(() => {
          setHighlighted((prev) => {
            const copy = new Set(prev);
            for (const id of freshIds) copy.delete(id);
            return copy;
          });
        }, 4500);

        // Speak only AFTER the first load so we don't read out everything
        // that was already on screen when the kiosk was opened.
        if (initializedRef.current && voiceEnabledRef.current) {
          for (const ticket of freshTickets) {
            speakAnnouncement(buildAnnouncement(ticket));
          }
        }
      }
      initializedRef.current = true;
    } catch (e) {
      const msg =
        axios.isAxiosError(e) && e.response?.status === 401
          ? 'Please sign in as restaurant staff to view this screen.'
          : 'Could not load orders. Retrying…';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onBranch = () => void load();
    window.addEventListener('branch-changed', onBranch);
    return () => window.removeEventListener('branch-changed', onBranch);
  }, [load]);

  useEffect(() => {
    const t = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  const lastUpdatedText = useMemo(() => {
    if (!lastUpdated) return '—';
    return lastUpdated.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, [lastUpdated]);

  // API returns up to 3 completed (most-recent first).
  // featured = most recent (huge card on left half).
  // others = next 2 (small cards on top-right).
  const featured = completed[0] ?? null;
  const recentOthers = completed.slice(1, 3);

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden p-3 md:p-4">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Order Status
          </h1>
          <p className="text-xs text-muted-foreground md:text-sm">
            Today&apos;s POS &amp; kiosk orders
            {filterDate ? (
              <>
                {' '}
                · {formatFilterDateLabel(filterDate)}
                {filterTimezone && filterTimezone !== 'UTC' ? (
                  <span className="text-muted-foreground/80">
                    {' '}
                    ({filterTimezone})
                  </span>
                ) : null}
              </>
            ) : null}
            {' · '}
            Live · refreshes every {REFRESH_INTERVAL_MS / 1000}s · last sync{' '}
            {lastUpdatedText}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={voiceEnabled ? 'default' : 'outline'}
            onClick={toggleVoice}
            title={
              voiceEnabled
                ? 'Mute order announcements'
                : 'Enable order announcements'
            }
          >
            {voiceEnabled ? (
              <Volume2 className="mr-2 h-4 w-4" />
            ) : (
              <VolumeX className="mr-2 h-4 w-4" />
            )}
            {voiceEnabled ? 'Voice on' : 'Voice off'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void load()}
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </header>

      {error ? (
        <Card className="shrink-0 border-amber-500/50 bg-amber-500/10">
          <CardContent className="py-3 text-sm font-medium text-amber-700 dark:text-amber-300">
            {error}
          </CardContent>
        </Card>
      ) : null}

      {/* Main split — half/half on lg+, stacked on smaller screens.
          min-h-0 + overflow-hidden so children can flex correctly. */}
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-2">
        {/* LEFT HALF — featured ready order, fills full column height. */}
        <section className="flex min-h-0 flex-col gap-2 overflow-hidden">
          <SectionTitle
            title="Ready Now"
            subtitle="Please come to the counter"
            accent="emerald"
          />
          <div className="min-h-0 flex-1">
            {loading ? (
              <SkeletonCard className="h-full" />
            ) : !featured ? (
              <EmptyState
                className="h-full"
                icon={<CheckCircle2 className="h-12 w-12 text-emerald-500/60" />}
                title="No orders ready yet"
                subtitle="Completed orders will appear here."
              />
            ) : (
              <FeaturedReadyCard
                ticket={featured}
                pulsing={highlighted.has(featured.ticketId)}
              />
            )}
          </div>
        </section>

        {/* RIGHT HALF — top: 2 recent ready cards, bottom: 4 in-progress (2x2). */}
        <section className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <div className="flex min-h-0 flex-col gap-2">
            <SectionTitle
              title="Recently Completed"
              subtitle="Picked up next"
              accent="emerald"
            />
            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                <SkeletonCard className="h-24" />
                <SkeletonCard className="h-24" />
              </div>
            ) : recentOthers.length === 0 ? (
              <EmptyState
                icon={
                  <CheckCircle2 className="h-8 w-8 text-emerald-500/50" />
                }
                title="No older ready orders"
                subtitle="Older completed orders will queue here."
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {recentOthers.map((t) => (
                  <RecentReadyCard
                    key={t.ticketId}
                    ticket={t}
                    pulsing={highlighted.has(t.ticketId)}
                  />
                ))}
                {recentOthers.length === 1 ? (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-emerald-500/20 bg-emerald-500/[0.03] px-4 py-6 text-xs text-muted-foreground">
                    Up next…
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <SectionTitle
              title="In Preparation"
              subtitle="We’re cooking your food"
              accent="amber"
            />
            {loading ? (
              <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={i} className="h-full" />
                ))}
              </div>
            ) : inProgress.length === 0 ? (
              <EmptyState
                className="flex-1"
                icon={<Utensils className="h-10 w-10 text-amber-500/60" />}
                title="No orders being prepared"
                subtitle="New orders will appear here."
              />
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 [&>*]:min-h-0">
                {inProgress.slice(0, 4).map((t) => (
                  <InProgressCard key={t.ticketId} ticket={t} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
  accent,
}: {
  title: string;
  subtitle: string;
  accent: 'emerald' | 'amber';
}) {
  const dot =
    accent === 'emerald'
      ? 'bg-emerald-500 shadow-emerald-500/60'
      : 'bg-amber-500 shadow-amber-500/60';
  return (
    <div className="flex shrink-0 items-baseline gap-3">
      <span
        className={`inline-block h-2.5 w-2.5 animate-pulse rounded-full shadow-[0_0_18px] ${dot}`}
        aria-hidden="true"
      />
      <h2 className="text-base font-bold md:text-lg">{title}</h2>
      <span className="hidden text-xs text-muted-foreground md:inline">
        {subtitle}
      </span>
    </div>
  );
}

/** Huge "ready now" card filling the left half of the screen. */
function FeaturedReadyCard({
  ticket,
  pulsing,
}: {
  ticket: OrderDisplayTicket;
  pulsing: boolean;
}) {
  return (
    <Card
      className={`relative flex h-full flex-col overflow-hidden border-emerald-500/50 bg-gradient-to-br from-emerald-500/15 via-emerald-400/5 to-transparent shadow-2xl shadow-emerald-500/20 ${
        pulsing ? 'ring-4 ring-emerald-400/70 animate-pulse' : ''
      }`}
    >
      <span
        className="absolute right-4 top-3 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-md shadow-emerald-500/40"
        aria-hidden="true"
      >
        Ready now
      </span>
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center md:p-10">
        <div className="flex h-32 w-32 flex-none items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xl shadow-emerald-500/50 md:h-44 md:w-44">
          <CheckCircle2 className="h-20 w-20 md:h-28 md:w-28" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700 dark:text-emerald-400">
            Token
          </p>
          <p className="font-mono text-7xl font-black leading-none tracking-tight text-emerald-700 dark:text-emerald-200 md:text-[9rem]">
            {tokenLabel(ticket)}
          </p>
          <p className="mt-5 text-2xl font-bold md:text-3xl">
            {ticket.customerName?.trim() || 'Walk-in customer'}
          </p>
          <p className="text-base text-muted-foreground md:text-lg">
            {maskPhone(ticket.customerPhone)}
          </p>
          <p className="mt-3 font-mono text-sm uppercase tracking-widest text-muted-foreground">
            Tracking · {trackingId(ticket)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Small ready card shown in the top half of the right column. */
function RecentReadyCard({
  ticket,
  pulsing,
}: {
  ticket: OrderDisplayTicket;
  pulsing: boolean;
}) {
  return (
    <Card
      className={`relative overflow-hidden border-emerald-500/30 bg-emerald-500/[0.05] shadow-sm ${
        pulsing ? 'ring-2 ring-emerald-400/70 animate-pulse' : ''
      }`}
    >
      <CardContent className="flex items-center gap-3 p-3 md:p-4">
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/40">
          <CheckCircle2 className="h-7 w-7" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            Token
          </p>
          <p className="font-mono text-3xl font-extrabold leading-none tracking-tight text-emerald-700 dark:text-emerald-300">
            {tokenLabel(ticket)}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold">
            {ticket.customerName?.trim() || 'Walk-in customer'}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {maskPhone(ticket.customerPhone)} · {trackingId(ticket)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** In-progress card in the bottom-right 2x2 grid. */
function InProgressCard({ ticket }: { ticket: OrderDisplayTicket }) {
  return (
    <Card className="flex h-full flex-col overflow-hidden border-amber-500/30 bg-amber-500/[0.04] shadow-sm">
      <CardContent className="flex flex-1 items-start gap-3 p-3 md:p-4">
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300">
          <Clock3 className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
            Token
          </p>
          <p className="font-mono text-3xl font-extrabold leading-none tracking-tight text-amber-700 dark:text-amber-200">
            {tokenLabel(ticket)}
          </p>
          <p className="mt-1 truncate text-sm font-semibold">
            {ticket.customerName?.trim() || 'Walk-in customer'}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {maskPhone(ticket.customerPhone)}
          </p>
          <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Tracking · {trackingId(ticket)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <Card className={`animate-pulse ${className ?? ''}`}>
      <CardContent className="h-full" />
    </Card>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  className?: string;
}) {
  return (
    <Card className={`border-dashed ${className ?? ''}`}>
      <CardContent className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
        {icon}
        <p className="text-sm font-semibold md:text-base">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
