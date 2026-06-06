'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { toast } from 'react-toastify';
import { IconCopy, IconExternalLink } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { kioskBasePath } from '@/lib/kiosk-path';

type BranchRow = { id: string; name: string };

export function CustomerEntryLinks() {
  const [slug, setSlug] = useState<string | null>(null);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [publicBase, setPublicBase] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [restaurantRes, branchesRes] = await Promise.all([
          axios.get<{ data: { slug?: string } | null }>('/api/restaurant'),
          axios.get<{ data?: BranchRow[] }>('/api/restaurant/branches'),
        ]);
        const s = restaurantRes.data?.data?.slug?.trim();
        if (!cancelled) {
          setSlug(s && s.length > 0 ? s : null);
          setBranches(branchesRes.data?.data ?? []);
        }
      } catch {
        if (!cancelled) {
          setSlug(null);
          setBranches([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPublicBase(typeof window !== 'undefined' ? window.location.origin : '');
  }, []);

  const webAppPath = slug ? `/web-app/${encodeURIComponent(slug)}` : '';

  const webAppUrl =
    publicBase && webAppPath ? `${publicBase}${webAppPath}` : webAppPath;

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Website & kiosk</CardTitle>
          <CardDescription>
            <Loader2 className=" animate-spin text-primary text-center mx-auto" />{' '}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!slug) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Website & kiosk</CardTitle>
          <CardDescription>
            No restaurant is linked to your account yet, so customer URLs are
            unavailable.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Public URLs</CardTitle>
          <CardDescription>
            Share or configure these absolute links (your current domain +
            path). Each kiosk device should use its branch-specific kiosk URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              Customer website
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="block flex-1 break-all rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                {webAppUrl}
              </code>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 gap-1"
                onClick={() => void copyText('Website URL', webAppUrl)}
              >
                <IconCopy className="h-4 w-4" aria-hidden />
                Copy
              </Button>
              <Button asChild className="gap-2">
                <Link
                  href={webAppPath}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open website
                  <IconExternalLink className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Kiosk UI</p>
            {branches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add at least one branch to generate kiosk URLs.
              </p>
            ) : (
              branches.map((branch) => {
                const path = kioskBasePath(slug, branch.id);
                const url =
                  publicBase && path ? `${publicBase}${path}` : path;
                return (
                  <div
                    key={branch.id}
                    className="space-y-2 rounded-md border bg-muted/20 p-3"
                  >
                    <p className="text-sm font-medium">{branch.name}</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <code className="block flex-1 break-all rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                        {url}
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0 gap-1"
                        onClick={() =>
                          void copyText(`${branch.name} kiosk URL`, url)
                        }
                      >
                        <IconCopy className="h-4 w-4" aria-hidden />
                        Copy
                      </Button>
                      <Button asChild className="gap-2">
                        <Link
                          href={path}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open kiosk
                          <IconExternalLink className="h-4 w-4" aria-hidden />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
