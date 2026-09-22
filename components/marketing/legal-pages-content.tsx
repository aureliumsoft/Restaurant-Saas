'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';

import { SaasStaticPage } from '@/components/marketing/saas-static-page';

export function PrivacyPolicyContent() {
  const { t } = useTranslation();

  return (
    <SaasStaticPage
      title={t('marketing.legalPages.privacy.title')}
      subtitle={t('marketing.legalPages.privacy.subtitle')}
    >
      <h2 id="collection">{t('marketing.legalPages.privacy.sections.collection.title')}</h2>
      <p>{t('marketing.legalPages.privacy.sections.collection.body')}</p>

      <h2 id="usage">{t('marketing.legalPages.privacy.sections.usage.title')}</h2>
      <p>{t('marketing.legalPages.privacy.sections.usage.body')}</p>

      <h2 id="sharing">{t('marketing.legalPages.privacy.sections.sharing.title')}</h2>
      <p>{t('marketing.legalPages.privacy.sections.sharing.body')}</p>

      <h2 id="rights">{t('marketing.legalPages.privacy.sections.rights.title')}</h2>
      <p>{t('marketing.legalPages.privacy.sections.rights.body')}</p>

      <h2 id="contact">{t('marketing.legalPages.privacy.sections.contact.title')}</h2>
      <p>
        {t('marketing.legalPages.privacy.sections.contact.prefix')}{' '}
        <Link href="/demo-request" className="text-primary underline">
          {t('marketing.legalPages.privacy.sections.contact.link')}
        </Link>
        .
      </p>
    </SaasStaticPage>
  );
}

export function PoliciesContent() {
  const { t } = useTranslation();

  return (
    <SaasStaticPage
      title={t('marketing.legalPages.policies.title')}
      subtitle={t('marketing.legalPages.policies.subtitle')}
    >
      <h2 id="acceptable-use">
        {t('marketing.legalPages.policies.sections.acceptableUse.title')}
      </h2>
      <p>{t('marketing.legalPages.policies.sections.acceptableUse.body')}</p>

      <h2 id="accounts">{t('marketing.legalPages.policies.sections.accounts.title')}</h2>
      <p>{t('marketing.legalPages.policies.sections.accounts.body')}</p>

      <h2 id="content">{t('marketing.legalPages.policies.sections.content.title')}</h2>
      <p>{t('marketing.legalPages.policies.sections.content.body')}</p>

      <h2 id="availability">
        {t('marketing.legalPages.policies.sections.availability.title')}
      </h2>
      <p>{t('marketing.legalPages.policies.sections.availability.body')}</p>

      <h2 id="legal">{t('marketing.legalPages.policies.sections.related.title')}</h2>
      <ul>
        <li>
          <Link href="/privacy" className="text-primary underline">
            {t('marketing.legalPages.policies.sections.related.privacyPolicy')}
          </Link>
        </li>
        <li>
          <Link href="/subscription-returns" className="text-primary underline">
            {t('marketing.legalPages.policies.sections.related.subscriptionReturns')}
          </Link>
        </li>
        <li>
          <Link href="/pricing" className="text-primary underline">
            {t('marketing.legalPages.policies.sections.related.pricingPlans')}
          </Link>
        </li>
      </ul>
    </SaasStaticPage>
  );
}

export function SubscriptionReturnsContent() {
  const { t } = useTranslation();

  return (
    <SaasStaticPage
      title={t('marketing.legalPages.subscriptionReturns.title')}
      subtitle={t('marketing.legalPages.subscriptionReturns.subtitle')}
    >
      <h2 id="plans">
        {t('marketing.legalPages.subscriptionReturns.sections.planChanges.title')}
      </h2>
      <p>{t('marketing.legalPages.subscriptionReturns.sections.planChanges.body')}</p>

      <h2 id="cancellation">
        {t('marketing.legalPages.subscriptionReturns.sections.cancellation.title')}
      </h2>
      <p>{t('marketing.legalPages.subscriptionReturns.sections.cancellation.body')}</p>

      <h2 id="refunds">
        {t('marketing.legalPages.subscriptionReturns.sections.refunds.title')}
      </h2>
      <p>{t('marketing.legalPages.subscriptionReturns.sections.refunds.body')}</p>

      <h2 id="billing">
        {t('marketing.legalPages.subscriptionReturns.sections.billingDisputes.title')}
      </h2>
      <p>{t('marketing.legalPages.subscriptionReturns.sections.billingDisputes.body')}</p>

      <h2 id="contact">
        {t('marketing.legalPages.subscriptionReturns.sections.contact.title')}
      </h2>
      <p>
        {t('marketing.legalPages.subscriptionReturns.sections.contact.bodyPrefix')}{' '}
        <Link href="/demo-request" className="text-primary underline">
          {t('marketing.legalPages.subscriptionReturns.sections.contact.demoLink')}
        </Link>{' '}
        {t('marketing.legalPages.subscriptionReturns.sections.contact.bodyMiddle')}{' '}
        <Link href="/pricing" className="text-primary underline">
          {t('marketing.legalPages.subscriptionReturns.sections.contact.pricingLink')}
        </Link>
        .
      </p>
      <p className="text-xs text-muted-foreground">
        {t('marketing.legalPages.subscriptionReturns.sections.contact.disclaimer')}
      </p>
    </SaasStaticPage>
  );
}

