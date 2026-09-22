'use client';

import React, { useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import RolesCard from './components/roles';
import RestaurantUsersCard from './components/restaurant-users';
import { CustomerEntryLinks } from './components/customer-entry-links';
import { RestaurantBrandingCard } from './components/restaurant-branding';
import { RestaurantRegionalSettingsCard } from './components/restaurant-regional-settings-card';
import { RestaurantPaymentProviderCard } from './components/restaurant-payment-provider-card';
import { RestaurantBillingCard } from './components/restaurant-billing-card';
import { RestaurantServiceChargesCard } from './components/restaurant-service-charges-card';
import { RestaurantFulfillmentSettingsCard } from './components/restaurant-fulfillment-settings-card';
import { RestaurantDineInPaymentCard } from './components/restaurant-dine-in-payment-card';
import { UiLanguagePreferenceCard } from './components/ui-language-preference-card';
import { useRestaurantFulfillmentSettings } from '@/hooks/use-restaurant-fulfillment-settings';
import { SettingsSectionNav } from './settings-section-nav';
import {
  parseSettingsSection,
  type SettingsSectionId,
} from '@/constant/settingsNav';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import { useTranslation } from 'react-i18next';

export function Setting() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { plan } = useStaffPermissions();
  const { settings: fulfillmentSettings } = useRestaurantFulfillmentSettings();
  const brandingAllowed = plan?.branding !== false;
  const roleBasedSettingsAllowed = plan?.roleBasedSettings !== false;

  const section = useMemo(
    () => parseSettingsSection(searchParams.get('section')),
    [searchParams]
  );

  const activeSection = useMemo(() => {
    if (section === 'access' && !roleBasedSettingsAllowed) return 'basic';
    return section;
  }, [roleBasedSettingsAllowed, section]);

  const sectionCopy = useMemo(() => {
    const id = activeSection;
    return {
      title: t(`settings.sections.${id}.title`),
      description: t(`settings.sections.${id}.description`),
    };
  }, [activeSection, t]);

  useEffect(() => {
    if (section === 'access' && !roleBasedSettingsAllowed) {
      router.replace('/settings?section=basic');
    }
  }, [roleBasedSettingsAllowed, router, section]);

  const selectSection = (id: SettingsSectionId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id === 'basic') {
      params.delete('section');
    } else {
      params.set('section', id);
    }
    const query = params.toString();
    router.replace(query ? `/settings?${query}` : '/settings');
  };

  return (
    <div className="flex w-full min-w-0 flex-col">
      <div className="flex min-w-0 flex-1 flex-col bg-muted/40 px-4 pb-8 pt-2">
        <div className="mx-auto grid w-full min-w-0 max-w-6xl items-start gap-2 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
          <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <p className="mb-3 hidden text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:block">
              {t('settings.title')}
            </p>
            <SettingsSectionNav
              active={activeSection}
              onSelect={selectSection}
              accessAllowed={roleBasedSettingsAllowed}
            />
          </aside>

          <div className="min-w-0">
            <header className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight">
                {sectionCopy.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {sectionCopy.description}
              </p>
            </header>

            <div className="grid min-w-0 gap-6">
              {activeSection === 'basic' ? (
                <>
                  <CustomerEntryLinks />
                  <RestaurantFulfillmentSettingsCard />
                  <RestaurantBrandingCard brandingAllowed={brandingAllowed} />
                </>
              ) : null}

              {activeSection === 'access' && roleBasedSettingsAllowed ? (
                <>
                  <RestaurantUsersCard
                    roleBasedSettingsAllowed={roleBasedSettingsAllowed}
                  />
                  <RolesCard
                    roleBasedSettingsAllowed={roleBasedSettingsAllowed}
                  />
                </>
              ) : null}

              {activeSection === 'payments' ? (
                <>
                  {fulfillmentSettings.dineInEnabled ? (
                    <RestaurantDineInPaymentCard />
                  ) : null}
                  <RestaurantRegionalSettingsCard />
                  <RestaurantServiceChargesCard />
                  <RestaurantPaymentProviderCard
                    cardPaymentsEnabled={fulfillmentSettings.cardPaymentsEnabled}
                  />
                </>
              ) : null}

              {activeSection === 'billing' ? <RestaurantBillingCard /> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
