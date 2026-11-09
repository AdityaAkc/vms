"use client";

import { useRef, useState } from "react";
import { Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { BrandMark } from "@/components/app/brand-mark";
import { Field, FormGrid } from "@/components/app/field";
import { AddSeatsDialog, RemoveSeatsDialog } from "@/components/seats/capacity-dialogs";
import { LayoutDialog } from "@/components/seats/seat-dialogs";
import { BRAND_COLORS } from "@/config/app";
import { WEEKDAYS, formatDate, formatTime } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { useAction } from "@/lib/hooks/use-action";
import { useTenant } from "@/lib/hooks/use-tenant";
import { uid } from "@/lib/id";
import { settingsService } from "@/lib/services";
import type { TenantSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

type Section = Exclude<keyof TenantSettings, "layout" | "locale">;

/** Shared save footer + dirty tracking for a settings section. */
function useSection<S extends Section>(section: S) {
  const { tenantId, settings } = useTenant();
  const [draft, setDraft] = useState<TenantSettings[S]>(() => structuredClone(settings[section]));
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings[section]);
  const save = useAction(async () => {
    await settingsService.update(tenantId, section, draft);
    return true;
  }, { success: "Settings saved" });
  const footer = (
    <CardFooter className="justify-end gap-2">
      {dirty && <span className="mr-auto text-xs text-muted-foreground">Unsaved changes</span>}
      <Button variant="outline" disabled={!dirty || save.pending} onClick={() => setDraft(structuredClone(settings[section]))}>
        Discard
      </Button>
      <Button disabled={!dirty || save.pending} onClick={() => save.run()}>
        {save.pending && <Loader2 className="animate-spin" />} Save changes
      </Button>
    </CardFooter>
  );
  return { draft, setDraft, footer };
}

/* ------------------------------ General ------------------------------ */

export function GeneralSettings() {
  const { draft, setDraft, footer } = useSection("general");
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) => setDraft({ ...draft, [k]: v });

  const onLogo = (file?: File) => {
    setLogoError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) return setLogoError("Choose an image file (PNG, JPG or SVG).");
    if (file.size > 300 * 1024) return setLogoError("Logo must be under 300 KB.");
    const reader = new FileReader();
    reader.onload = () => set("logoDataUrl", String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>How your reading room appears to students, on receipts and in the student portal.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <BrandMark name={draft.name || "?"} logo={draft.logoDataUrl} color={draft.brandColor} size="lg" className="size-16 text-lg" />
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload /> Upload logo
              </Button>
              {draft.logoDataUrl && (
                <Button variant="ghost" size="sm" onClick={() => set("logoDataUrl", undefined)}>
                  <X /> Remove
                </Button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} aria-label="Upload logo" />
            <p className={cn("text-xs", logoError ? "text-destructive" : "text-muted-foreground")}>
              {logoError ?? "Square image, under 300 KB. Stored in this browser for the demo."}
            </p>
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-foreground/80">Brand colour</legend>
          <div className="flex flex-wrap items-center gap-2">
            {BRAND_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => set("brandColor", c.value)}
                aria-pressed={draft.brandColor === c.value}
                aria-label={c.name}
                title={c.name}
                className={cn(
                  "size-8 rounded-full outline-none ring-offset-2 transition focus-visible:ring-3 focus-visible:ring-ring/50",
                  draft.brandColor === c.value && "ring-2 ring-foreground",
                )}
                style={{ backgroundColor: c.value }}
              />
            ))}
            <label className="ml-1 flex items-center gap-2 text-xs text-muted-foreground">
              Custom
              <input
                type="color"
                value={draft.brandColor}
                onChange={(e) => set("brandColor", e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border bg-transparent"
                aria-label="Custom brand colour"
              />
            </label>
          </div>
        </fieldset>

        <FormGrid>
          <Field label="Reading room name" required className="sm:col-span-2">
            {(p) => <Input {...p} value={draft.name} onChange={(e) => set("name", e.target.value)} />}
          </Field>
          <Field label="Tagline" className="sm:col-span-2">
            {(p) => <Input {...p} value={draft.tagline} onChange={(e) => set("tagline", e.target.value)} />}
          </Field>
          <Field label="Address" className="sm:col-span-2">
            {(p) => <Input {...p} value={draft.address} onChange={(e) => set("address", e.target.value)} />}
          </Field>
          <Field label="City">{(p) => <Input {...p} value={draft.city} onChange={(e) => set("city", e.target.value)} />}</Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="State">{(p) => <Input {...p} value={draft.state} onChange={(e) => set("state", e.target.value)} />}</Field>
            <Field label="PIN code">{(p) => <Input {...p} inputMode="numeric" maxLength={6} value={draft.pincode} onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))} />}</Field>
          </div>
          <Field label="Contact number">{(p) => <Input {...p} inputMode="tel" value={draft.phone} onChange={(e) => set("phone", e.target.value)} />}</Field>
          <Field label="Email">{(p) => <Input {...p} type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} />}</Field>
          <Field label="Description" hint="Shown to students in the portal" className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={3} value={draft.description} onChange={(e) => set("description", e.target.value)} />}
          </Field>
        </FormGrid>
      </CardContent>
      {footer}
    </Card>
  );
}

