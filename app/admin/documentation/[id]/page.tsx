'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

import { AdminDocModuleForm } from '@/components/admin/admin-doc-module-form';

type ModuleDto = {
  id: string;
  name: string;
  shortDescription: string;
  contentHtml: string;
  status: string;
  sortOrder: number;
  headingId: string | null;
  subHeadingId: string | null;
  subHeading?: { id: string; name: string; slug: string } | null;
};

export default function AdminDocumentationEditPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [mod, setMod] = useState<ModuleDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get<{ data: ModuleDto }>(
          `/api/admin/documentation/${id}`
        );
        if (!cancelled) setMod(res.data.data);
      } catch {
        if (!cancelled) toast.error('Could not load page.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!mod) {
    return (
      <p className="text-sm text-muted-foreground">Documentation page not found.</p>
    );
  }

  return (
    <AdminDocModuleForm
      mode="edit"
      moduleId={mod.id}
      initial={{
        headingId: mod.headingId ?? '',
        subHeadingName: mod.subHeading?.name ?? '',
        name: mod.name,
        shortDescription: mod.shortDescription,
        contentHtml: mod.contentHtml,
        status: mod.status,
        sortOrder: mod.sortOrder,
      }}
    />
  );
}
