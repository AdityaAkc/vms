"use client";

import { Building2, LayoutDashboard, LayoutGrid, Settings } from "lucide-react";
import { AppShell, type NavGroup } from "@/components/app/app-shell";
import { PersonAvatar } from "@/components/app/brand-mark";
import { RoleGate } from "@/components/app/role-gate";
import { useProductName } from "@/lib/hooks/use-platform";

const groups: NavGroup[] = [
  {
    items: [
      { href: "/platform/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/platform/businesses", label: "Businesses", icon: Building2 },
      { href: "/platform/settings", label: "Platform settings", icon: Settings },
    ],
  },
];

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const productName = useProductName();
  return (
    <RoleGate role="platform">
      <AppShell
        groups={groups}
        header={
          <div className="flex items-center gap-2.5 px-1">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LayoutGrid className="size-4" aria-hidden />
            </span>
            <div>
              <div className="text-sm font-semibold">{productName}</div>
              <div className="text-[11px] text-muted-foreground">Platform console</div>
            </div>
          </div>
        }
        footer={
          <div className="flex min-w-0 items-center gap-2">
            <PersonAvatar name="Platform Admin" className="size-7" />
            <div className="min-w-0">
              <div className="truncate text-xs font-medium">Platform admin</div>
              <div className="truncate text-[11px] text-muted-foreground">Super admin</div>
            </div>
          </div>
        }
        mobileTitle={<span className="text-sm font-semibold">{productName} · Platform</span>}
      >
        {children}
      </AppShell>
    </RoleGate>
  );
}
