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
import { getRestaurantCurrencySymbol } from '@/lib/restaurant-regional';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';

const VOICE_STORAGE_KEY = 'order-display:voice-enabled';
const COMPLETED_ANNOUNCEMENT_REPEATS = 3;
const IN_PROGRESS_DISPLAY_LIMIT = 8;

type OrderDisplayLang = 'es' | 'en';

const COPY = {
  es: {
    title: 'Estado del pedido',
    subtitlePrefix: 'Pedidos POS y kiosco de hoy',
    liveSync: 'En vivo · se actualiza en tiempo real · última sync',
    voiceOn: 'Voz activada',
    voiceOff: 'Voz desactivada',
    muteTitle: 'Silenciar anuncios',
    unmuteTitle: 'Activar anuncios',
    refresh: 'Actualizar',
    readyNow: 'Listo ahora',
    readyNowSubtitle: 'Por favor, acérquese al mostrador',
    readyBadge: 'Listo ahora',
    recentlyCompleted: 'Completados recientemente',
    recentlyCompletedSubtitle: 'Siguiente recogida',
    inPreparation: 'En preparación',
    inPreparationSubtitle: 'Preparando su pedido',
    token: 'Token',
    tracking: 'Seguimiento',
    walkIn: 'Cliente sin reserva',
    noReadyYet: 'Aún no hay pedidos listos',
    noReadyYetSubtitle: 'Los pedidos completados aparecerán aquí.',
    noOlderReady: 'No hay pedidos listos anteriores',
    noOlderReadySubtitle: 'Los pedidos completados más antiguos aparecerán aquí.',
    upNext: 'A continuación…',
    noPreparing: 'No hay pedidos en preparación',
    noPreparingSubtitle: 'Los pedidos en curso aparecerán aquí.',
    signInError: 'Inicie sesión como personal del restaurante para ver esta pantalla.',
    loadError: 'No se pudieron cargar los pedidos. Reintentando…',
    announce: (token: string, name: string) =>
      `Pedido número ${token} completado. ${name}, por favor, acérquese al mostrador para recoger su pedido.`,
  },
  en: {
    title: 'Order Status',
    subtitlePrefix: "Today's POS & kiosk orders",
    liveSync: 'Live · updates in real time · last sync',
    voiceOn: 'Voice on',
    voiceOff: 'Voice off',
    muteTitle: 'Mute order announcements',
    unmuteTitle: 'Enable order announcements',
    refresh: 'Refresh',
    readyNow: 'Ready Now',
    readyNowSubtitle: 'Please come to the counter',
    readyBadge: 'Ready now',
    recentlyCompleted: 'Recently Completed',
    recentlyCompletedSubtitle: 'Picked up next',
    inPreparation: 'In Preparation',
    inPreparationSubtitle: 'Working on your order',
    token: 'Token',
    tracking: 'Tracking',
    walkIn: 'Walk-in customer',
    noReadyYet: 'No orders ready yet',
    noReadyYetSubtitle: 'Completed orders will appear here.',
    noOlderReady: 'No older ready orders',
    noOlderReadySubtitle: 'Older completed orders will queue here.',
    upNext: 'Up next…',
    noPreparing: 'No orders being prepared',
    noPreparingSubtitle: 'Orders being worked on will appear here.',
    signInError: 'Please sign in as restaurant staff to view this screen.',
    loadError: 'Could not load orders. Retrying…',
    announce: (token: string, name: string) =>
      `Order number ${token} is ready. ${name}, please come to the counter to collect your order.`,
  },
} as const;

const FEMALE_VOICE_HINT =
  /female|mujer|woman|helena|monica|paulina|lucia|laura|sabina|elena|sofia|isabel|maria|español.*femenin/i;
const MALE_VOICE_HINT =
  /male|hombre|man\b|pablo|jorge|diego|carlos|daniel|enrique|rodrigo|español(?!.*femenin)/i;

let cachedVoice: SpeechSynthesisVoice | null | undefined;
let cachedVoiceLang: string | null = null;

