/**
 * Membership plans. Memberships snapshot plan name/duration/price at the
 * time of purchase, so editing a plan never alters existing memberships.
 */
import { uid } from "../id";
import { getTenantData, setTenantData } from "../store/db";
import type { MembershipPlan } from "../types";
import { fail, latency, nowIso } from "./core";

export type PlanInput = Pick<MembershipPlan, "name" | "durationMonths" | "price" | "description" | "isActive" | "isFeatured">;

function validate(tenantId: string, input: PlanInput, ignoreId?: string) {
  if (!input.name.trim()) fail("Plan name is required.");
  if (!Number.isInteger(input.durationMonths) || input.durationMonths < 1 || input.durationMonths > 24)
    fail("Duration must be between 1 and 24 months.");
  if (!(input.price > 0)) fail("Price must be greater than zero.");
  const data = getTenantData(tenantId);
  if (data.plans.some((p) => p.id !== ignoreId && p.name.trim().toLowerCase() === input.name.trim().toLowerCase()))
    fail("A plan with this name already exists.");
}

export const planService = {
  async create(tenantId: string, input: PlanInput) {
    await latency();
    validate(tenantId, input);
    const plan: MembershipPlan = { ...input, name: input.name.trim(), id: uid("plan"), createdAt: nowIso() };
    setTenantData(tenantId, (d) => ({ ...d, plans: [...d.plans, plan] }));
    return plan;
  },

  async update(tenantId: string, planId: string, input: PlanInput) {
    await latency();
    validate(tenantId, input, planId);
    setTenantData(tenantId, (d) => ({
      ...d,
      plans: d.plans.map((p) => (p.id === planId ? { ...p, ...input, name: input.name.trim() } : p)),
    }));
  },

  async setActive(tenantId: string, planId: string, isActive: boolean) {
    await latency(200);
    const data = getTenantData(tenantId);
    if (!isActive && data.plans.filter((p) => p.isActive && p.id !== planId).length === 0)
      fail("At least one plan must remain active so new memberships can be created.");
    setTenantData(tenantId, (d) => ({ ...d, plans: d.plans.map((p) => (p.id === planId ? { ...p, isActive } : p)) }));
  },

  usageCount(tenantId: string, planId: string) {
    return getTenantData(tenantId).memberships.filter((m) => m.planId === planId).length;
  },

  async remove(tenantId: string, planId: string) {
    await latency();
    if (this.usageCount(tenantId, planId) > 0)
      fail("This plan is used by existing memberships. Deactivate it instead to preserve history.");
    const data = getTenantData(tenantId);
    if (data.plans.filter((p) => p.isActive && p.id !== planId).length === 0)
      fail("At least one active plan is required.");
    setTenantData(tenantId, (d) => ({ ...d, plans: d.plans.filter((p) => p.id !== planId) }));
  },
};
