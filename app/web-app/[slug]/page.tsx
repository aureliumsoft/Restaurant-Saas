import { WebAppStorefront } from '@/components/customer-app/web-app-storefront';

export default async function WebAppBySlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="flex flex-1 flex-col bg-transparent text-inherit">
      <WebAppStorefront slug={slug} />
    </div>
  );
}
