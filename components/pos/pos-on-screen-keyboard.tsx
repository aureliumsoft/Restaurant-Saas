'use client';

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Delete, GripVertical, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type PosKeyboardMode = 'text' | 'numeric' | 'phone';

type PosOnScreenKeyboardProps = {
  mode: PosKeyboardMode;
  value: string;
  onChange: (next: string) => void;
  onClose?: () => void;
  className?: string;
  /** Max length for phone / amount safety */
  maxLength?: number;
  /**
   * Portal to document.body (default). Set false when used inside a modal
   * Dialog — otherwise Radix marks the portal inert and keys do nothing.
   */
  portal?: boolean;
};

const TEXT_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '-', "'"],
];

const NUMERIC_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'back'],
];

const PHONE_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'back'],
];

function KeyButton({
  label,
  onPress,
  className,
  wide,
}: {
  label: ReactNode;
  onPress: () => void;
  className?: string;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-11 items-center justify-center rounded-lg bg-background text-sm font-semibold text-foreground ring-1 ring-border/50 transition active:scale-[0.97] active:bg-fire-500 active:text-white',
        wide ? 'col-span-2' : '',
        className
      )}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPress();
      }}
    >
      {label}
    </button>
  );
}

function clampPosition(
  x: number,
  y: number,
  width: number,
  height: number
): { x: number; y: number } {
  const maxX = Math.max(0, window.innerWidth - width);
  const maxY = Math.max(0, window.innerHeight - height);
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  };
}

export function PosOnScreenKeyboard({
  mode,
  value,
  onChange,
  onClose,
  className,
  maxLength = 120,
  portal = true,
}: PosOnScreenKeyboardProps) {
  const [mounted, setMounted] = useState(!portal);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(
    portal ? null : { x: 0, y: 0 }
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!portal) return;
    setMounted(true);
  }, [portal]);

  useEffect(() => {
    if (!portal || !mounted) return;

    const placeDefault = () => {
      const el = panelRef.current;
      const width =
        el?.offsetWidth ??
        (mode === 'text' ? Math.min(720, window.innerWidth - 24) : 280);
      const height = el?.offsetHeight ?? (mode === 'text' ? 280 : 320);
      const preferred =
        lastPosRef.current ??
        {
          x: Math.max(12, (window.innerWidth - width) / 2),
          y: Math.max(12, window.innerHeight - height - 24),
        };
      const next = clampPosition(preferred.x, preferred.y, width, height);
      lastPosRef.current = next;
      setPos(next);
    };

    const id = window.requestAnimationFrame(placeDefault);
    const onResize = () => {
      const el = panelRef.current;
      if (!el || !lastPosRef.current) return;
      const next = clampPosition(
        lastPosRef.current.x,
        lastPosRef.current.y,
        el.offsetWidth,
        el.offsetHeight
      );
      lastPosRef.current = next;
      setPos(next);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener('resize', onResize);
    };
  }, [mounted, mode, portal]);

  const append = (char: string) => {
    if (value.length >= maxLength) return;
    onChange(value + char);
  };

  const backspace = () => {
    onChange(value.slice(0, -1));
  };

  const clear = () => onChange('');

  const pressNumeric = (key: string) => {
    if (key === 'back') {
      backspace();
      return;
    }
    if (key === '') return;
    if (key === '.') {
      if (mode !== 'numeric') return;
      if (value.includes('.')) return;
      append(value.length === 0 ? '0.' : '.');
      return;
    }
    if (mode === 'numeric' && value === '0' && key !== '.') {
      onChange(key);
      return;
    }
    append(key);
  };

  const onDragPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!portal || !pos) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
  };

  const onDragPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const el = panelRef.current;
    const width = el?.offsetWidth ?? 280;
    const height = el?.offsetHeight ?? 280;
    const next = clampPosition(
      drag.origX + (e.clientX - drag.startX),
      drag.origY + (e.clientY - drag.startY),
      width,
      height
    );
    lastPosRef.current = next;
    setPos(next);
  };

  const onDragPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const header = (
    <div
      className={cn(
        'mb-2 flex items-center justify-between gap-2 rounded-xl bg-background/60 px-1.5 py-1',
        portal && 'cursor-grab active:cursor-grabbing'
      )}
      onPointerDown={portal ? onDragPointerDown : undefined}
      onPointerMove={portal ? onDragPointerMove : undefined}
      onPointerUp={portal ? onDragPointerUp : undefined}
      onPointerCancel={portal ? onDragPointerUp : undefined}
      style={portal ? { touchAction: 'none' } : undefined}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {portal ? (
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : null}
        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {mode === 'phone'
            ? 'Phone keypad'
            : mode === 'numeric'
              ? 'Amount keypad'
              : 'Keyboard'}
          {portal ? (
            <span className="ml-1.5 font-normal normal-case tracking-normal opacity-70">
              · drag to move
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 rounded-lg px-2 text-xs"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            clear();
          }}
        >
          Clear
        </Button>
        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close keyboard"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );

  const body =
    mode === 'numeric' || mode === 'phone' ? (
      <div className="grid grid-cols-3 gap-1.5">
        {(mode === 'phone' ? PHONE_KEYS : NUMERIC_KEYS).flatMap((row, ri) =>
          row.map((key, ki) => {
            if (key === '') {
              return <div key={`${ri}-${ki}`} />;
            }
            return (
              <KeyButton
                key={`${ri}-${ki}-${key}`}
                label={
                  key === 'back' ? <Delete className="h-4 w-4" /> : key
                }
                onPress={() => pressNumeric(key)}
                className="h-12 text-base"
              />
            );
          })
        )}
      </div>
    ) : (
      <div className="space-y-1.5">
        {TEXT_ROWS.map((row) => (
          <div key={row.join('')} className="flex justify-center gap-1">
            {row.map((key) => (
              <KeyButton
                key={key}
                label={key}
                className="min-w-0 flex-1 px-0 text-xs sm:text-sm"
                onPress={() =>
                  append(
                    key.length === 1 && /[A-Z]/.test(key)
                      ? key.toLowerCase()
                      : key
                  )
                }
              />
            ))}
          </div>
        ))}
        <div className="flex gap-1">
          <KeyButton
            label={<Delete className="h-4 w-4" />}
            className="w-14 shrink-0"
            onPress={backspace}
          />
          <KeyButton
            label="Space"
            wide
            className="min-w-0 flex-[3] text-xs"
            onPress={() => append(' ')}
          />
          <KeyButton
            label="@"
            className="w-10 shrink-0"
            onPress={() => append('@')}
          />
          <KeyButton
            label="."
            className="w-10 shrink-0"
            onPress={() => append('.')}
          />
        </div>
      </div>
    );

  if (portal && !mounted) return null;

  const panel = (
    <div
      ref={panelRef}
      data-pos-osk=""
      role="group"
      aria-label="On-screen keyboard"
      className={cn(
        'rounded-2xl border border-border/50 bg-card p-2 shadow-2xl ring-1 ring-border/40',
        portal
          ? cn(
              'fixed z-[300]',
              mode === 'text'
                ? 'w-[min(720px,calc(100vw-24px))]'
                : 'w-[min(300px,calc(100vw-24px))]'
            )
          : 'relative z-10 w-full',
        className
      )}
      style={
        portal
          ? {
              left: pos?.x ?? 12,
              top: pos?.y ?? 12,
              visibility: pos ? 'visible' : 'hidden',
            }
          : undefined
      }
      onMouseDown={(e) => e.preventDefault()}
    >
      {header}
      {body}
    </div>
  );

  if (!portal) return panel;
  return createPortal(panel, document.body);
}