/* ------------------------------ Hours ------------------------------ */

export function HoursSettings() {
  const { today } = useTenant();
  const { draft, setDraft, footer } = useSection("hours");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayLabel, setHolidayLabel] = useState("");
  const toggleDay = (d: number) =>
    setDraft({ ...draft, workingDays: draft.workingDays.includes(d) ? draft.workingDays.filter((x) => x !== d) : [...draft.workingDays, d].sort() });

  const holidays = [...draft.holidays].sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operating hours</CardTitle>
        <CardDescription>
          Currently {formatTime(draft.openTime)} – {formatTime(draft.closeTime)}, {draft.workingDays.length} days a week.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormGrid>
          <Field label="Opening time">{(p) => <Input {...p} type="time" value={draft.openTime} onChange={(e) => setDraft({ ...draft, openTime: e.target.value })} />}</Field>
          <Field label="Closing time">{(p) => <Input {...p} type="time" value={draft.closeTime} onChange={(e) => setDraft({ ...draft, closeTime: e.target.value })} />}</Field>
        </FormGrid>
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-foreground/80">Working days</legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d, i) => (
              <button
                key={d}
                type="button"
                aria-pressed={draft.workingDays.includes(i)}
                onClick={() => toggleDay(i)}
                className={cn(
                  "h-9 w-12 rounded-md border text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  draft.workingDays.includes(i) ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:border-foreground/30",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <div className="mb-2 text-xs font-medium text-foreground/80">Holidays</div>
          <ul className="divide-y rounded-lg border">
            {holidays.length === 0 && <li className="p-3 text-sm text-muted-foreground">No holidays configured.</li>}
            {holidays.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{h.label}</span>
                  <span className="ml-2 text-muted-foreground tabular">{formatDate(h.date, "EEE, d MMM yyyy")}</span>
                  {h.date < today && <span className="ml-2 text-xs text-muted-foreground">(past)</span>}
                </span>
                <Button size="icon-sm" variant="ghost" aria-label={`Remove ${h.label}`} onClick={() => setDraft({ ...draft, holidays: draft.holidays.filter((x) => x.id !== h.id) })}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} aria-label="Holiday date" className="sm:w-44" />
            <Input value={holidayLabel} onChange={(e) => setHolidayLabel(e.target.value)} placeholder="e.g. Diwali" aria-label="Holiday name" />
            <Button
              variant="outline"
              disabled={!holidayDate || !holidayLabel.trim()}
              onClick={() => {
                setDraft({ ...draft, holidays: [...draft.holidays, { id: uid("hol"), date: holidayDate, label: holidayLabel.trim() }] });
                setHolidayDate("");
                setHolidayLabel("");
              }}
            >
              <Plus /> Add holiday
            </Button>
          </div>
        </div>
      </CardContent>
      {footer}
    </Card>
  );
}

/* ------------------------------ Seats ------------------------------ */

