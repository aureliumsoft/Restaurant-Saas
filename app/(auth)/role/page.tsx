"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { PublicAuthShell } from "@/components/marketing/public-auth-shell";
import { isPlatformAdminSession } from "@/lib/auth/admin";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

type Role = "OWNER" | "WORKER";

const ALLOWED: Role[] = ["OWNER", "WORKER"];

function RolePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const desiredRole = searchParams.get("role");
  const parsedDesiredRole = useMemo<Role | null>(() => {
    if (!desiredRole) return null;
    if (ALLOWED.includes(desiredRole as Role)) return desiredRole as Role;
    return null;
  }, [desiredRole]);

  const [loading, setLoading] = useState(false);

  const currentRole = (session?.user as any)?.role as string | undefined;
  const roleNeedsUpdate =
    status === "authenticated" && (!currentRole || currentRole === "UNKNOW");

  async function updateRole(role: Role) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? t("auth.role.updateFailed"));
        return;
      }

      toast.success(t("auth.role.signupSuccess"));
      if (role === "OWNER") {
        router.replace("/onboarding/1");
      } else {
        router.replace("/dashboard");
      }
    } catch (err: any) {
      toast.error(err?.message ?? t("auth.role.updateFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    if (status !== "authenticated") return;

    // If they already have a role, send them to the app (platform admin → SaaS admin).
    if (currentRole && currentRole !== "UNKNOW") {
      router.replace(
        isPlatformAdminSession(session?.user)
          ? "/admin/dashboard"
          : "/dashboard"
      );
      return;
    }

    // If a desired role was provided (Google owner/worker signup), apply it automatically.
    if (roleNeedsUpdate && parsedDesiredRole) {
      updateRole(parsedDesiredRole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, currentRole, roleNeedsUpdate, parsedDesiredRole]);

  if (status === "loading" || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4 py-10 dark:bg-black">
        <div className="text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 mr-2 animate-spin text-primary" />
        </div>
      </main>
    );
  }

  return (
    <PublicAuthShell
      title={t("auth.role.title")}
      subtitle={t("auth.role.subtitle")}
    >
        {roleNeedsUpdate ? (
          <div className="flex flex-col gap-3">
            <Button disabled={loading} onClick={() => updateRole("OWNER")}>
              {t("auth.role.continueOwner")}
            </Button>
            <Button disabled={loading} onClick={() => updateRole("WORKER")}>
              {t("auth.role.continueWorker")}
            </Button>
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground">
            {t("auth.role.redirecting")}
          </div>
        )}
    </PublicAuthShell>
  );
}

function RolePageSuspenseFallback() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-10 dark:bg-black">
      <div className="text-center text-sm text-muted-foreground">
        {t("auth.role.loading")}
      </div>
    </main>
  );
}

export default function RolePageWithSuspense() {
  return (
    <Suspense fallback={<RolePageSuspenseFallback />}>
      <RolePage />
    </Suspense>
  );
}
