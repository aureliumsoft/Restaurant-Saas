'use client';

import Header from '@/components/main/header';
import Footer from '@/components/main/footer';
import { LandingFaqSection } from '@/components/marketing/landing-faq-section';
import { LandingContactSection } from '@/components/marketing/landing-contact-section';
import { LandingNewsletterSection } from '@/components/marketing/landing-newsletter-section';
import {
  LandingFeaturesSection,
  LandingHeroSection,
  LandingStatsSection,
} from '@/components/marketing/landing-classic-sections';
import {
  ProductStoryFontScope,
  ProductStorySections,
} from '@/components/marketing/product-story-sections';

export function HomePage() {
  return (
    <ProductStoryFontScope>
      <div className="marketing-site-shell relative min-h-screen w-full overflow-x-hidden bg-white text-zinc-900 transition-colors dark:bg-black dark:text-white">
        <Header />

        <main className="marketing-site-main relative w-full overflow-x-hidden">
          <LandingHeroSection />
          <LandingFeaturesSection />
          <LandingStatsSection />
          <ProductStorySections />
          <LandingContactSection />
          <LandingFaqSection />
          <LandingNewsletterSection />
          <Footer />
        </main>
      </div>
    </ProductStoryFontScope>
  );
}
