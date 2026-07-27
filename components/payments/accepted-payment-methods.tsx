import Image from 'next/image';
import { cn } from '@/lib/utils';

export type AcceptedPaymentMethod = {
  id: string;
  name: string;
  imageUrl: string;
};

export const ACCEPTED_CARD_PAYMENTS: AcceptedPaymentMethod[] = [
  { id: 'visa', name: 'Visa', imageUrl: '/payments/visa.png' },
  { id: 'mastercard', name: 'Mastercard', imageUrl: '/payments/mastercard.jpg' },
  {
    id: 'amex',
    name: 'American Express',
    imageUrl: '/payments/amex.jpg',
  },
  { id: 'discover', name: 'Discover', imageUrl: '/payments/discover.jpg' },
  { id: 'diners', name: 'Diners Club', imageUrl: '/payments/diners.jpg' },
  { id: 'jcb', name: 'JCB', imageUrl: '/payments/jcb.jpg' },
];

export const PAYPAL_PAYMENT: AcceptedPaymentMethod = {
  id: 'paypal',
  name: 'PayPal',
  imageUrl: '/payments/paypal.png',
};

export const JAZZCASH_PAYMENT: AcceptedPaymentMethod = {
  id: 'jazzcash',
  name: 'JazzCash',
  imageUrl: '/payments/jazzcash.svg',
};

export const EASYPAISA_PAYMENT: AcceptedPaymentMethod = {
  id: 'easypaisa',
  name: 'Easypaisa',
  imageUrl: '/payments/easypaisa.svg',
};

/** @deprecated Use ACCEPTED_CARD_PAYMENTS */
export const ACCEPTED_CARD_BRANDS = ACCEPTED_CARD_PAYMENTS.map((m) => ({
  id: m.id,
  label: m.name,
}));

type Props = {
  className?: string;
  size?: 'sm' | 'md';
  variant?: 'default' | 'on-dark';
  showPayPal?: boolean;
  showJazzCash?: boolean;
  showEasypaisa?: boolean;
  showLabel?: boolean;
  label?: string;
  /** Override default card list */
  methods?: AcceptedPaymentMethod[];
};

const sizeConfig = {
  sm: { width: 36, height: 24, className: 'h-6 w-9' },
  md: { width: 48, height: 32, className: 'h-8 w-12' },
};

function PaymentMethodBadge({
  method,
  size,
  onDark,
}: {
  method: AcceptedPaymentMethod;
  size: 'sm' | 'md';
  onDark: boolean;
}) {
  const { width, height, className: sizeClass } = sizeConfig[size];

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 overflow-hidden rounded bg-white',
        sizeClass,
        'ring-1',
        onDark ? 'ring-white/25' : 'ring-border/60'
      )}
      title={method.name}
    >
      <Image
        src={method.imageUrl}
        alt={method.name}
        width={width}
        height={height}
        className="h-full w-full object-contain p-0.5"
        unoptimized={method.imageUrl.endsWith('.svg')}
      />
    </span>
  );
}

export function AcceptedPaymentMethods({
  className,
  size = 'md',
  variant = 'default',
  showPayPal = false,
  showJazzCash = false,
  showEasypaisa = false,
  showLabel = true,
  label = 'We accept',
  methods = ACCEPTED_CARD_PAYMENTS,
}: Props) {
  const onDark = variant === 'on-dark';
  const displayMethods = [
    ...(showPayPal ? [PAYPAL_PAYMENT] : []),
    ...(showJazzCash ? [JAZZCASH_PAYMENT] : []),
    ...(showEasypaisa ? [EASYPAISA_PAYMENT] : []),
    ...methods,
  ];
  const ariaNames = displayMethods.map((m) => m.name).join(', ');

  return (
    <div
      className={cn('flex flex-col gap-2', className)}
      role="group"
      aria-label={`${label}: ${ariaNames}`}
    >
      {showLabel ? (
        <p
          className={cn(
            'text-xs font-medium',
            onDark ? 'text-white/80' : 'text-muted-foreground'
          )}
        >
          {label}
        </p>
      ) : null}
      <ul className="flex flex-wrap items-center gap-1.5">
        {displayMethods.map((method) => (
          <li key={method.id}>
            <PaymentMethodBadge method={method} size={size} onDark={onDark} />
          </li>
        ))}
      </ul>
    </div>
  );
}
