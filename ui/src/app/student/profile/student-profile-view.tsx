"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PersonAvatar } from "@/components/app/brand-mark";
import { useCurrentStudent } from "@/components/student/use-current-student";
import { formatDate } from "@/lib/date";
import { formatPhone } from "@/lib/format";
import { useTenant } from "@/lib/hooks/use-tenant";
import { useSession } from "@/lib/store/session";

export function StudentProfileView() {
  const { settings } = useTenant();
  const { student } = useCurrentStudent();
  const signOut = useSession((s) => s.signOut);
  const router = useRouter();

  const rows: [string, string][] = [
    ["Student ID", student.code],
    ["Mobile", formatPhone(student.phone)],
    ["Email", student.email || "—"],
    ["Date of birth", formatDate(student.dateOfBirth)],
    ["Preparing for", student.preparingFor ?? "—"],
    ["Address", student.address],
    ["Guardian", student.guardianName ? `${student.guardianName}${student.guardianPhone ? ` · ${formatPhone(student.guardianPhone)}` : ""}` : "—"],
    ["Member since", formatDate(student.joinedOn)],
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <PersonAvatar name={student.name} className="size-14 text-base" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{student.name}</h1>
          <p className="text-sm text-muted-foreground">{settings.general.name}</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">Your details</CardTitle></CardHeader>
        <CardContent>
          <dl className="divide-y text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:justify-between">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium sm:text-right">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            To update your details, please contact the front desk{settings.general.phone ? ` at ${formatPhone(settings.general.phone)}` : ""}.
          </p>
        </CardContent>
      </Card>
      <Button
        variant="outline"
        onClick={() => {
          signOut();
          router.push("/login");
        }}
      >
        <LogOut /> Sign out
      </Button>
    </div>
  );
}
