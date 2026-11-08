"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Building2, CheckCircle2, GraduationCap, LayoutGrid, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandMark } from "@/components/app/brand-mark";
import { MEMBERSHIP_STATUS_META } from "@/components/app/status-badge";
import { useProductName } from "@/lib/hooks/use-platform";
import { todayIn } from "@/lib/date";
import { deriveTenantViews } from "@/lib/domain/derive";
import { useDb } from "@/lib/store/db";
import { authService } from "@/lib/services";
import { homeFor } from "@/lib/store/session";
import type { DemoSession, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { APP_CONFIG } from "@/config/app";

export function LoginView() {
  const router = useRouter();
  const params = useSearchParams();
  const productName = useProductName();
  const tenants = useDb((s) => s.platform?.tenants ?? []);
  const tenantData = useDb((s) => s.tenants);

  const initialRole = (params.get("role") as Role) || "owner";
  const [role, setRole] = useState<Role>(initialRole);
  const [tenantId, setTenantId] = useState(params.get("tenant") ?? tenants[0]?.id ?? "");
  const [studentId, setStudentId] = useState("");

  const studentOptions = useMemo(() => {
    const data = tenantData[tenantId];
    if (!data) return [];
    const v = deriveTenantViews(data, todayIn(data.settings.locale.timezone));
    return v.students
      .filter((s) => s.status === "active")
      .map((s) => ({
        id: s.id,
        name: s.name,
        detail: [s.seatCode ? `Seat ${s.seatCode}` : null, MEMBERSHIP_STATUS_META[s.membershipStatus].label].filter(Boolean).join(" · "),
        rank: s.current && s.balance > 0 ? 0 : s.membershipStatus === "expiring" ? 1 : s.membershipStatus === "none" ? 2 : 3,
      }))
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  }, [tenantData, tenantId]);

  const effectiveStudent = studentOptions.some((s) => s.id === studentId) ? studentId : studentOptions[0]?.id ?? "";
  const activeTenants = tenants.filter((t) => t.status === "active");

  const enter = () => {
    let session: DemoSession;
    if (role === "platform") session = { role };
    else if (role === "owner") session = { role, tenantId };
    else session = { role, tenantId, studentId: effectiveStudent };
    authService.signInDemo(session);
    const next = params.get("next");
    const home = homeFor(session);
    router.push(next && next.startsWith(home.split("/").slice(0, 2).join("/")) ? next : home);
  };

  const roles: { key: Role; title: string; description: string; icon: typeof Shield }[] = [
    { key: "owner", title: "Reading room owner", description: "Seats, students, memberships and fees", icon: Building2 },
    { key: "student", title: "Student", description: "Book a seat, view membership & receipts", icon: GraduationCap },
    { key: "platform", title: "Platform admin", description: "Manage every business on the platform", icon: Shield },
  ];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-teal text-white">
            <LayoutGrid className="size-4" aria-hidden />
          </span>
          <span className="text-base font-semibold">{productName}</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Run your reading room like a well-kept library desk — without the register.
          </h1>
          <ul className="mt-8 space-y-3 text-sm text-primary-foreground/80">
            {[
              "Live seat map with occupancy, reservations and maintenance",
              "Monthly memberships, renewals and expiry follow-ups",
              "Fee collection with partial payments and printable receipts",
              "A clean student portal for booking and renewals",
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-primary-foreground/50">{APP_CONFIG.productTagline}</p>
        <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-24 grid grid-cols-6 gap-2 opacity-[0.07]">
          {Array.from({ length: 36 }).map((_, i) => (
            <div key={i} className="size-10 rounded-md border-2 border-white" />
          ))}
        </div>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LayoutGrid className="size-4" aria-hidden />
            </span>
            <span className="text-base font-semibold">{productName}</span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Open the demo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose who you want to sign in as. This demo runs entirely in your browser with sample data.
          </p>

          <fieldset className="mt-6">
            <legend className="sr-only">Role</legend>
            <div className="grid gap-2">
              {roles.map((r) => (
                <label
                  key={r.key}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                    role === r.key ? "border-primary/40 bg-primary/[0.03] ring-1 ring-primary/20" : "hover:border-foreground/20",
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.key}
                    checked={role === r.key}
                    onChange={() => setRole(r.key)}
                    className="sr-only"
                  />
                  <span className={cn("flex size-9 items-center justify-center rounded-md", role === r.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    <r.icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{r.title}</span>
                    <span className="block text-xs text-muted-foreground">{r.description}</span>
                  </span>
                  <span
                    aria-hidden
                    className={cn("size-4 rounded-full border-2", role === r.key ? "border-primary bg-primary shadow-[inset_0_0_0_2px_white]" : "border-border")}
                  />
                </label>
              ))}
            </div>
          </fieldset>

          {role !== "platform" && (
            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tenant" className="text-xs">Reading room</Label>
                <Select value={tenantId} onValueChange={setTenantId}>
                  <SelectTrigger id="tenant" className="h-10 w-full">
                    <SelectValue placeholder="Select a business" />
                  </SelectTrigger>
                  <SelectContent>
                    {(role === "student" ? activeTenants : tenants).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <BrandMark name={t.name} color={tenantData[t.id]?.settings.general.brandColor} size="sm" className="size-5 text-[8px]" />
                        {t.name}
                        {t.status !== "active" && <span className="text-xs text-muted-foreground capitalize">· {t.status}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {role === "student" && (
                <div className="space-y-1.5">
                  <Label htmlFor="student" className="text-xs">Student</Label>
                  <Select value={effectiveStudent} onValueChange={setStudentId}>
                    <SelectTrigger id="student" className="h-10 w-full">
                      <SelectValue placeholder="Select a student" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {studentOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          <span className="text-xs text-muted-foreground">· {s.detail}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Tip: pick someone with “No membership” to try booking a seat.
                  </p>
                </div>
              )}
            </div>
          )}

          <Button
            size="lg"
            className="mt-6 h-10 w-full"
            onClick={enter}
            disabled={(role !== "platform" && !tenantId) || (role === "student" && !effectiveStudent)}
          >
            Continue <ArrowRight data-icon="inline-end" />
          </Button>

          <p className="mt-6 rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
            Email and password sign-in for owners will connect to the backend authentication service. Student and
            platform sign-in are planned. Data you change here is kept in this browser only.
          </p>
        </div>
      </main>
    </div>
  );
}
