/**
 * Platform-level business (tenant) management. Onboarding a new business
 * only creates data — no UI code changes are required, because every screen
 * reads its business context from `TenantProvider`.
 */
import { defaultTenantSettings } from "@/config/app";
import { addDays, addMonths, todayIn } from "../date";
import { generateSeats } from "../domain/seats";
import { uid } from "../id";
import { setPlatformData, useDb } from "../store/db";
import type { PlatformSettings, Tenant, TenantData, TenantStatus } from "../types";
import { fail, latency, nowIso } from "./core";

export interface TenantInput {
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  city: string;
  state: string;
  tierKey: string;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function validate(input: TenantInput, ignoreId?: string) {
  if (!input.name.trim()) fail("Business name is required.");
  if (!input.ownerName.trim()) fail("Owner name is required.");
  if (!/^\S+@\S+\.\S+$/.test(input.ownerEmail)) fail("Enter a valid owner email.");
  if (input.ownerPhone.replace(/\D/g, "").length !== 10) fail("Enter a valid 10-digit phone number.");
  const tenants = useDb.getState().platform!.tenants;
  if (tenants.some((t) => t.id !== ignoreId && slugify(t.name) === slugify(input.name)))
    fail("A business with this name already exists.");
}

export const tenantService = {
  async create(input: TenantInput & { initialSeats: number; columns: number }) {
    await latency(500);
    validate(input);
    if (input.initialSeats < 1 || input.initialSeats > 500) fail("Initial seats must be between 1 and 500.");
    const settings = defaultTenantSettings({
      name: input.name.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      phone: input.ownerPhone.replace(/\D/g, ""),
      email: input.ownerEmail.trim(),
      columns: input.columns,
    });
    const now = nowIso();
    const today = todayIn(settings.locale.timezone);
    const trialDays = useDb.getState().platform!.settings.defaultTrialDays;
    const seats = generateSeats([], input.initialSeats, settings.layout, 1, () => uid("seat"), now);
    const tenant: Tenant = {
      id: uid("tnt"),
      slug: slugify(input.name),
      name: input.name.trim(),
      ownerName: input.ownerName.trim(),
      ownerEmail: input.ownerEmail.trim().toLowerCase(),
      ownerPhone: input.ownerPhone.replace(/\D/g, ""),
      city: input.city.trim(),
      state: input.state.trim(),
      status: "active",
      subscription: {
        tierKey: input.tierKey,
        status: "trial",
        startedOn: today,
        renewsOn: addDays(today, trialDays),
      },
      createdAt: now,
    };
    const data: TenantData = {
      settings,
      seats,
      seatEvents: seats.map((s) => ({ id: uid("evt"), seatId: s.id, type: "created", at: now })),
      students: [],
      plans: [1, 3, 6].map((months) => ({
        id: uid("plan"),
        name: months === 1 ? "Monthly" : months === 3 ? "Quarterly" : "Half-yearly",
        durationMonths: months,
        price: Math.round((settings.pricing.defaultMonthlyPrice * months * (months === 1 ? 1 : months === 3 ? 0.95 : 0.9)) / 100) * 100,
        isActive: true,
        createdAt: now,
      })),
      memberships: [],
      payments: [],
      bookingRequests: [],
      counters: { seat: seats.length + 1, student: 1, membership: 1, receipt: 1 },
    };
    useDb.setState((s) => ({
      platform: { ...s.platform!, tenants: [...s.platform!.tenants, tenant] },
      tenants: { ...s.tenants, [tenant.id]: data },
    }));
    return tenant;
  },

  async update(tenantId: string, input: TenantInput) {
    await latency();
    validate(input, tenantId);
    setPlatformData((p) => ({
      ...p,
      tenants: p.tenants.map((t) =>
        t.id === tenantId
          ? {
              ...t,
              name: input.name.trim(),
              ownerName: input.ownerName.trim(),
              ownerEmail: input.ownerEmail.trim().toLowerCase(),
              ownerPhone: input.ownerPhone.replace(/\D/g, ""),
              city: input.city.trim(),
              state: input.state.trim(),
              subscription: { ...t.subscription, tierKey: input.tierKey },
            }
          : t,
      ),
    }));
    // The workspace display name follows the platform record.
    useDb.setState((s) => {
      const d = s.tenants[tenantId];
      if (!d) return s;
      return {
        tenants: {
          ...s.tenants,
          [tenantId]: { ...d, settings: { ...d.settings, general: { ...d.settings.general, name: input.name.trim() } } },
        },
      };
    });
  },

  async setStatus(tenantId: string, status: TenantStatus, reason?: string) {
    await latency();
    if (status !== "active" && !reason?.trim()) fail("Please provide a reason. It is shown to the business owner.");
    setPlatformData((p) => ({
      ...p,
      tenants: p.tenants.map((t) => {
        if (t.id !== tenantId) return t;
        const today = todayIn();
        const subscription =
          status === "active" && t.subscription.status !== "trial"
            ? { ...t.subscription, status: "active" as const, renewsOn: addMonths(today, 1) }
            : t.subscription;
        return { ...t, status, statusReason: status === "active" ? undefined : reason!.trim(), subscription };
      }),
    }));
  },

  async updatePlatformSettings(settings: PlatformSettings) {
    await latency();
    if (!settings.productName.trim()) fail("Product name is required.");
    if (settings.tiers.some((t) => !t.name.trim() || t.monthlyFee < 0)) fail("Each tier needs a name and a valid fee.");
    setPlatformData((p) => ({ ...p, settings: { ...settings, productName: settings.productName.trim() } }));
  },
};
