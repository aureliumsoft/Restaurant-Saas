'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';

import RolesCard from './components/roles';
import RestaurantUsersCard from './components/restaurant-users';
import { CustomerEntryLinks } from './components/customer-entry-links';
import { RestaurantBrandingCard } from './components/restaurant-branding';
import { RestaurantPaymentProviderCard } from './components/restaurant-payment-provider-card';
import { RestaurantBillingCard } from './components/restaurant-billing-card';
import { RestaurantServiceChargesCard } from './components/restaurant-service-charges-card';
import { SettingsSectionNav } from './settings-section-nav';
import {
  parseSettingsSection,
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from '@/constant/settingsNav';

export function Setting() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [brandingAllowed, setBrandingAllowed] = useState(true);
  const [roleBasedSettingsAllowed, setRoleBasedSettingsAllowed] =
    useState(true);

  const section = useMemo(
    () => parseSettingsSection(searchParams.get('section')),
    [searchParams]
  );

  const activeSection = useMemo(() => {
    if (section === 'access' && !roleBasedSettingsAllowed) return 'basic';
    return section;
  }, [roleBasedSettingsAllowed, section]);

  const activeMeta = SETTINGS_SECTIONS.find((item) => item.id === activeSection);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get<{
          data?: {
            limits?: { branding?: boolean; roleBasedSettings?: boolean };
          };
        }>('/api/me/subscription-access');
        const lim = res.data?.data?.limits;
        if (cancelled || !lim) return;
        setBrandingAllowed(lim.branding !== false);
        setRoleBasedSettingsAllowed(lim.roleBasedSettings !== false);
      } catch {
        if (!cancelled) {
          setBrandingAllowed(true);
          setRoleBasedSettingsAllowed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
              Settings
            </p>
            <SettingsSectionNav
              active={activeSection}
              onSelect={selectSection}
              accessAllowed={roleBasedSettingsAllowed}
            />
          </aside>

          <div className="min-w-0">
            {activeMeta ? (
              <header className="mb-6">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {activeMeta.title}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeMeta.description}
                </p>
              </header>
            ) : null}

            <div className="grid min-w-0 gap-6">
              {activeSection === 'basic' ? (
                <>
                  <CustomerEntryLinks />
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
                  <RestaurantServiceChargesCard />
                  <RestaurantPaymentProviderCard />
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
