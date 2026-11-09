"use client";

import { useMemo } from "react";
import { APP_CONFIG } from "@/config/app";
import { todayIn } from "../date";
import { deriveTenantViews } from "../domain/derive";
import { dashboardMetrics } from "../domain/metrics";
import { useDb } from "../store/db";

export function useProductName() {
  return useDb((s) => s.platform?.settings.productName) ?? APP_CONFIG.productName;
}

/** Per-business statistics, derived from each tenant's own dataset. */
export function useTenantStats() {
  const tenants = useDb((s) => s.tenants);
  const platform = useDb((s) => s.platform);
  return useMemo(() => {
    if (!platform) return [];
    return platform.tenants.map((t) => {
      const data = tenants[t.id];
      const views = data ? deriveTenantViews(data, todayIn(data.settings.locale.timezone)) : null;
      const metrics = views ? dashboardMetrics(views) : null;
      const tier = platform.settings.tiers.find((x) => x.key === t.subscription.tierKey);
      return { tenant: t, views, metrics, tier, studentCount: data?.students.length ?? 0, brandColor: data?.settings.general.brandColor, logo: data?.settings.general.logoDataUrl };
    });
  }, [tenants, platform]);
}
