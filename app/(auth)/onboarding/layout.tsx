'use client';

import { LanguageSwitcher } from '@/components/main/language-switcher';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[calc(100vh-0px)] bg-muted/30 px-4 py-8 dark:bg-black">
      <div className="mx-auto flex max-w-lg flex-col gap-4">
        <div className="flex justify-end">
          <LanguageSwitcher variant="inline" />
        </div>
        {children}
      </div>
    </div>
  );
}
