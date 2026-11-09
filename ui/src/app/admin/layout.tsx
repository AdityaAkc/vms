"use client";

import {
  BarChart3,
  CalendarRange,
  CreditCard,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  Settings,
  Users,
} from "lucide-react";
import { AppShell, type NavGroup } from "@/components/app/app-shell";
import { BrandMark, PersonAvatar } from "@/components/app/brand-mark";
import { RoleGate } from "@/components/app/role-gate";
import { dashboardMetrics } from "@/lib/domain/metrics";
import { TenantProvider, useTenant } from "@/lib/hooks/use-tenant";
import { useSession } from "@/lib/store/session";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const tenantId = useSession((s) => s.session?.tenantId);
  return (
    <RoleGate role="owner">
      {tenantId && (
        <TenantProvider tenantId={tenantId}>
          <AdminShell>{children}</AdminShell>
        </TenantProvider>
      )}
    </RoleGate>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const { tenant, settings, views, data } = useTenant();
  const expiring = dashboardMetrics(views).expiringSoon;
  const requests = data.bookingRequests.filter((r) => r.status === "pending").length;

  const groups: NavGroup[] = [
    { items: [{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      label: "Operations",
      items: [
        { href: "/admin/seats", label: "Seats", icon: LayoutGrid },
        { href: "/admin/students", label: "Students", icon: Users },
        { href: "/admin/memberships", label: "Memberships", icon: CalendarRange, badge: expiring + requests },
        { href: "/admin/plans", label: "Plans & pricing", icon: Layers },
        { href: "/admin/payments", label: "Payments", icon: CreditCard },
      ],
    },
    {
      label: "Insights",
      items: [
        { href: "/admin/reports", label: "Reports", icon: BarChart3 },
        { href: "/admin/settings", label: "Settings", icon: Settings },
      ],
    },
  ];

  const header = (
    <div className="flex min-w-0 items-center gap-2.5 px-1">
      <BrandMark name={settings.general.name} logo={settings.general.logoDataUrl} />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{settings.general.name}</div>
        <div className="truncate text-[11px] text-muted-foreground">{settings.general.city} · Owner workspace</div>
      </div>
    </div>
  );

  const footer = (
    <div className="flex min-w-0 items-center gap-2">
      <PersonAvatar name={tenant.ownerName} className="size-7" />
      <div className="min-w-0">
        <div className="truncate text-xs font-medium">{tenant.ownerName}</div>
        <div className="truncate text-[11px] text-muted-foreground">{tenant.ownerEmail}</div>
      </div>
    </div>
  );

  return (
    <AppShell
      groups={groups}
      header={header}
      footer={footer}
      mobileTitle={<span className="text-sm font-semibold">{settings.general.name}</span>}
    >
      {children}
    </AppShell>
  );
}
