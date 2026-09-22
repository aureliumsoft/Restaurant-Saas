import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Order Path',
  description: 'Order Path',
};

export default async function OrderPathLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <main className="flex flex-col min-h-screen w-full">{children}</main>
    </>
  );
}
