"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Field, FormGrid } from "@/components/app/field";
import { formatCurrency } from "@/lib/format";
import { useAction } from "@/lib/hooks/use-action";
import { tenantService } from "@/lib/services";
import { useDb } from "@/lib/store/db";
import type { Tenant, TenantStatus } from "@/lib/types";

/** Add or edit a reading-room business (tenant). */
export function BusinessFormDialog({
  tenant,
  open,
  onOpenChange,
  onSaved,
}: {
  tenant?: Tenant;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: (t: Tenant) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {open && <BusinessForm tenant={tenant} onDone={(t) => { onOpenChange(false); if (t) onSaved?.(t); }} />}
      </DialogContent>
    </Dialog>
  );
}

function BusinessForm({ tenant, onDone }: { tenant?: Tenant; onDone: (t?: Tenant) => void }) {
  const tiers = useDb((s) => s.platform!.settings.tiers);
  const trialDays = useDb((s) => s.platform!.settings.defaultTrialDays);
  const [v, setV] = useState({
    name: tenant?.name ?? "",
    ownerName: tenant?.ownerName ?? "",
    ownerEmail: tenant?.ownerEmail ?? "",
    ownerPhone: tenant?.ownerPhone ?? "",
    city: tenant?.city ?? "",
    state: tenant?.state ?? "",
    tierKey: tenant?.subscription.tierKey ?? tiers[0]?.key ?? "",
    initialSeats: "50",
    columns: "10",
  });
  const [touched, setTouched] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const errors = {
    name: !v.name.trim() ? "Required" : null,
    ownerName: !v.ownerName.trim() ? "Required" : null,
    ownerEmail: !/^\S+@\S+\.\S+$/.test(v.ownerEmail) ? "Enter a valid email" : null,
    ownerPhone: v.ownerPhone.replace(/\D/g, "").length !== 10 ? "10-digit mobile number" : null,
    city: !v.city.trim() ? "Required" : null,
    seats: !tenant && !(Number(v.initialSeats) >= 1 && Number(v.initialSeats) <= 500) ? "1 to 500" : null,
  };
  const err = (k: keyof typeof errors) => (touched ? errors[k] ?? undefined : undefined);

  const save = useAction(
    async () => {
      if (tenant) {
        await tenantService.update(tenant.id, v);
        return tenant;
      }
      return tenantService.create({ ...v, initialSeats: Number(v.initialSeats), columns: Number(v.columns) || 10 });
    },
    { success: tenant ? "Business updated" : (t) => `${t.name} onboarded with a ${trialDays}-day trial` },
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>{tenant ? `Edit ${tenant.name}` : "Add business"}</DialogTitle>
        <DialogDescription>
          {tenant ? "Update business and owner details." : "Creates an isolated workspace with default settings, plans and seats."}
        </DialogDescription>
      </DialogHeader>
      <FormGrid>
        <Field label="Business name" required error={err("name")} className="sm:col-span-2">{(p) => <Input {...p} value={v.name} onChange={set("name")} />}</Field>
        <Field label="Owner name" required error={err("ownerName")}>{(p) => <Input {...p} value={v.ownerName} onChange={set("ownerName")} />}</Field>
        <Field label="Owner mobile" required error={err("ownerPhone")}>{(p) => <Input {...p} inputMode="tel" value={v.ownerPhone} onChange={set("ownerPhone")} />}</Field>
        <Field label="Owner email" required error={err("ownerEmail")} className="sm:col-span-2">{(p) => <Input {...p} type="email" value={v.ownerEmail} onChange={set("ownerEmail")} />}</Field>
        <Field label="City" required error={err("city")}>{(p) => <Input {...p} value={v.city} onChange={set("city")} />}</Field>
        <Field label="State">{(p) => <Input {...p} value={v.state} onChange={set("state")} />}</Field>
        <Field label="Subscription tier" className="sm:col-span-2">
          {(p) => (
            <Select value={v.tierKey} onValueChange={(t) => setV({ ...v, tierKey: t })}>
              <SelectTrigger id={p.id} className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tiers.map((t) => (
                  <SelectItem key={t.key} value={t.key}>{t.name} · {formatCurrency(t.monthlyFee)}/mo · {t.description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        {!tenant && (
          <>
            <Field label="Initial seats" required error={err("seats")} hint="Owner can change this later">{(p) => <Input {...p} inputMode="numeric" value={v.initialSeats} onChange={set("initialSeats")} />}</Field>
            <Field label="Seats per row">{(p) => <Input {...p} inputMode="numeric" value={v.columns} onChange={set("columns")} />}</Field>
          </>
        )}
      </FormGrid>
      <DialogFooter>
        <Button variant="outline" onClick={() => onDone()} disabled={save.pending}>Cancel</Button>
        <Button
          disabled={save.pending}
          onClick={async () => {
            setTouched(true);
            if (Object.values(errors).some(Boolean)) return;
            const t = await save.run();
            if (t) onDone(t);
          }}
        >
          {save.pending && <Loader2 className="animate-spin" />} {tenant ? "Save changes" : "Create business"}
        </Button>
      </DialogFooter>
    </>
  );
}

const STATUS_COPY: Record<TenantStatus, { title: string; verb: string; description: string; destructive: boolean }> = {
  active: { title: "Activate", verb: "Activate", description: "The owner and students regain access immediately.", destructive: false },
  inactive: { title: "Deactivate", verb: "Deactivate", description: "The workspace is paused. Owner and students can't sign in. Data is kept.", destructive: true },
  suspended: { title: "Suspend", verb: "Suspend", description: "Use for policy or billing issues. Owner and students are blocked and see the reason you give.", destructive: true },
};

export function TenantStatusDialog({
  tenant,
  target,
  onClose,
}: {
  tenant: Tenant;
  target: TenantStatus | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const copy = target ? STATUS_COPY[target] : null;
  const run = useAction(async () => {
    await tenantService.setStatus(tenant.id, target!, reason);
    return true;
  }, { success: target ? `${tenant.name} is now ${target}` : "" });
  if (!copy) return null;
  return (
    <ConfirmDialog
      open={Boolean(target)}
      onOpenChange={(o) => !o && onClose()}
      title={`${copy.title} ${tenant.name}?`}
      description={copy.description}
      confirmLabel={copy.verb}
      destructive={copy.destructive}
      pending={run.pending}
      onConfirm={async () => {
        if (await run.run()) {
          setReason("");
          onClose();
        }
      }}
    >
      {target !== "active" && (
        <Field label="Reason (shown to the owner)" required>
          {(p) => <Input {...p} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Subscription payment overdue" />}
        </Field>
      )}
    </ConfirmDialog>
  );
}
