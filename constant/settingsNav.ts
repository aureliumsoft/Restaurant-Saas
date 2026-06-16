import type { LucideIcon } from 'lucide-react';
import { CreditCard, Receipt, Settings, Users } from 'lucide-react';

export type SettingsSectionId = 'basic' | 'access' | 'payments' | 'billing';

export type SettingsSection = {
  id: SettingsSectionId;
  title: string;
  description: string;
  icon: LucideIcon;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'basic',
    title: 'Basic settings',
    description: 'Customer links, branding, and storefront appearance.',
    icon: Settings,
  },
  {
    id: 'access',
    title: 'User access & roles',
    description: 'Invite team members and manage permissions.',
    icon: Users,
  },
  {
    id: 'payments',
    title: 'Payment methods',
    description: 'Service charges, PayPal or Stripe, and customer payments.',
    icon: CreditCard,
  },
  {
    id: 'billing',
    title: 'Billing',
    description: 'Subscription plan, invoices, and SaaS billing.',
    icon: Receipt,
  },
];

export function parseSettingsSection(
  value: string | null | undefined
): SettingsSectionId {
  if (
    value === 'access' ||
    value === 'payments' ||
    value === 'billing' ||
    value === 'basic'
  ) {
    return value;
  }
  return 'basic';
}
