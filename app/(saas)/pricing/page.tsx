import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { ArrowRight, Headphones, Lock, RefreshCcw, SendHorizonal, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/app-session';
import { getRestaurantForUser } from '@/lib/restaurant-owner';
import { isSubscriptionPeriodActive } from '@/lib/subscription-access';
import { processSubscriptionLifecycle } from '@/lib/subscription-lifecycle';

function formatPeriodEnd(iso: Date | null): string {
  if (!iso) return '';
  return iso.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default async function PricingPage() {
  const session = await getAppSession();
  const isLoggedIn = Boolean(session?.user?.email);

  let currentPlanSlug: string | null = null;
  let subscriptionPeriodActive = false;
  let periodEndLabel: string | null = null;

  if (session?.user?.email) {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (user) {
      const restaurant = await getRestaurantForUser(user.id);
      if (restaurant) {
        await processSubscriptionLifecycle(restaurant.id);
        const sub = await db.restaurantSubscription.findUnique({
          where: { restaurantId: restaurant.id },
          select: {
            plan: true,
            status: true,
            trialEndsAt: true,
            currentPeriodEnd: true,
          },
        });
        if (sub?.plan) {
          currentPlanSlug = sub.plan;
          subscriptionPeriodActive = isSubscriptionPeriodActive(sub);
          const end =
            sub.status === 'TRIAL' ? sub.trialEndsAt : sub.currentPeriodEnd;
          periodEndLabel = formatPeriodEnd(end);
        }
      }
    }
  }

  let plans: Array<{
    plan: string;
    name: string;
    price: number;
    priceLabel: string;
    description: string;
    features: string[];
  }> = [];
  try {
    const rows = await db.$queryRaw<
      Array<{
        plan: string;
        name: string;
        price: number;
        priceLabel: string;
        description: string;
        features: string[] | null;
      }>
    >(Prisma.sql`
      SELECT "plan"::text AS "plan", "name", "price", "priceLabel", "description", "features"
      FROM "SubscriptionCatalog"
      ORDER BY CASE "plan"
        WHEN 'STARTER' THEN 1
        WHEN 'GROWTH' THEN 2
        WHEN 'SCALE' THEN 3
        ELSE 99
      END
    `);
    if (rows.length > 0) {
      plans = rows.map((r) => ({
        plan: r.plan,
        name: r.name,
        price: Number(r.price) || 0,
        priceLabel: r.priceLabel,
        description: r.description,
        features: r.features ?? [],
      }));
    }
  } catch {
    plans = [];
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f4ef] px-6 py-10 text-zinc-900 dark:bg-[#08090d] dark:text-white">
      <div className="pointer-events-none absolute inset-x-0 top-16 mx-auto h-44 max-w-3xl rounded-full bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.35),transparent_70%)] blur-xl dark:bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.28),transparent_70%)]" />
      <div className="pointer-events-none absolute -left-16 top-36 h-56 w-56 rounded-full bg-fire-200/40 blur-3xl dark:bg-fire-900/30" />
      <div className="pointer-events-none absolute -right-16 bottom-16 h-56 w-56 rounded-full bg-fire-100/40 blur-3xl dark:bg-fire-900/25" />

      <div className="relative mx-auto max-w-6xl p-8 md:p-12">
        <div className="mb-10 text-center md:mb-12">
          <span className="inline-flex items-center rounded-full border border-fire-300/70 bg-fire-100 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-fire-700 dark:border-fire-500/40 dark:bg-fire-500/10 dark:text-fire-300">
            Pricing table
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight md:text-6xl">
            Simple pricing for every stage
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-zinc-600 dark:text-zinc-300">
            Start lean, then scale your restaurant operations without switching
            tools.
          </p>
          <div className="mt-5">
            <Button
              variant="outline"
              asChild
              className="border-fire-300 bg-fire-50 text-fire-700 hover:bg-fire-100 dark:border-fire-500/40 dark:bg-white/5 dark:text-fire-200 dark:hover:bg-white/10"
            >
              <Link href="/demo-request">Request demo (get trial period)</Link>
            </Button>
          </div>
        </div>

        {plans.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50 p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
            No pricing plans configured yet. Ask admin to seed or update plans.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {plans.map((plan) => {
              const planMatches =
                currentPlanSlug !== null &&
                plan.plan.toUpperCase() === currentPlanSlug.toUpperCase();
              const isCurrentPlan = planMatches && subscriptionPeriodActive;
              const isExpiredCurrentPlan = planMatches && !subscriptionPeriodActive;
              const isFeatured = plan.plan.toUpperCase() === 'GROWTH';

              const paymentHref = isLoggedIn
                ? `/payment?plan=${encodeURIComponent(plan.plan)}`
                : `/login?callbackUrl=${encodeURIComponent(
                    `/payment?plan=${encodeURIComponent(plan.plan)}`
                  )}`;

              return (
              <article
                key={plan.plan}
                className={`relative flex flex-col rounded-2xl border p-6 transition-transform duration-300 ${
                  isFeatured
                    ? 'border-fire-300 bg-fire-50/10 shadow-[0_30px_70px_-30px] shadow-fire-400/70 md:-translate-y-1 dark:border-fire-500/50 dark:bg-gradient-to-b dark:from-fire-500/15 dark:to-zinc-900/70 dark:shadow-fire-900/80'
                    : 'border-zinc-200/80 bg-white/70 dark:border-zinc-700 dark:bg-zinc-900/50'
                }`}
              >
                {isFeatured ? (
                  <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 rounded-full border border-fire-300 bg-fire-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-fire-700 dark:border-fire-500/40 dark:bg-fire-500/15 dark:text-fire-200">
                    Most Popular
                  </span>
                ) : null}
                <h2 className="text-3xl font-semibold">{plan.name}</h2>
                <p className="mt-2 text-4xl font-bold tracking-tight text-fire-600 dark:text-fire-400">{plan.priceLabel}</p>
                <p className="mt-2 min-h-10 text-sm text-zinc-600 dark:text-zinc-300">
                  {plan.description}
                </p>
                <div className="mt-5 text-sm font-medium text-zinc-800 dark:text-zinc-100">What&apos;s included:</div>
                <ul className="mt-3 flex-1 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-0.5 text-fire-500 dark:text-fire-400">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {isCurrentPlan ? (
                  <p className="mt-6 rounded-lg border border-fire-300 bg-fire-100 px-4 py-3 text-center text-sm font-medium text-fire-700 dark:border-fire-500/40 dark:bg-fire-500/15 dark:text-fire-100">
                    Your current plan
                    {periodEndLabel ? (
                      <span className="mt-1 block text-xs font-normal opacity-90">
                        Active until {periodEndLabel}
                      </span>
                    ) : null}
                  </p>
                ) : isExpiredCurrentPlan ? (
                  <>
                    <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                      Your plan has expired
                      {periodEndLabel ? (
                        <span className="mt-1 block text-xs font-normal opacity-90">
                          Period ended {periodEndLabel}
                        </span>
                      ) : null}
                    </p>
                    <Button
                      className="mt-3 w-full bg-gradient-to-r from-fire-500 to-fire-600 text-white hover:from-fire-400 hover:to-fire-500"
                      asChild
                    >
                      <Link href={paymentHref}>
                        <>
                          <span>Renew {plan.name}</span>
                          <RefreshCcw className="ml-1 h-4 w-4" />
                        </>
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      className={`mt-6 w-full ${
                        isFeatured
                          ? 'bg-gradient-to-r from-fire-500 to-fire-600 text-white hover:from-fire-400 hover:to-fire-500'
                          : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700'
                      }`}
                      asChild
                    >
                      <Link href={paymentHref}>
                        <>
                          <span>Choose {plan.name}</span>
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </>
                      </Link>
                    </Button>
                    <Button
                      className="mt-2 w-full border-zinc-300 bg-white/70 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-transparent dark:text-zinc-100 dark:hover:bg-zinc-800/60"
                      variant="outline"
                      asChild
                    >
                      <Link href="/demo-request">Request demo for trial <SendHorizonal className="h-4 w-4 ml-1" /></Link>
                    </Button>
                  </>
                )}
              </article>
            );
            })}
          </div>
        )}

        <div className="mt-10 grid gap-3 rounded-2xl border border-zinc-200/80 bg-[#fff7ef] p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-zinc-700 dark:bg-zinc-900/60">
          <TrustFeature
            icon={<ShieldCheck className="h-4 w-4" />}
            title="No hidden fees"
            text="Transparent pricing. No surprise charges."
          />
          <TrustFeature
            icon={<RefreshCcw className="h-4 w-4" />}
            title="Cancel anytime"
            text="Change or cancel your plan anytime."
          />
          <TrustFeature
            icon={<Headphones className="h-4 w-4" />}
            title="24 / 7 Support"
            text="We are here to help you anytime."
          />
          <TrustFeature
            icon={<Lock className="h-4 w-4" />}
            title="Secure & Reliable"
            text="Your data is safe with us."
          />
        </div>
      </div>
    </main>
  );
}

function TrustFeature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <article className="flex items-start gap-3 rounded-xl border border-fire-200/70 bg-white/80 px-3 py-3 dark:border-fire-500/30 dark:bg-zinc-950/50">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fire-100 text-fire-600 dark:bg-fire-500/15 dark:text-fire-300">
        {icon}
      </span>
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</h3>
        <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{text}</p>
      </div>
    </article>
  );
}
