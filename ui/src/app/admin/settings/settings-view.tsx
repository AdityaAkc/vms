"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Building2, CalendarCheck, Clock, IndianRupee, LayoutGrid, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import {
  FacilitySettings,
  GeneralSettings,
  HoursSettings,
  PricingSettings,
  RuleSettings,
  SeatSettings,
} from "@/components/settings/settings-sections";
import { useTenant } from "@/lib/hooks/use-tenant";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { key: "general", label: "General", icon: Building2, Component: GeneralSettings },
  { key: "hours", label: "Operating hours", icon: Clock, Component: HoursSettings },
  { key: "seats", label: "Seat configuration", icon: LayoutGrid, Component: SeatSettings },
  { key: "pricing", label: "Pricing", icon: IndianRupee, Component: PricingSettings },
  { key: "facilities", label: "Facilities", icon: Sparkles, Component: FacilitySettings },
  { key: "rules", label: "Booking rules", icon: CalendarCheck, Component: RuleSettings },
] as const;

export function SettingsView() {
  const { tenantId } = useTenant();
  const params = useSearchParams();
  const router = useRouter();
  const active = SECTIONS.find((s) => s.key === params.get("section")) ?? SECTIONS[0];
  const { Component } = active;

  return (
    <>
      <PageHeader title="Settings" description="Configuration for this reading room only. Other businesses on the platform are unaffected." />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Settings sections" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <ul className="flex gap-1 lg:flex-col">
            {SECTIONS.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => router.replace(`/admin/settings?section=${s.key}`, { scroll: false })}
                  aria-current={s.key === active.key ? "page" : undefined}
                  className={cn(
                    "flex h-9 w-full items-center gap-2 rounded-md px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    s.key === active.key ? "bg-card font-medium shadow-xs ring-1 ring-border" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <s.icon className="size-4" aria-hidden />
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        {/* Keyed by tenant + section so drafts reset when either changes. */}
        <Component key={`${tenantId}-${active.key}`} />
      </div>
    </>
  );
}