function pickVoiceForLang(
  synth: SpeechSynthesis,
  lang: OrderDisplayLang
): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  if (lang === 'es') {
    const spanish = voices.filter(
      (v) =>
        v.lang.toLowerCase().startsWith('es') || /spanish|español/i.test(v.name)
    );
    if (spanish.length === 0) return null;
    const female = spanish.find((v) => FEMALE_VOICE_HINT.test(v.name));
    if (female) return female;
    const notMale = spanish.find((v) => !MALE_VOICE_HINT.test(v.name));
    return notMale ?? null;
  }
  const english = voices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith('en') || /english/i.test(v.name)
  );
  if (english.length === 0) return null;
  const female = english.find((v) => FEMALE_VOICE_HINT.test(v.name));
  return female ?? english[0] ?? null;
}

function getVoiceForLang(
  synth: SpeechSynthesis,
  lang: OrderDisplayLang
): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined && cachedVoiceLang === lang) {
    return cachedVoice;
  }
  cachedVoiceLang = lang;
  cachedVoice = pickVoiceForLang(synth, lang);
  return cachedVoice;
}

function resetVoiceCache() {
  cachedVoice = undefined;
  cachedVoiceLang = null;
}

function buildAnnouncement(
  ticket: OrderDisplayTicket,
  copy: (typeof COPY)[OrderDisplayLang]
): string {
  const name = ticket.customerName?.trim() || copy.walkIn;
  let tokenSpoken: string;
  if (typeof ticket.ticketNumber === 'number' && ticket.ticketNumber > 0) {
    tokenSpoken = String(ticket.ticketNumber);
  } else {
    const id = (
      ticket.shortOrderId ?? ticket.orderId.slice(0, 6)
    ).toUpperCase();
    tokenSpoken = id.split('').join(' ');
  }
  return copy.announce(tokenSpoken, name);
}

function speakUtterance(
  synth: SpeechSynthesis,
  text: string,
  lang: OrderDisplayLang
): Promise<void> {
  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang === 'es' ? 'es-ES' : 'en-US';
    utter.rate = 0.95;
    utter.pitch = 1.05;
    utter.volume = 1;
    const voice = getVoiceForLang(synth, lang);
    if (voice) {
      utter.voice = voice;
    } else {
      utter.pitch = 1.15;
    }
    const done = () => resolve();
    utter.onend = done;
    utter.onerror = done;
    synth.speak(utter);
  });
}

async function speakCompletedAnnouncements(
  tickets: OrderDisplayTicket[],
  isEnabled: () => boolean,
  lang: OrderDisplayLang,
  copy: (typeof COPY)[OrderDisplayLang]
): Promise<void> {
  if (typeof window === 'undefined' || tickets.length === 0) return;
  const synth = window.speechSynthesis;
  if (!synth) return;

  for (const ticket of tickets) {
    if (!isEnabled()) {
      synth.cancel();
      return;
    }
    const text = buildAnnouncement(ticket, copy);
    for (let repeat = 0; repeat < COMPLETED_ANNOUNCEMENT_REPEATS; repeat++) {
      if (!isEnabled()) {
        synth.cancel();
        return;
      }
      await speakUtterance(synth, text, lang);
    }
  }
}

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
  return trackingId(t);
}

