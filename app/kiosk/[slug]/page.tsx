import Link from 'next/link';

import { db } from '@/lib/db';
import { kioskBasePath } from '@/lib/kiosk-path';

import '../kiosk-light.css';

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function KioskBranchPickerPage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: {
      name: true,
      branches: {
        orderBy: { name: 'asc' },
        select: { id: true, name: true, address: true },
      },
    },
  });

  if (!restaurant) {
    return (
      <div className="kiosk-light-root flex min-h-screen items-center justify-center bg-[#f8fafc] p-6">
        <p className="text-center text-[#64748b]">Restaurant not found.</p>
      </div>
    );
  }

  if (restaurant.branches.length === 0) {
    return (
      <div className="kiosk-light-root flex min-h-screen items-center justify-center bg-[#f8fafc] p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-[#0f172a]">
            {restaurant.name}
          </h1>
          <p className="mt-2 text-sm text-[#64748b]">
            No branches configured. Add a branch in Settings, then use a kiosk
            URL like{' '}
            <code className="rounded bg-white px-1 py-0.5 text-xs">
              /kiosk/{slug}/[branchId]
            </code>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="kiosk-light-root min-h-screen bg-[#f8fafc] p-6">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold text-[#0f172a]">
          {restaurant.name}
        </h1>
        <p className="mt-2 text-sm text-[#64748b]">
          Select the branch for this kiosk device. Each install should use its
          own branch URL.
        </p>
        <ul className="mt-6 space-y-3">
          {restaurant.branches.map((branch) => (
            <li key={branch.id}>
              <Link
                href={kioskBasePath(slug, branch.id)}
                className="block rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm transition hover:border-primary hover:bg-primary/5"
              >
                <p className="font-semibold text-[#0f172a]">{branch.name}</p>
                {branch.address ? (
                  <p className="mt-1 text-sm text-[#64748b]">{branch.address}</p>
                ) : null}
                <p className="mt-2 font-mono text-xs text-[#94a3b8]">
                  {kioskBasePath(slug, branch.id)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
