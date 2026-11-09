"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { DemoSwitcher } from "./demo-switcher";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  /** Match nested routes too (default true). */
  prefix?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

function isActive(pathname: string, item: NavItem) {
  if (pathname === item.href) return true;
  return item.prefix !== false && pathname.startsWith(`${item.href}/`);
}

function NavList({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.label && (
            <div className="mb-1.5 px-2.5 text-[11px] font-medium tracking-wide text-muted-foreground/80 uppercase">
              {g.label}
            </div>
          )}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <item.icon
                      className={cn("size-4 shrink-0", active ? "text-brand" : "text-muted-foreground group-hover:text-foreground")}
                      aria-hidden
                    />
                    <span className="truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="ml-auto rounded-full bg-warning-soft px-1.5 text-[10px] font-semibold text-[oklch(0.5_0.12_65)] tabular">
                        {item.badge}
                        <span className="sr-only"> need attention</span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Sidebar layout used by the platform and reading-room admin areas. */
export function AppShell({
  header,
  footer,
  groups,
  children,
  mobileTitle,
}: {
  header: React.ReactNode;
  footer?: React.ReactNode;
  groups: NavGroup[];
  children: React.ReactNode;
  mobileTitle: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-14 items-center border-b px-3">{header}</div>
        <div className="flex-1 overflow-y-auto px-2 py-4">
          <NavList groups={groups} />
        </div>
        <div className="flex items-center gap-2 border-t p-3">
          <div className="min-w-0 flex-1">{footer}</div>
          <DemoSwitcher compact />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <div className="min-w-0 flex-1 truncate">{mobileTitle}</div>
          <DemoSwitcher compact />
        </header>

        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 items-center border-b px-3">{header}</div>
          <div className="flex-1 overflow-y-auto px-2 py-4">
            <NavList groups={groups} onNavigate={() => setOpen(false)} />
          </div>
          {footer && <div className="border-t p-3">{footer}</div>}
        </SheetContent>
      </Sheet>
    </div>
  );
}
