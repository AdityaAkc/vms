"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Phone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PersonAvatar } from "@/components/app/brand-mark";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader, SectionTitle } from "@/components/app/page-header";
import { MembershipStatusBadge, PaymentStatusBadge } from "@/components/app/status-badge";
import { RenewDialog } from "@/components/memberships/renew-dialog";
import { formatDate, relativeDays } from "@/lib/date";
import { expiringWithin, hasRenewal } from "@/lib/domain/metrics";
import { formatCurrency, formatPhone } from "@/lib/format";
import { useTenant } from "@/lib/hooks/use-tenant";
import type { MembershipView } from "@/lib/types";

export function ExpiringView() {
  const { views } = useTenant();
  const [days, setDays] = useState("7");
  const [renewing, setRenewing] = useState<MembershipView | null>(null);

  const list = useMemo(() => expiringWithin(views, Number(days)), [views, days]);
  const counts = useMemo(
    () => ({ 7: expiringWithin(views, 7).length, 15: expiringWithin(views, 15).length, 30: expiringWithin(views, 30).length }),
    [views],
  );
  const lapsed = useMemo(
    () =>
      views.memberships
        .filter((m) => m.status === "expired" && m.daysRemaining >= -30 && !hasRenewal(views, m.studentId, m.endDate))
        .filter((m) => views.studentById.get(m.studentId)?.status === "active")
        .sort((a, b) => b.daysRemaining - a.daysRemaining),
    [views],
  );

  return (
    <>
      <Link href="/admin/memberships" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Memberships
      </Link>
      <PageHeader
        title="Expiring memberships"
        description="Members whose seat period ends soon and who haven't renewed yet."
        actions={
          <ToggleGroup type="single" variant="outline" value={days} onValueChange={(v) => v && setDays(v)} aria-label="Expiry window">
            <ToggleGroupItem value="7">7 days ({counts[7]})</ToggleGroupItem>
            <ToggleGroupItem value="15">15 days ({counts[15]})</ToggleGroupItem>
            <ToggleGroupItem value="30">30 days ({counts[30]})</ToggleGroupItem>
          </ToggleGroup>
        }
      />

      <div className="rounded-xl border bg-card">
        {list.length === 0 ? (
          <EmptyState icon={CheckCircle2} title={`Nothing expires in the next ${days} days`} description="Every current member is covered beyond this window or has already renewed." />
        ) : (
          <ul className="divide-y">
            {list.map((m) => (
              <MemberRow key={m.id} m={m} onRenew={() => setRenewing(m)} />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <SectionTitle>Lapsed in the last 30 days</SectionTitle>
        <div className="rounded-xl border bg-card">
          {lapsed.length === 0 ? (
            <EmptyState title="No lapsed memberships" className="py-8" />
          ) : (
            <ul className="divide-y">
              {lapsed.map((m) => (
                <MemberRow key={m.id} m={m} onRenew={() => setRenewing(m)} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <RenewDialog membership={renewing} open={Boolean(renewing)} onOpenChange={(o) => !o && setRenewing(null)} />
    </>
  );
}

function MemberRow({ m, onRenew }: { m: MembershipView; onRenew: () => void }) {
  const { views } = useTenant();
  const student = views.studentById.get(m.studentId);
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <PersonAvatar name={m.studentName} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/students/${m.studentId}`} className="font-medium hover:underline">{m.studentName}</Link>
            <MembershipStatusBadge status={m.status} />
          </div>
          <div className="text-xs text-muted-foreground">
            Seat {m.seatCode} · {m.planName} · {m.status === "expired" ? "expired" : "ends"} {formatDate(m.endDate)} ({relativeDays(m.daysRemaining)})
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 pl-11 sm:pl-0">
        {m.balance > 0 ? (
          <span className="text-xs text-destructive tabular">{formatCurrency(m.balance)} due</span>
        ) : (
          <PaymentStatusBadge status={m.paymentStatus} />
        )}
        {student && (
          <Button size="sm" variant="ghost" asChild>
            <a href={`tel:+91${student.phone}`} aria-label={`Call ${student.name}`}>
              <Phone /> <span className="hidden md:inline">{formatPhone(student.phone)}</span>
            </a>
          </Button>
        )}
        <Button size="sm" onClick={onRenew}>
          <RefreshCw /> Renew
        </Button>
      </div>
    </li>
  );
}
