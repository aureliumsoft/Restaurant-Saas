"use client";

import React, { useEffect, useState } from "react";
import type { Session } from "next-auth";
import { I18nextProvider } from "react-i18next";
import { ThemeProvider } from "@/components/theme-provider";
import NextTopLoader from "nextjs-toploader";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { UiLanguageProvider } from "@/components/i18n/ui-language-context";
import {
  ensureI18nInitialized,
  hydrateUiLanguageFromStorage,
  i18n,
} from "@/lib/i18n/client";
import type { UiLanguage } from "@/lib/i18n/resources";
import { DEFAULT_UI_LANGUAGE } from "@/lib/i18n/resources";
import { OfflineBootstrap } from "@/components/offline/offline-bootstrap";
import { AppSWRProvider } from "@/components/providers/app-swr-provider";
import { AuthSessionProvider } from "@/components/providers/auth-session-provider";

import { RestaurantBrandingProvider } from "@/components/layout/restaurant-branding-provider";

/**
 * Mount Vercel metrics after the first paint so they do not run in the same
 * React commit as a layout swap (e.g. dashboard → /pos). That combination
 * has triggered DOM/removeChild races with the App Router.
 */
function DeferredVercelMetrics() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  if (!ready) return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

function UiLanguageHydrator() {
  useEffect(() => {
    hydrateUiLanguageFromStorage();
  }, []);
  return null;
}

export default function Providers({
  initialLanguage = DEFAULT_UI_LANGUAGE,
  session = null,
  children,
}: {
  initialLanguage?: UiLanguage;
  session?: Session | null;
  children: React.ReactNode;
}) {
  ensureI18nInitialized(initialLanguage);

  return (
    <I18nextProvider i18n={i18n}>
      <UiLanguageProvider language={initialLanguage}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <AuthSessionProvider session={session}>
          <AppSWRProvider>
            <RestaurantBrandingProvider>
            <NextTopLoader showSpinner={false} />
            <OfflineBootstrap />
            <UiLanguageHydrator />
            {children}
            <ToastContainer
              position="top-right"
              autoClose={4000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick
              draggable
              style={{ zIndex: 9999 }}
            />
            <DeferredVercelMetrics />
          </RestaurantBrandingProvider>
          </AppSWRProvider>
        </AuthSessionProvider>
      </ThemeProvider>
      </UiLanguageProvider>
    </I18nextProvider>
  );
}
