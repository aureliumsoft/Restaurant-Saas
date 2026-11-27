'use client';

import { useTranslation } from 'react-i18next';

type KioskKeyboardMode = 'text' | 'phone';

type KioskKeyboardProps = {
  mode: KioskKeyboardMode;
  onKey: (key: string) => void;
};

const LETTER_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const PHONE_ROWS = ['123', '456', '789', '0'];

function Key({
  label,
  keyId,
  className,
  onKey,
}: {
  label: string;
  keyId: string;
  className?: string;
  onKey: (key: string) => void;
}) {
  return (
    <button
      type="button"
      className={className ? `kiosk-key ${className}` : 'kiosk-key'}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onKey(keyId);
      }}
    >
      {label}
    </button>
  );
}

export function KioskKeyboard({ mode, onKey }: KioskKeyboardProps) {
  const { t } = useTranslation();
  const rows = mode === 'phone' ? PHONE_ROWS : LETTER_ROWS;

  return (
    <div
      className="kiosk-keys"
      role="group"
      aria-label={t('pos.keyboard.onScreenKeyboard')}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.preventDefault()}
    >
      {rows.map((row) => (
        <div key={row} className="kiosk-keyrow">
          {row.split('').map((key) => (
            <Key
              key={key}
              keyId={key}
              label={mode === 'phone' ? key : key.toUpperCase()}
              onKey={onKey}
            />
          ))}
        </div>
      ))}
      <div className="kiosk-keyrow">
        {mode === 'text' ? (
          <Key
            keyId=" "
            label={t('kioskKeySpace')}
            className="is-space"
            onKey={onKey}
          />
        ) : null}
        <Key
          keyId="del"
          label={t('kioskKeyDelete')}
          className="is-del"
          onKey={onKey}
        />
      </div>
    </div>
  );
}
