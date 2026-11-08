"use client";

import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Field, FormGrid } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { useAction } from "@/lib/hooks/use-action";
import { tenantService } from "@/lib/services";
import { seedDb, useDb } from "@/lib/store/db";
import { useSession } from "@/lib/store/session";
import { useRouter } from "next/navigation";

export function PlatformSettingsView() {
  const settings = useDb((s) => s.platform!.settings);
  const [draft, setDraft] = useState(() => structuredClone(settings));
  const [resetOpen, setResetOpen] = useState(false);
  const signOut = useSession((s) => s.signOut);
  const router = useRouter();
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const save = useAction(async () => {
    await tenantService.updatePlatformSettings(draft);
    return true;
  }, { success: "Platform settings saved" });

  return (
    <>
      <PageHeader title="Platform settings" description="Application-wide configuration. Business-specific settings live inside each workspace." />
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Product</CardTitle>
            <CardDescription>Branding shown on the sign-in page and platform console.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormGrid>
              <Field label="Product name" required>{(p) => <Input {...p} value={draft.productName} onChange={(e) => setDraft({ ...draft, productName: e.target.value })} />}</Field>
              <Field label="Default trial (days)">{(p) => <Input {...p} inputMode="numeric" value={draft.defaultTrialDays} onChange={(e) => setDraft({ ...draft, defaultTrialDays: Number(e.target.value.replace(/\D/g, "") || 0) })} />}</Field>
              <Field label="Support email">{(p) => <Input {...p} type="email" value={draft.supportEmail} onChange={(e) => setDraft({ ...draft, supportEmail: e.target.value })} />}</Field>
              <Field label="Support phone">{(p) => <Input {...p} inputMode="tel" value={draft.supportPhone} onChange={(e) => setDraft({ ...draft, supportPhone: e.target.value })} />}</Field>
            </FormGrid>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Subscription tiers</CardTitle>
            <CardDescription>What businesses pay for the platform. Billing collection is not automated yet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {draft.tiers.map((t, i) => (
              <div key={t.key} className="grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_140px_140px_2fr]">
                <Field label="Name">{(p) => <Input {...p} value={t.name} onChange={(e) => setDraft({ ...draft, tiers: draft.tiers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />}</Field>
                <Field label="Monthly fee (₹)">{(p) => <Input {...p} inputMode="numeric" value={t.monthlyFee} onChange={(e) => setDraft({ ...draft, tiers: draft.tiers.map((x, j) => (j === i ? { ...x, monthlyFee: Number(e.target.value.replace(/\D/g, "") || 0) } : x)) })} />}</Field>
                <Field label="Seat limit" hint="Empty = unlimited">{(p) => <Input {...p} inputMode="numeric" value={t.seatLimit ?? ""} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setDraft({ ...draft, tiers: draft.tiers.map((x, j) => (j === i ? { ...x, seatLimit: v ? Number(v) : null } : x)) }); }} />}</Field>
                <Field label="Description" className="col-span-2 sm:col-span-1">{(p) => <Input {...p} value={t.description} onChange={(e) => setDraft({ ...draft, tiers: draft.tiers.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />}</Field>
              </div>
            ))}
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="outline" disabled={!dirty} onClick={() => setDraft(structuredClone(settings))}>Discard</Button>
            <Button disabled={!dirty || save.pending} onClick={() => save.run()}>
              {save.pending && <Loader2 className="animate-spin" />} Save changes
            </Button>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Demo data</CardTitle>
            <CardDescription>All data in this demo is stored in your browser. Reset restores the original sample businesses.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => setResetOpen(true)}><RotateCcw /> Reset demo data</Button>
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset all demo data?"
        description="Every business, student, payment and setting changed in this browser will be replaced with the original sample data."
        confirmLabel="Reset"
        destructive
        onConfirm={() => {
          seedDb();
          signOut();
          router.push("/login");
        }}
      />
    </>
  );
}
