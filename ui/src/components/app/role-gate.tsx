"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Ban, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDb } from "@/lib/store/db";
import { homeFor, useSession } from "@/lib/store/session";
import type { Role } from "@/lib/types";

/**
 * Frontend-only route protection for the demo. Real enforcement must happen
 * on the server: every tenant-scoped API call has to verify that the caller
 * belongs to that tenant and holds the required role.
 */
export function RoleGate({ role, children }: { role: Role; children: React.ReactNode }) {
  const session = useSession((s) => s.session);
  const signOut = useSession((s) => s.signOut);
  const router = useRouter();
  const pathname = usePathname();
  const tenant = useDb((s) => s.platform?.tenants.find((t) => t.id === session?.tenantId));
  const student = useDb((s) =>
    session?.tenantId && session.studentId
      ? s.tenants[session.tenantId]?.students.find((x) => x.id === session.studentId)
      : undefined,
  );

  const allowed =
    session?.role === role &&
    (role === "platform" || Boolean(tenant)) &&
    (role !== "student" || Boolean(student));

  useEffect(() => {
    if (!allowed) {
      router.replace(session && session.role !== role ? homeFor(session) : `/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [allowed, session, role, router, pathname]);

  if (!allowed) return null;

  if (role !== "platform" && tenant && tenant.status !== "active") {
    const suspended = tenant.status === "suspended";
    const Icon = suspended ? Ban : PauseCircle;
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-md rounded-xl border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
            <Icon className="size-6" aria-hidden />
          </div>
          <h1 className="text-lg font-semibold">
            {tenant.name} is {suspended ? "suspended" : "inactive"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {tenant.statusReason ?? "This workspace is currently unavailable."}{" "}
            {role === "owner"
              ? "Contact platform support to restore access."
              : "Please contact the reading room front desk."}
          </p>
          <Button
            className="mt-6"
            variant="outline"
            onClick={() => {
              signOut();
              router.replace("/login");
            }}
          >
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
