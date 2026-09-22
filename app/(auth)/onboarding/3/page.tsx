"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearOnboardingRestaurantId,
  getOnboardingRestaurantId,
} from "@/lib/onboarding/storage";
import { OnboardingSteps } from "../OnboardingSteps";
import { ArrowRight, Loader2, Trash2 } from "lucide-react";

type BranchRow = { name: string; address: string; phone: string };

export default function OnboardingStep3Page() {
  const { t } = useTranslation();
  const router = useRouter();
  const { status } = useSession();

  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [rows, setRows] = useState<BranchRow[]>([
    { name: "", address: "", phone: "" },
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    const id = getOnboardingRestaurantId();
    if (!id) {
      toast.error(t("onboarding.common.completeStep1First"));
      router.replace("/onboarding/1");
      return;
    }
    setRestaurantId(id);
  }, [status, router, t]);

  function updateRow(i: number, field: keyof BranchRow, v: string) {
    setRows((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: v };
      return next;
    });
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function finish(skipBranches: boolean) {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const branches = skipBranches
        ? []
        : rows
            .map((r) => ({
              name: r.name.trim(),
              address: r.address.trim(),
              phone: r.phone.trim(),
            }))
            .filter((r) => r.name.length > 0);

      if (
        !skipBranches &&
        rows.some((r) => r.name.trim() === "" && (r.address || r.phone))
      ) {
        toast.error(t("onboarding.step3.branchNameRequired"));
        setLoading(false);
        return;
      }

      const res = await fetch("/api/onboarding/step3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, branches }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? t("onboarding.step3.saveFailed"));
        return;
      }
      clearOnboardingRestaurantId();
      toast.success(
        skipBranches || branches.length === 0
          ? t("onboarding.step3.allSet")
          : t("onboarding.step3.branchesSaved")
      );
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : t("onboarding.common.requestFailed")
      );
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await finish(false);
  }

  function skip() {
    void finish(true);
  }

  if (status === "loading" || !restaurantId) {
    return (
      <div className="rounded-lg border bg-background p-6 text-center text-sm text-muted-foreground flex items-center justify-center">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-background p-6 shadow-sm">
      <OnboardingSteps active={3} />
      <h1 className="mb-1 text-xl font-semibold">{t("onboarding.step3.title")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {t("onboarding.step3.description")}
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {rows.map((row, i) => (
          <div
            key={i}
            className="space-y-3 rounded-md border border-dashed p-3"
          >
            <div className="flex items-center justify-between">
              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => removeRow(i)}
                >
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    <span>{t("onboarding.step3.remove")}</span>
                  </>
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`name-${i}`}>{t("onboarding.step3.nameLabel")}</Label>
              <Input
                id={`name-${i}`}
                value={row.name}
                onChange={(e) => updateRow(i, "name", e.target.value)}
                placeholder={t("onboarding.step3.namePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`addr-${i}`}>{t("onboarding.step3.addressLabel")}</Label>
              <Input
                id={`addr-${i}`}
                value={row.address}
                onChange={(e) => updateRow(i, "address", e.target.value)}
                placeholder={t("onboarding.step3.addressPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`phone-${i}`}>{t("onboarding.step3.phoneLabel")}</Label>
              <Input
                id={`phone-${i}`}
                value={row.phone}
                onChange={(e) => updateRow(i, "phone", e.target.value)}
                placeholder={t("onboarding.step3.phonePlaceholder")}
              />
            </div>
          </div>
        ))}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="secondary"
            onClick={skip}
            disabled={loading}
          >
            {t("onboarding.step3.skipFinish")}
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />{" "}
                <span>{t("onboarding.step3.finishing")}</span>
              </>
            ) : (
              <>
                <span>{t("onboarding.step3.finish")}</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
