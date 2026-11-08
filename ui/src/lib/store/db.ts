"use client";

/**
 * Mock "database" for the demo. One store holds platform data plus a map of
 * fully isolated tenant datasets keyed by tenant id. It is persisted to
 * localStorage so demo interactions survive a refresh.
 *
 * UI components must not write to this store directly — all mutations go
 * through `lib/services/*`, which is the seam where real API calls
 * (e.g. `/api/tenants/{tenantId}/seats`) will be plugged in later.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { APP_CONFIG } from "@/config/app";
import { buildSeed } from "../mock/seed";
import type { PlatformData, TenantData } from "../types";

export interface DbState {
  version: number;
  ready: boolean;
  platform: PlatformData | null;
  tenants: Record<string, TenantData>;
}

export const useDb = create<DbState>()(
  persist(
    (): DbState => ({
      version: APP_CONFIG.dataVersion,
      ready: false,
      platform: null,
      tenants: {},
    }),
    {
      name: APP_CONFIG.storageKey,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ version: s.version, platform: s.platform, tenants: s.tenants }),
    },
  ),
);

/** Hydrate from localStorage, seeding fresh demo data when needed. */
export async function initDb() {
  if (useDb.getState().ready) return;
  await useDb.persist.rehydrate();
  const s = useDb.getState();
  if (!s.platform || s.version !== APP_CONFIG.dataVersion) {
    seedDb();
  }
  useDb.setState({ ready: true });
}

export function seedDb() {
  const seed = buildSeed();
  useDb.setState({
    version: APP_CONFIG.dataVersion,
    platform: seed.platform,
    tenants: seed.tenants,
  });
}

export function getTenantData(tenantId: string): TenantData {
  const data = useDb.getState().tenants[tenantId];
  if (!data) throw new Error(`Unknown tenant: ${tenantId}`);
  return data;
}

export function setTenantData(tenantId: string, update: (d: TenantData) => TenantData) {
  useDb.setState((s) => {
    const current = s.tenants[tenantId];
    if (!current) throw new Error(`Unknown tenant: ${tenantId}`);
    return { tenants: { ...s.tenants, [tenantId]: update(current) } };
  });
}

export function setPlatformData(update: (p: PlatformData) => PlatformData) {
  useDb.setState((s) => ({ platform: update(s.platform!) }));
}
