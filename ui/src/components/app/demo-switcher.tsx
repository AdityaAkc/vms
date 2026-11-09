"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, FlaskConical, GraduationCap, LogOut, RotateCcw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { seedDb, useDb } from "@/lib/store/db";
import { homeFor, useSession } from "@/lib/store/session";
import type { DemoSession } from "@/lib/types";
import { ConfirmDialog } from "./confirm-dialog";
import { cn } from "@/lib/utils";

/**
 * Demo-only role switcher. Lets a presenter jump between the platform,
 * owner and student experiences. Replace with real auth later.
 */
export function DemoSwitcher({ className, compact }: { className?: string; compact?: boolean }) {
  const router = useRouter();
  const tenants = useDb((s) => s.platform?.tenants ?? []);
  const tenantData = useDb((s) => s.tenants);
  const signIn = useSession((s) => s.signIn);
  const signOut = useSession((s) => s.signOut);
  const [resetOpen, setResetOpen] = useState(false);

  const go = (session: DemoSession) => {
    signIn(session);
    router.push(homeFor(session));
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={cn("gap-1.5", className)} aria-label="Demo controls: switch role">
            <FlaskConical className="text-teal" />
            {!compact && <span>Demo</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">View the product as…</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => go({ role: "platform" })}>
              <Shield /> Platform super admin
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Building2 /> Reading room owner
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-60">
                {tenants.map((t) => (
                  <DropdownMenuItem key={t.id} onSelect={() => go({ role: "owner", tenantId: t.id })}>
                    <span className="truncate">{t.name}</span>
                    {t.status !== "active" && <span className="ml-auto text-[10px] text-muted-foreground capitalize">{t.status}</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <GraduationCap /> Student
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-60">
                {tenants
                  .filter((t) => t.status === "active")
                  .map((t) => {
                    const first = tenantData[t.id]?.students.find((s) => s.status === "active");
                    return (
                      <DropdownMenuItem
                        key={t.id}
                        disabled={!first}
                        onSelect={() => router.push(`/login?role=student&tenant=${t.id}`)}
                      >
                        <span className="truncate">{t.name}…</span>
                      </DropdownMenuItem>
                    );
                  })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setResetOpen(true)}>
            <RotateCcw /> Reset demo data
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              signOut();
              router.push("/login");
            }}
          >
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset demo data?"
        description="All changes made in this browser — new students, payments, seats and settings — will be discarded and the original sample data restored."
        confirmLabel="Reset data"
        destructive
        onConfirm={() => {
          seedDb();
          setResetOpen(false);
          signOut();
          router.push("/login");
        }}
      />
    </>
  );
}
