"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, Home, LayoutGrid, Receipt, UserRound } from "lucide-react";
import { BrandMark } from "@/components/app/brand-mark";
import { DemoSwitcher } from "@/components/app/demo-switcher";
import { RoleGate } from "@/components/app/role-gate";
import { TenantProvider, useTenant } from "@/lib/hooks/use-tenant";
import { useSession } from "@/lib/store/session";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/student/dashboard", label: "Home", icon: Home },
  { href: "/student/book-seat", label: "Book seat", icon: LayoutGrid },
  { href: "/student/membership", label: "Membership", icon: CalendarRange },
  { href: "/student/payments", label: "Payments", icon: Receipt },
  { href: "/student/profile", label: "Profile", icon: UserRound },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const tenantId = useSession((s) => s.session?.tenantId);
  return (
    <RoleGate role="student">
      {tenantId && (
        <TenantProvider tenantId={tenantId}>
          <StudentShell>{children}</StudentShell>
        </TenantProvider>
      )}
    </RoleGate>
  );
}

function StudentShell({ children }: { children: React.ReactNode }) {
  const { settings } = useTenant();
  const pathname = usePathname();
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link href="/student/dashboard" className="flex min-w-0 items-center gap-2.5">
            <BrandMark name={settings.general.name} logo={settings.general.logoDataUrl} />
            <span className="truncate text-sm font-semibold">{settings.general.name}</span>
          </Link>
          <nav aria-label="Student portal" className="ml-6 hidden items-center gap-1 md:flex">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    active ? "bg-brand/10 font-medium text-brand" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto">
            <DemoSwitcher compact />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 md:pb-12">
        {children}
      </main>

      {/* Mobile tab bar */}
      <nav aria-label="Student portal" className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px] outline-none focus-visible:bg-muted",
                    active ? "font-medium text-brand" : "text-muted-foreground",
                  )}
                >
                  <n.icon className="size-5" aria-hidden />
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
