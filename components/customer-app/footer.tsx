import { AcceptedPaymentMethods } from '@/components/payments/accepted-payment-methods';
import { Button } from '@/components/ui/button';

export function Footer() {
  return (
    <footer className="relative z-50 border-t border-primary bg-primary px-6 py-10 text-primary-foreground shadow-[0_-4px_24px_rgba(15,23,42,0.08)]">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 md:grid-cols-3">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">Legal</p>
          <ul className="space-y-1 text-xs text-white/80">
            <li>General Terms and Conditions of Sale</li>
            <li>General Terms of Use</li>
            <li>Cookie Policy</li>
            <li>Privacy Policy</li>
            <li>Legal notice</li>
          </ul>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">
            Take advantage of the best offers
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-white/90 bg-white text-[#0f172a] hover:bg-[#f8fafc]"
            >
              App Store
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-white/90 bg-white text-[#0f172a] hover:bg-[#f8fafc]"
            >
              Google Play
            </Button>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-3 text-xs text-white/80">
          <AcceptedPaymentMethods variant="on-dark" size="sm" showPayPal />
          <p>
            Powered by <span className="text-white">Foodluk</span>
          </p>
          <p>Foodluk SAAS v3.0</p>
        </div>
      </div>
    </footer>
  );
}
