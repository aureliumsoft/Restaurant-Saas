'use client';

import { useTranslation } from 'react-i18next';

type Props = {
  secondsLeft: number;
};

/** Full-screen idle warning: large 5…1 before returning to kiosk home. */
export function KioskIdleCountdown({ secondsLeft }: Props) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/70 px-6 text-center text-white animate-in fade-in-0 duration-200"
      role="alertdialog"
      aria-live="assertive"
      aria-modal="true"
    >
      <p className="text-8xl font-bold tabular-nums leading-none sm:text-9xl">
        {secondsLeft}
      </p>
      <p className="mt-6 max-w-md text-lg font-medium text-white/90 sm:text-xl">
        {t('kioskReturningHome', { seconds: secondsLeft })}
      </p>
      <p className="mt-2 text-sm text-white/70">{t('kioskIdleTouchToStay')}</p>
    </div>
  );
}