export function SeatSettings() {
  const { settings, views } = useTenant();
  const [dialog, setDialog] = useState<null | "add" | "remove" | "layout">(null);
  const { layout } = settings;
  const rows = Math.ceil(views.seats.length / Math.max(1, layout.columns));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seat configuration</CardTitle>
        <CardDescription>Capacity, floor-plan layout and seat numbering.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-muted-foreground">Capacity</dt><dd className="text-lg font-semibold tabular">{views.seats.length}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Layout</dt><dd className="text-lg font-semibold tabular">{rows} × {layout.columns}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Aisle</dt><dd className="font-medium">{layout.aisleEvery ? `After every ${layout.aisleEvery}` : "None"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Numbering</dt><dd className="font-medium">{layout.numbering === "row-letter" ? "Row letter (A-01)" : `Sequential (${layout.prefix}01)`}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDialog("add")}><Plus /> Add seats</Button>
          <Button variant="outline" onClick={() => setDialog("remove")}>Reduce capacity</Button>
          <Button variant="outline" onClick={() => setDialog("layout")}>Rows, columns & numbering</Button>
        </div>
        <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Availability rules</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>Seats under maintenance are never offered for booking.</li>
            <li>A seat can&apos;t be booked by two students for overlapping dates.</li>
            <li>Seats with current or upcoming bookings can&apos;t be removed; removed seats keep their history.</li>
          </ul>
        </div>
      </CardContent>
      <AddSeatsDialog open={dialog === "add"} onOpenChange={(o) => setDialog(o ? "add" : null)} />
      <RemoveSeatsDialog open={dialog === "remove"} onOpenChange={(o) => setDialog(o ? "remove" : null)} />
      <LayoutDialog open={dialog === "layout"} onOpenChange={(o) => setDialog(o ? "layout" : null)} />
    </Card>
  );
}

/* ------------------------------ Pricing ------------------------------ */

