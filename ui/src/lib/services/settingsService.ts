/**
 * Tenant settings. Each tenant's settings object is stored inside its own
 * dataset, so changes can never leak to another business.
 */
import { setTenantData, setPlatformData } from "../store/db";
import type { TenantSettings } from "../types";
import { fail, latency } from "./core";

type Section = Exclude<keyof TenantSettings, "layout">;

function validate<S extends Section>(section: S, value: TenantSettings[S]) {
  if (section === "general") {
    const g = value as TenantSettings["general"];
    if (!g.name.trim()) fail("Reading room name is required.");
    if (g.phone && g.phone.replace(/\D/g, "").length !== 10) fail("Enter a valid 10-digit contact number.");
    if (g.email && !/^\S+@\S+\.\S+$/.test(g.email)) fail("Enter a valid email address.");
  }
  if (section === "hours") {
    const h = value as TenantSettings["hours"];
    if (h.openTime >= h.closeTime) fail("Closing time must be after opening time.");
    if (!h.workingDays.length) fail("Select at least one working day.");
  }
  if (section === "pricing") {
    const p = value as TenantSettings["pricing"];
    if (!(p.defaultMonthlyPrice > 0)) fail("Default monthly price must be greater than zero.");
    if (p.charges.some((c) => !c.name.trim() || c.amount < 0)) fail("Every additional charge needs a name and a valid amount.");
  }
  if (section === "rules") {
    const r = value as TenantSettings["rules"];
    if (r.minDurationMonths < 1) fail("Minimum duration must be at least 1 month.");
    if (r.expiringSoonDays < 1 || r.expiringSoonDays > 30) fail("'Expiring soon' window must be between 1 and 30 days.");
    if (r.advanceBookingDays < 0 || r.advanceBookingDays > 90) fail("Advance booking must be between 0 and 90 days.");
  }
}

export const settingsService = {
  async update<S extends Section>(tenantId: string, section: S, value: TenantSettings[S]) {
    await latency();
    validate(section, value);
    setTenantData(tenantId, (d) => ({ ...d, settings: { ...d.settings, [section]: value } }));
    // Keep the platform's business directory name in sync with the workspace.
    if (section === "general") {
      const name = (value as TenantSettings["general"]).name.trim();
      setPlatformData((p) => ({
        ...p,
        tenants: p.tenants.map((t) => (t.id === tenantId ? { ...t, name } : t)),
      }));
    }
  },
};