export function RefundPolicyContent() {
  const { t } = useTranslation();

  return (
    <SaasStaticPage
      title={t('marketing.legalPages.refund.title')}
      subtitle={t('marketing.legalPages.refund.subtitle')}
    >
      <h2 id="cancellations">{t('marketing.legalPages.refund.sections.cancellations.title')}</h2>
      <p>{t('marketing.legalPages.refund.sections.cancellations.body')}</p>

      <h2 id="plan-changes">{t('marketing.legalPages.refund.sections.planChanges.title')}</h2>
      <p>{t('marketing.legalPages.refund.sections.planChanges.body')}</p>

      <h2 id="refund-eligibility">{t('marketing.legalPages.refund.sections.refundEligibility.title')}</h2>
      <p>{t('marketing.legalPages.refund.sections.refundEligibility.body')}</p>

      <h2 id="billing-disputes">{t('marketing.legalPages.refund.sections.billingDisputes.title')}</h2>
      <p>{t('marketing.legalPages.refund.sections.billingDisputes.body')}</p>

      <h2 id="contact">{t('marketing.legalPages.refund.sections.contact.title')}</h2>
      <p>
        {t('marketing.legalPages.refund.sections.contact.prefix')}{' '}
        <Link href="/demo-request" className="text-primary underline">
          {t('marketing.legalPages.refund.sections.contact.demoLink')}
        </Link>{' '}
        {t('marketing.legalPages.refund.sections.contact.middle')}{' '}
        <Link href="/pricing" className="text-primary underline">
          {t('marketing.legalPages.refund.sections.contact.pricingLink')}
        </Link>
        .
      </p>
    </SaasStaticPage>
  );
}

export function SitemapContent() {
  const { t } = useTranslation();

  const sections: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
    {
      title: t('marketing.legalPages.sitemap.sections.company.title'),
      links: [
        { label: t('marketing.legalPages.sitemap.sections.company.links.home'), href: '/' },
        {
          label: t('marketing.legalPages.sitemap.sections.company.links.documentation'),
          href: '/documentation',
        },
        { label: t('marketing.legalPages.sitemap.sections.company.links.pricing'), href: '/pricing' },
        {
          label: t('marketing.legalPages.sitemap.sections.company.links.requestDemo'),
          href: '/demo-request',
        },
      ],
    },
    {
      title: t('marketing.legalPages.sitemap.sections.legal.title'),
      links: [
        {
          label: t('marketing.legalPages.sitemap.sections.legal.links.privacyPolicy'),
          href: '/privacy-policy',
        },
        {
          label: t('marketing.legalPages.sitemap.sections.legal.links.refundPolicy'),
          href: '/refund-policy',
        },
        {
          label: t('marketing.legalPages.sitemap.sections.legal.links.platformPolicies'),
          href: '/policies',
        },
        {
          label: t('marketing.legalPages.sitemap.sections.legal.links.subscriptionReturns'),
          href: '/subscription-returns',
        },
      ],
    },
    {
      title: t('marketing.legalPages.sitemap.sections.account.title'),
      links: [
        { label: t('marketing.legalPages.sitemap.sections.account.links.register'), href: '/register' },
        { label: t('marketing.legalPages.sitemap.sections.account.links.login'), href: '/login' },
        {
          label: t('marketing.legalPages.sitemap.sections.account.links.resetPassword'),
          href: '/reset-password',
        },
        {
          label: t('marketing.legalPages.sitemap.sections.account.links.restaurantSignup'),
          href: '/restaurant-signup',
        },
      ],
    },
  ];

  return (
    <SaasStaticPage
      title={t('marketing.legalPages.sitemap.title')}
      subtitle={t('marketing.legalPages.sitemap.subtitle')}
    >
      <div className="grid gap-6 md:grid-cols-3">
        {sections.map((section) => (
          <section
            key={section.title}
            className="rounded-2xl border border-zinc-200/80 bg-white/60 p-5 dark:border-zinc-800 dark:bg-zinc-900/40"
          >
            <h2 className="mt-0 border-0 pb-0 text-lg">{section.title}</h2>
            <ul className="mt-3 list-none space-y-2 pl-0">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-primary underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </SaasStaticPage>
  );
}