export function PricingSettings() {
  const { data } = useTenant();
  const { draft, setDraft, footer } = useSection("pricing");
  const money = (v: number) => (Number.isFinite(v) ? String(v) : "");
  const num = (s: string) => Number(s.replace(/\D/g, "") || 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing</CardTitle>
        <CardDescription>
          Base prices and extra charges. Membership plans ({data.plans.filter((p) => p.isActive).length} active) are managed under Plans & pricing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Default monthly price (₹)" hint="Reference price for new plans">
            {(p) => <Input {...p} inputMode="numeric" value={money(draft.defaultMonthlyPrice)} onChange={(e) => setDraft({ ...draft, defaultMonthlyPrice: num(e.target.value) })} />}
          </Field>
          <Field label="Admission fee (₹)" hint="One-time, on first membership">
            {(p) => <Input {...p} inputMode="numeric" value={money(draft.admissionFee)} onChange={(e) => setDraft({ ...draft, admissionFee: num(e.target.value) })} />}
          </Field>
          <Field label="Security deposit (₹)" hint="Refundable">
            {(p) => <Input {...p} inputMode="numeric" value={money(draft.securityDeposit)} onChange={(e) => setDraft({ ...draft, securityDeposit: num(e.target.value) })} />}
          </Field>
        </div>
        <div>
          <div className="mb-2 text-xs font-medium text-foreground/80">Additional charges</div>
          <ul className="space-y-2">
            {draft.charges.map((c, i) => {
              const update = (patch: Partial<typeof c>) =>
                setDraft({ ...draft, charges: draft.charges.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
              return (
                <li key={c.id} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_120px_140px_auto_auto]">
                  <Input value={c.name} onChange={(e) => update({ name: e.target.value })} aria-label="Charge name" placeholder="Charge name" className="col-span-2 sm:col-span-1" />
                  <Input inputMode="numeric" value={money(c.amount)} onChange={(e) => update({ amount: num(e.target.value) })} aria-label="Amount" />
                  <Select value={c.frequency} onValueChange={(v) => update({ frequency: v as typeof c.frequency })}>
                    <SelectTrigger aria-label="Frequency" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one-time">One-time</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                  <Switch checked={c.isActive} onCheckedChange={(v) => update({ isActive: v })} aria-label={`${c.name} active`} />
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove ${c.name}`} onClick={() => setDraft({ ...draft, charges: draft.charges.filter((_, j) => j !== i) })}>
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setDraft({ ...draft, charges: [...draft.charges, { id: uid("chg"), name: "", amount: 0, frequency: "monthly", isActive: true }] })}
          >
            <Plus /> Add charge
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Extra charges are listed for students and staff. Automatically adding them to membership totals is planned for a later release.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Preview: monthly plan at the default price is {formatCurrency(draft.defaultMonthlyPrice)}.</p>
      </CardContent>
      {footer}
    </Card>
  );
}

/* ------------------------------ Facilities ------------------------------ */

export function FacilitySettings() {
  const { draft, setDraft, footer } = useSection("facilities");
  const [custom, setCustom] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Facilities</CardTitle>
        <CardDescription>Shown to students in the portal so they know what to expect.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="grid gap-2 sm:grid-cols-2">
          {draft.map((f, i) => (
            <li key={f.key} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
              <label htmlFor={`fac-${f.key}`} className="text-sm">{f.label}</label>
              <div className="flex items-center gap-1">
                {f.custom && (
                  <Button size="icon-xs" variant="ghost" aria-label={`Remove ${f.label}`} onClick={() => setDraft(draft.filter((_, j) => j !== i))}>
                    <X />
                  </Button>
                )}
                <Switch id={`fac-${f.key}`} checked={f.enabled} onCheckedChange={(v) => setDraft(draft.map((x, j) => (j === i ? { ...x, enabled: v } : x)))} />
              </div>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!custom.trim()) return;
            setDraft([...draft, { key: uid("fac"), label: custom.trim(), enabled: true, custom: true }]);
            setCustom("");
          }}
        >
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add a facility, e.g. Cafeteria" aria-label="Custom facility" />
          <Button type="submit" variant="outline" disabled={!custom.trim()}><Plus /> Add</Button>
        </form>
      </CardContent>
      {footer}
    </Card>
  );
}

/* ------------------------------ Rules ------------------------------ */

export function RuleSettings() {
  const { draft, setDraft, footer } = useSection("rules");
  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) => setDraft({ ...draft, [k]: v });
  const n = (s: string) => Number(s.replace(/\D/g, "") || 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking rules</CardTitle>
        <CardDescription>How students book, renew and change seats.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="mb-2 text-xs font-medium text-foreground/80">Student self-booking</legend>
          {(
            [
              ["instant", "Instant booking", "Students confirm a free seat themselves; payment is collected at the desk."],
              ["approval", "Requires approval", "Students send a request; you approve it before the seat is held."],
            ] as const
          ).map(([value, title, desc]) => (
            <button
              key={value}
              type="button"
              aria-pressed={draft.bookingMode === value}
              onClick={() => set("bookingMode", value)}
              className={cn(
                "rounded-lg border p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                draft.bookingMode === value ? "border-brand/50 bg-brand/5 ring-1 ring-brand/30" : "hover:border-foreground/20",
              )}
            >
              <div className="text-sm font-medium">{title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
            </button>
          ))}
        </fieldset>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Minimum duration (months)">{(p) => <Input {...p} inputMode="numeric" value={draft.minDurationMonths} onChange={(e) => set("minDurationMonths", n(e.target.value))} />}</Field>
          <Field label="Advance booking (days)" hint="How far ahead a start date can be">{(p) => <Input {...p} inputMode="numeric" value={draft.advanceBookingDays} onChange={(e) => set("advanceBookingDays", n(e.target.value))} />}</Field>
          <Field label="'Expiring soon' window (days)">{(p) => <Input {...p} inputMode="numeric" value={draft.expiringSoonDays} onChange={(e) => set("expiringSoonDays", n(e.target.value))} />}</Field>
          <Field label="Renewal opens (days before expiry)">{(p) => <Input {...p} inputMode="numeric" value={draft.renewalWindowDays} onChange={(e) => set("renewalWindowDays", n(e.target.value))} />}</Field>
          <Field label="Grace period (days)" hint="Informational; shown to students">{(p) => <Input {...p} inputMode="numeric" value={draft.gracePeriodDays} onChange={(e) => set("gracePeriodDays", n(e.target.value))} />}</Field>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          <span>
            <span className="font-medium">Allow students to request seat changes</span>
            <span className="block text-xs text-muted-foreground">Shown in the student portal with your seat change policy.</span>
          </span>
          <Switch checked={draft.allowStudentSeatChange} onCheckedChange={(v) => set("allowStudentSeatChange", v)} />
        </label>
        <FormGrid>
          <Field label="Renewal policy" className="sm:col-span-2">{(p) => <Textarea {...p} rows={2} value={draft.renewalPolicy} onChange={(e) => set("renewalPolicy", e.target.value)} />}</Field>
          <Field label="Cancellation policy">{(p) => <Textarea {...p} rows={3} value={draft.cancellationPolicy} onChange={(e) => set("cancellationPolicy", e.target.value)} />}</Field>
          <Field label="Seat change policy">{(p) => <Textarea {...p} rows={3} value={draft.seatChangePolicy} onChange={(e) => set("seatChangePolicy", e.target.value)} />}</Field>
        </FormGrid>
      </CardContent>
      {footer}
    </Card>
  );
}
