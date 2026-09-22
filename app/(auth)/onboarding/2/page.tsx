"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Base64ImageUploadField } from "@/components/ui/base64-image-upload";
import { Label } from "@/components/ui/label";
import { getOnboardingRestaurantId } from "@/lib/onboarding/storage";
import { OnboardingSteps } from "../OnboardingSteps";

export default function OnboardingStep2Page() {
  const { t } = useTranslation();
  const router = useRouter();
  const { status } = useSession();

  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [mainBannerUrl, setMainBannerUrl] = useState("");
  const [menuBanners, setMenuBanners] = useState<string[]>([""]);
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

  function addMenuBannerRow() {
    setMenuBanners((prev) => [...prev, ""]);
  }

  function setMenuBanner(i: number, v: string) {
    setMenuBanners((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  }

  function removeMenuBanner(i: number) {
    setMenuBanners((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save(goNext: boolean) {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const urls = menuBanners.map((u) => u.trim()).filter(Boolean);
      const res = await fetch("/api/onboarding/step2", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          logoUrl: logoUrl.trim(),
          mainBannerUrl: mainBannerUrl.trim(),
          menuBannerUrls: urls,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? t("onboarding.step2.saveFailed"));
        return;
      }
      if (goNext) {
        toast.success(t("onboarding.step2.saved"));
        router.push("/onboarding/3");
      }
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

  const canContinue = useMemo(() => {
    const logo = logoUrl.trim();
    const main = mainBannerUrl.trim();
    const hasMenuBanner = menuBanners.some((u) => u.trim().length > 0);
    return logo.length > 0 && main.length > 0 && hasMenuBanner;
  }, [logoUrl, mainBannerUrl, menuBanners]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canContinue) {
      toast.error(t("onboarding.step2.requiredFields"));
      return;
    }
    await save(true);
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
      <OnboardingSteps active={2} />
      <h1 className="mb-1 text-xl font-semibold">{t("onboarding.step2.title")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {t("onboarding.step2.description")}
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Base64ImageUploadField
          label={t("onboarding.step2.logoLabel")}
          value={logoUrl}
          onChange={setLogoUrl}
          helperText={t("onboarding.step2.logoHelper")}
        />
        <Base64ImageUploadField
          label={t("onboarding.step2.mainBannerLabel")}
          value={mainBannerUrl}
          onChange={setMainBannerUrl}
          helperText={t("onboarding.step2.mainBannerHelper")}
        />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t("onboarding.step2.menuBannerLabel")}</Label>
            <Button
              type="button"
              variant="outline"
              onClick={addMenuBannerRow}
            >
              <Plus className="h-4 w-4 mr-2" />
              <span>{t("onboarding.step2.addBanner")}</span>
            </Button>
          </div>
          {menuBanners.map((url, i) => (
            <div key={i} className="flex gap-2 items-end">
              <Base64ImageUploadField
                label={t("onboarding.step2.menuBannerItemLabel", { n: i + 1 })}
                value={url}
                onChange={(v) => setMenuBanner(i, v)}
              />
              {menuBanners.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => removeMenuBanner(i)}
                  aria-label={t("onboarding.step2.removeAria")}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button type="submit" className="w-full" disabled={loading || !canContinue}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                <span>{t("onboarding.step2.saving")}</span>
              </>
            ) : (
              <>
                <span>{t("onboarding.step2.continue")}</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
