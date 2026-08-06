import { DocumentationSidebar } from '@/components/marketing/documentation-sidebar';
import { loadPublicDocNav } from '@/lib/documentation/public';

export const dynamic = 'force-dynamic';

export default async function DocumentationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nav = await loadPublicDocNav();

  return (
    <div className="flex w-full flex-1 flex-col bg-white pt-[5.5rem] text-zinc-900 dark:bg-zinc-950 dark:text-white">
      <div className="flex w-full min-h-[calc(100vh-5.5rem)] flex-col border-t border-zinc-200 dark:border-zinc-800 md:flex-row">
        <DocumentationSidebar nav={nav} />
        <div className="min-w-0 flex-1 px-4 py-8 sm:px-6 md:px-10 lg:px-14 lg:py-10">
          {children}
        </div>
      </div>
    </div>
  );
}
