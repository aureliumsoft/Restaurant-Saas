"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PublicAuthShell } from "@/components/marketing/public-auth-shell";

function ResetPasswordPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token");

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const token = tokenFromUrl;
  const isConfirmMode = !!token;

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          res.status === 404
            ? t("auth.reset.userNotFound")
            : data?.error ?? t("auth.reset.requestFailed")
        );
        return;
      }

      toast.success(t("auth.reset.linkSent"));
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : t("auth.reset.requestFailed")
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmReset(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error(t("auth.reset.missingToken"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("auth.reset.passwordsMismatch"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: newPassword }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? t("auth.reset.confirmFailed"));
        return;
      }

      toast.success(t("auth.reset.success"));
      router.push("/login");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : t("auth.reset.confirmFailed")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicAuthShell
      title={t("auth.reset.title")}
      subtitle={t("auth.reset.subtitleRequest")}
    >
      {!isConfirmMode ? (
        <form onSubmit={requestReset} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <Button disabled={loading} type="submit">
            {loading ? t("auth.reset.sending") : t("auth.reset.sendLink")}
          </Button>

          <div className="text-center text-sm">
            <Link className="text-primary underline" href="/login">
              {t("auth.reset.backToLogin")}
            </Link>
          </div>
        </form>
      ) : (
        <form onSubmit={confirmReset} className="flex flex-col gap-4">
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <div className="mb-1 font-medium">{t("auth.reset.tokenFromUrl")}</div>
            <div className="break-all font-mono">{token}</div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="newPassword">{t("auth.reset.newPassword")}</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword">
              {t("auth.reset.confirmPassword")}
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <Button disabled={loading} type="submit">
            {loading ? t("auth.reset.resetting") : t("auth.reset.submit")}
          </Button>

          <div className="text-center text-sm">
            <Link className="text-primary underline" href="/login">
              {t("auth.reset.backToLogin")}
            </Link>
          </div>
        </form>
      )}
    </PublicAuthShell>
  );
}

export default function ResetPasswordPageWithSuspense() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-white px-4 py-10 dark:bg-black">
          <div className="text-center text-sm text-muted-foreground">
            {t("auth.loading")}
          </div>
        </main>
      }
    >
      <ResetPasswordPage />
    </Suspense>
  );
}