function formatFilterDateLabel(isoYmd: string, locale: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoYmd.trim());
  if (!m) return isoYmd;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(y, mo - 1, d).toLocaleDateString(locale, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function OrderDisplayScreen() {
  const { regional } = useOwnerRestaurantRegional();
  // Spain → Spanish UI + Euro; otherwise English (+ restaurant currency, e.g. PKR).
  const lang: OrderDisplayLang = regional.countryCode === 'ES' ? 'es' : 'en';
  const copy = COPY[lang];
  const locale = lang === 'es' ? 'es-ES' : 'en-US';
  const currencySymbol = getRestaurantCurrencySymbol(regional.currencyCode);
  const langRef = useRef(lang);
  const copyRef = useRef(copy);
  langRef.current = lang;
  copyRef.current = copy;

  const [completed, setCompleted] = useState<OrderDisplayTicket[]>([]);
  const [inProgress, setInProgress] = useState<OrderDisplayTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterTimezone, setFilterTimezone] = useState<string>('UTC');

  const seenCompletedRef = useRef<Set<string>>(new Set());
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const voiceEnabledRef = useRef(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    const onVoicesChanged = () => resetVoiceCache();
    synth.addEventListener('voiceschanged', onVoicesChanged);
    resetVoiceCache();
    return () => synth.removeEventListener('voiceschanged', onVoicesChanged);
  }, []);

  useEffect(() => {
    resetVoiceCache();
  }, [lang]);

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
        window.localStorage.setItem(VOICE_STORAGE_KEY, next ? 'on' : 'off');
        if (!next && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        if (next && window.speechSynthesis) {
          const warm = new SpeechSynthesisUtterance(' ');
          warm.volume = 0;
          const voice = getVoiceForLang(
            window.speechSynthesis,
            langRef.current
          );
          if (voice) warm.voice = voice;
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
            const copySet = new Set(prev);
            for (const id of freshIds) copySet.delete(id);
            return copySet;
          });
        }, 4500);

        if (initializedRef.current && voiceEnabledRef.current) {
          void speakCompletedAnnouncements(
            freshTickets,
            () => voiceEnabledRef.current,
            langRef.current,
            copyRef.current
          );
        }
      }
      initializedRef.current = true;
    } catch (e) {
      const msg =
        axios.isAxiosError(e) && e.response?.status === 401
          ? copyRef.current.signInError
          : copyRef.current.loadError;
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useRealtimeRefresh('realtime:order_display', () => void load());

  const lastUpdatedText = useMemo(() => {
    if (!lastUpdated) return '—';
    return lastUpdated.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, [lastUpdated, locale]);

  const featured = completed[0] ?? null;
  const recentOthers = completed.slice(1, 3);

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden p-3 md:p-4">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {copy.title}
          </h1>
          <p className="text-xs text-muted-foreground md:text-sm">
            {copy.subtitlePrefix}
            {filterDate ? (
              <>
                {' '}
                · {formatFilterDateLabel(filterDate, locale)}
                {filterTimezone && filterTimezone !== 'UTC' ? (
                  <span className="text-muted-foreground/80">
                    {' '}
                    ({filterTimezone})
                  </span>
                ) : null}
              </>
            ) : null}
            {' · '}
            {regional.currencyCode} ({currencySymbol})
            {' · '}
            {copy.liveSync} {lastUpdatedText}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={voiceEnabled ? 'default' : 'outline'}
            onClick={toggleVoice}
            title={voiceEnabled ? copy.muteTitle : copy.unmuteTitle}
          >
            {voiceEnabled ? (
              <Volume2 className="mr-2 h-4 w-4" />
            ) : (
              <VolumeX className="mr-2 h-4 w-4" />
            )}
            {voiceEnabled ? copy.voiceOn : copy.voiceOff}
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
            {copy.refresh}
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

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-2">
        <section className="flex min-h-0 flex-col gap-2 overflow-hidden">
          <SectionTitle
            title={copy.readyNow}
            subtitle={copy.readyNowSubtitle}
            accent="emerald"
          />
          <div className="min-h-0 flex-1">
            {loading ? (
              <SkeletonCard className="h-full" />
            ) : !featured ? (
              <EmptyState
                className="h-full"
                icon={
                  <CheckCircle2 className="h-12 w-12 text-emerald-500/60" />
                }
                title={copy.noReadyYet}
                subtitle={copy.noReadyYetSubtitle}
              />
            ) : (
              <FeaturedReadyCard
                ticket={featured}
                pulsing={highlighted.has(featured.ticketId)}
                copy={copy}
              />
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <div className="flex shrink-0 flex-col gap-2">
            <SectionTitle
              title={copy.recentlyCompleted}
              subtitle={copy.recentlyCompletedSubtitle}
              accent="emerald"
            />
            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                <SkeletonCard className="h-24" />
                <SkeletonCard className="h-24" />
              </div>
            ) : recentOthers.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-8 w-8 text-emerald-500/50" />}
                title={copy.noOlderReady}
                subtitle={copy.noOlderReadySubtitle}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {recentOthers.map((t) => (
                  <RecentReadyCard
                    key={t.ticketId}
                    ticket={t}
                    pulsing={highlighted.has(t.ticketId)}
                    copy={copy}
                  />
                ))}
                {recentOthers.length === 1 ? (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-emerald-500/20 bg-emerald-500/[0.03] px-4 py-6 text-xs text-muted-foreground">
                    {copy.upNext}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            <SectionTitle
              title={copy.inPreparation}
              subtitle={copy.inPreparationSubtitle}
              accent="amber"
            />
            {loading ? (
              <div className="grid grid-cols-2 grid-rows-4 gap-2 sm:gap-3">
                {Array.from({ length: IN_PROGRESS_DISPLAY_LIMIT }).map(
                  (_, i) => (
                    <SkeletonCard key={i} className="h-24" />
                  )
                )}
              </div>
            ) : inProgress.length === 0 ? (
              <EmptyState
                icon={<Utensils className="h-8 w-8 text-amber-500/50" />}
                title={copy.noPreparing}
                subtitle={copy.noPreparingSubtitle}
              />
            ) : (
              <div className="grid grid-cols-2 grid-rows-4 gap-2 sm:gap-3">
                {inProgress.slice(0, IN_PROGRESS_DISPLAY_LIMIT).map((t) => (
                  <InProgressCard key={t.ticketId} ticket={t} copy={copy} />
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

type ScreenCopy = (typeof COPY)[OrderDisplayLang];

function FeaturedReadyCard({
  ticket,
  pulsing,
  copy,
}: {
  ticket: OrderDisplayTicket;
  pulsing: boolean;
  copy: ScreenCopy;
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
        {copy.readyBadge}
      </span>
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center md:p-10">
        <div className="flex h-32 w-32 flex-none items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xl shadow-emerald-500/50 md:h-44 md:w-44">
          <CheckCircle2
            className="h-20 w-20 md:h-28 md:w-28"
            strokeWidth={2.5}
          />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700 dark:text-emerald-400">
            {copy.token}
          </p>
          <p className="font-mono text-7xl font-black leading-none tracking-tight text-emerald-700 dark:text-emerald-200 md:text-[9rem]">
            {tokenLabel(ticket)}
          </p>
          <p className="mt-5 text-2xl font-bold md:text-3xl">
            {ticket.customerName?.trim() || copy.walkIn}
          </p>
          <p className="text-base text-muted-foreground md:text-lg">
            {maskPhone(ticket.customerPhone)}
          </p>
          <p className="mt-3 font-mono text-sm uppercase tracking-widest text-muted-foreground">
            {copy.tracking} · {trackingId(ticket)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentReadyCard({
  ticket,
  pulsing,
  copy,
}: {
  ticket: OrderDisplayTicket;
  pulsing: boolean;
  copy: ScreenCopy;
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
            {copy.token}
          </p>
          <p className="font-mono text-3xl font-extrabold leading-none tracking-tight text-emerald-700 dark:text-emerald-300">
            {tokenLabel(ticket)}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold">
            {ticket.customerName?.trim() || copy.walkIn}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {maskPhone(ticket.customerPhone)} · {trackingId(ticket)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function InProgressCard({
  ticket,
  copy,
}: {
  ticket: OrderDisplayTicket;
  copy: ScreenCopy;
}) {
  return (
    <Card className="relative overflow-hidden border-amber-500/30 bg-amber-500/[0.05] shadow-sm">
      <CardContent className="flex items-center gap-3 p-3 md:p-4">
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-amber-500 text-white shadow-md shadow-amber-500/40">
          <Clock3 className="h-7 w-7" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
            {copy.token}
          </p>
          <p className="font-mono text-3xl font-extrabold leading-none tracking-tight text-amber-700 dark:text-amber-300">
            {tokenLabel(ticket)}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold">
            {ticket.customerName?.trim() || copy.walkIn}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {maskPhone(ticket.customerPhone)} · {trackingId(ticket)}
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
