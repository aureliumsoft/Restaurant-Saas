'use client';

import { useTranslation } from 'react-i18next';

type Props = {
  secondsLeft: number;
  onStay: () => void;
  onStartOver: () => void;
};

/** Rest dialog shown after the kiosk has been idle. */
export function KioskIdleCountdown({
  secondsLeft,
  onStay,
  onStartOver,
}: Props) {
  const { t } = useTranslation();

  return (
    <div
      className="kiosk-idle"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="kiosk-idle-title"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="kiosk-idle-card">
        <h2 id="kiosk-idle-title">{t('kioskStillThere')}</h2>
        <p>{t('kioskStillHint')}</p>
        <p aria-live="polite">{t('kioskIdleSeconds', { seconds: secondsLeft })}</p>
        <button type="button" className="kiosk-idle-stay" onClick={onStay}>
          {t('kioskIdleStay')}
        </button>
        <button type="button" className="kiosk-idle-leave" onClick={onStartOver}>
          {t('kioskIdleLeave')}
        </button>
      </div>
    </div>
  );
}
