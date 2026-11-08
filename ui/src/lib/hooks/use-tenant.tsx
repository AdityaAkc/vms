"use client";

/**
 * Tenant context — the single abstraction through which every workspace
 * screen learns *which* business it is rendering. Components never branch on
 * a specific tenant; they read settings, branding and data from here.
 *
 * When a real API arrives, this provider is where the tenant id is resolved
 * (from the session/subdomain) and passed to tenant-scoped endpoints.
 */
import { createContext, useContext, useMemo } from "react";
import { todayIn } from "../date";
import { deriveTenantViews, type TenantViews } from "../domain/derive";
import { useDb } from "../store/db";
import type { Tenant, TenantData, TenantSettings } from "../types";

interface TenantContextValue {
  tenantId: string;
  tenant: Tenant;
  settings: TenantSettings;
  data: TenantData;
  views: TenantViews;
  today: string;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ tenantId, children }: { tenantId: string; children: React.ReactNode }) {
  const data = useDb((s) => s.tenants[tenantId]);
  const tenant = useDb((s) => s.platform?.tenants.find((t) => t.id === tenantId));
  const timezone = data?.settings.locale.timezone;
  const today = todayIn(timezone);
  const views = useMemo(() => (data ? deriveTenantViews(data, today) : null), [data, today]);

  if (!data || !tenant || !views) return null;
  return (
    <TenantContext.Provider value={{ tenantId, tenant, settings: data.settings, data, views, today }}>
      <TenantBrandStyle color={data.settings.general.brandColor} />
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used inside <TenantProvider>");
  return ctx;
}

/** Injects the tenant's brand colour as the `--brand` CSS variable. */
function TenantBrandStyle({ color }: { color: string }) {
  const safe = /^#[0-9a-f]{6}$/i.test(color) ? color : "#2f7f86";
  return <style>{`:root{--brand:${safe};}`}</style>;
}
