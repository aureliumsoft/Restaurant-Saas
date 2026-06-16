export type SandboxDemoBilling = {
  line1: string;
  city: string;
  state?: string;
  postalCode: string;
  countryCode: string;
};

export type SandboxDemoCard = {
  brand: string;
  number: string;
  expiry: string;
  cvv: string;
  name: string;
  billing: SandboxDemoBilling;
};

/** Official PayPal sandbox Visa — works better than overused 403203… cards. */
export const PAYPAL_SANDBOX_DEMO_CARD: SandboxDemoCard = {
  brand: 'Visa',
  number: '4012888888881881',
  expiry: '12/2030',
  cvv: '123',
  name: 'John Doe',
  billing: {
    line1: '123 Main St',
    city: 'Berlin',
    postalCode: '10115',
    countryCode: 'DE',
  },
};

export function sandboxBillingForCurrency(currency: string): SandboxDemoBilling {
  switch (currency.toUpperCase()) {
    case 'GBP':
      return {
        line1: '1 London Bridge',
        city: 'London',
        postalCode: 'SE1 9BG',
        countryCode: 'GB',
      };
    case 'USD':
      return {
        line1: '123 Main St',
        city: 'San Jose',
        state: 'CA',
        postalCode: '95131',
        countryCode: 'US',
      };
    case 'AUD':
      return {
        line1: '1 Martin Place',
        city: 'Sydney',
        postalCode: '2000',
        countryCode: 'AU',
      };
    default:
      return PAYPAL_SANDBOX_DEMO_CARD.billing;
  }
}

export function sandboxDemoCardForCurrency(currency: string): SandboxDemoCard {
  return {
    ...PAYPAL_SANDBOX_DEMO_CARD,
    billing: sandboxBillingForCurrency(currency),
  };
}
