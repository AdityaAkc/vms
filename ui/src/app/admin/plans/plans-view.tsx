"use client";

import { useState } from "react";
import { Layers, Loader2, MoreHorizontal, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/empty-state";
import { Field, FormGrid } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-badge";
import { formatCurrency } from "@/lib/format";
import { useAction } from "@/lib/hooks/use-action";
import { useTenant } from "@/lib/hooks/use-tenant";
import { planService } from "@/lib/services";
import type { MembershipPlan } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PlansView() {
  const { tenantId, data, views, settings } = useTenant();
  const [editing, setEditing] = useState<MembershipPlan | "new" | null>(null);
  const [deleting, setDeleting] = useState<MembershipPlan | null>(null);
  const toggle = useAction(async (p: MembershipPlan) => {
    await planService.setActive(tenantId, p.id, !p.isActive);
    return true;
  });
  const remove = useAction(async () => {
    await planService.remove(tenantId, deleting!.id);
    return true;
  }, { success: "Plan deleted" });

  const plans = [...data.plans].sort((a, b) => a.durationMonths - b.durationMonths);
  const usage = (id: string) => views.memberships.filter((m) => m.planId === id);

  return (
    <>
      <PageHeader
        title="Plans & pricing"
        description="Membership plans students can choose. Price changes apply to new memberships only — existing ones keep the price they were sold at."
        actions={<Button onClick={() => setEditing("new")}><Plus /> New plan</Button>}
      />

      {plans.length === 0 ? (
        <Card><EmptyState icon={Layers} title="No plans yet" action={<Button onClick={() => setEditing("new")}><Plus /> New plan</Button>} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => {
            const used = usage(p.id);
            const live = used.filter((m) => m.status === "active" || m.status === "expiring" || m.status === "upcoming").length;
            const perMonth = Math.round(p.price / p.durationMonths);
            const saving = settings.pricing.defaultMonthlyPrice * p.durationMonths - p.price;
            return (
              <Card key={p.id} className={cn("relative", !p.isActive && "bg-muted/30")}>
                <CardContent className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h2 className="font-semibold">{p.name}</h2>
                        {p.isFeatured && <Star className="size-3.5 fill-warning text-warning" aria-label="Featured plan" />}
                      </div>
                      <div className="text-xs text-muted-foreground">{p.durationMonths} {p.durationMonths === 1 ? "month" : "months"}</div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`}><MoreHorizontal /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing(p)}><Pencil /> Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" disabled={used.length > 0} onSelect={() => setDeleting(p)}>
                          <Trash2 /> {used.length > 0 ? "In use — deactivate instead" : "Delete"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-4 text-3xl font-semibold tracking-tight tabular">{formatCurrency(p.price)}</div>
                  <div className="text-xs text-muted-foreground tabular">
                    {formatCurrency(perMonth)}/month{saving > 0 && ` · saves ${formatCurrency(saving)}`}
                  </div>
                  <p className="mt-3 mb-5 text-sm text-muted-foreground">{p.description ?? "\u00a0"}</p>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
                    <span className="text-xs text-muted-foreground">{live} active · {used.length} sold</span>
                    <label className="flex items-center gap-2 text-xs">
                      {p.isActive ? <StatusPill tone="success">On sale</StatusPill> : <StatusPill tone="neutral">Inactive</StatusPill>}
                      <Switch checked={p.isActive} onCheckedChange={() => toggle.run(p)} aria-label={`${p.isActive ? "Deactivate" : "Activate"} ${p.name}`} />
                    </label>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Default monthly price ({formatCurrency(settings.pricing.defaultMonthlyPrice)}) and additional charges are managed in Settings → Pricing.
      </p>

      <PlanDialog plan={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="This plan has never been sold, so it can be deleted permanently."
        confirmLabel="Delete plan"
        destructive
        pending={remove.pending}
        onConfirm={async () => {
          if (await remove.run()) setDeleting(null);
        }}
      />
    </>
  );
}

function PlanDialog({ plan, onClose }: { plan: MembershipPlan | "new" | null; onClose: () => void }) {
  return (
    <Dialog open={plan !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">{plan !== null && <PlanForm plan={plan === "new" ? undefined : plan} onDone={onClose} />}</DialogContent>
    </Dialog>
  );
}

function PlanForm({ plan, onDone }: { plan?: MembershipPlan; onDone: () => void }) {
  const { tenantId, views } = useTenant();
  const [name, setName] = useState(plan?.name ?? "");
  const [months, setMonths] = useState(String(plan?.durationMonths ?? 1));
  const [price, setPrice] = useState(String(plan?.price ?? ""));
  const [description, setDescription] = useState(plan?.description ?? "");
  const [isActive, setActive] = useState(plan?.isActive ?? true);
  const [isFeatured, setFeatured] = useState(plan?.isFeatured ?? false);
  const [touched, setTouched] = useState(false);
  const used = plan ? views.memberships.some((m) => m.planId === plan.id) : false;

  const errors = {
    name: !name.trim() ? "Plan name is required" : null,
    months: !(Number(months) >= 1 && Number(months) <= 24) ? "1 to 24 months" : null,
    price: !(Number(price) > 0) ? "Enter a price" : null,
  };
  const save = useAction(async () => {
    const input = { name, durationMonths: Number(months), price: Number(price), description: description.trim() || undefined, isActive, isFeatured };
    if (plan) await planService.update(tenantId, plan.id, input);
    else await planService.create(tenantId, input);
    return true;
  }, { success: plan ? "Plan updated" : "Plan created" });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{plan ? `Edit ${plan.name}` : "New plan"}</DialogTitle>
        <DialogDescription>
          {used ? "Existing memberships on this plan keep their original name, duration and price." : "Define the duration and price students pay."}
        </DialogDescription>
      </DialogHeader>
      <FormGrid>
        <Field label="Plan name" required error={touched ? errors.name ?? undefined : undefined} className="sm:col-span-2">
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Quarterly" />}
        </Field>
        <Field label="Duration (months)" required error={touched ? errors.months ?? undefined : undefined}>
          {(p) => <Input {...p} type="number" min={1} max={24} value={months} onChange={(e) => setMonths(e.target.value)} />}
        </Field>
        <Field label="Price (₹)" required error={touched ? errors.price ?? undefined : undefined} hint={Number(price) > 0 && Number(months) > 0 ? `${formatCurrency(Number(price) / Number(months))} per month` : undefined}>
          {(p) => <Input {...p} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />}
        </Field>
        <Field label="Description" className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
      </FormGrid>
      <div className="space-y-3">
        <label className="flex items-center justify-between gap-3 text-sm">
          Available for new memberships
          <Switch checked={isActive} onCheckedChange={setActive} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          Highlight as recommended
          <Switch checked={isFeatured} onCheckedChange={setFeatured} />
        </label>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Cancel</Button>
        <Button
          disabled={save.pending}
          onClick={async () => {
            setTouched(true);
            if (Object.values(errors).some(Boolean)) return;
            if (await save.run()) onDone();
          }}
        >
          {save.pending && <Loader2 className="animate-spin" />} {plan ? "Save changes" : "Create plan"}
        </Button>
      </DialogFooter>
    </>
  );
}
