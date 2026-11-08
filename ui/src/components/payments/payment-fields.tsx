"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/app/field";
import { PAYMENT_METHOD_LABEL, formatCurrency } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";

export interface PaymentDraft {
  amount: string;
  method: PaymentMethod;
  reference: string;
}

export const EMPTY_PAYMENT: PaymentDraft = { amount: "", method: "upi", reference: "" };

export function needsReference(method: PaymentMethod) {
  return method === "upi" || method === "bank_transfer";
}

export function validatePaymentDraft(p: PaymentDraft, max: number): string | null {
  const amount = Number(p.amount || 0);
  if (!Number.isFinite(amount) || amount < 0) return "Enter a valid amount.";
  if (amount > max) return `Cannot exceed ${formatCurrency(max)}.`;
  if (amount > 0 && needsReference(p.method) && !p.reference.trim()) return "Add the UPI / bank reference.";
  return null;
}

/** Amount + method + reference inputs used by membership & payment forms. */
export function PaymentFields({
  value,
  onChange,
  max,
  error,
  amountLabel = "Amount received now",
  optional = true,
}: {
  value: PaymentDraft;
  onChange: (v: PaymentDraft) => void;
  max: number;
  error?: string | null;
  amountLabel?: string;
  optional?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Field
        label={amountLabel}
        hint={optional ? "Leave empty to collect later" : undefined}
        error={error ?? undefined}
        className="sm:col-span-1"
      >
        {(p) => (
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
              <Input
                {...p}
                inputMode="numeric"
                className="pl-6 tabular"
                value={value.amount}
                onChange={(e) => onChange({ ...value, amount: e.target.value.replace(/[^\d]/g, "") })}
                placeholder="0"
              />
            </div>
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => onChange({ ...value, amount: String(max) })}>
              Full
            </Button>
          </div>
        )}
      </Field>
      <Field label="Method">
        {(p) => (
          <Select value={value.method} onValueChange={(m) => onChange({ ...value, method: m as PaymentMethod })}>
            <SelectTrigger id={p.id} className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
                <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <Field label="Reference" hint={needsReference(value.method) ? "UTR / transaction ID" : "Optional"}>
        {(p) => (
          <Input
            {...p}
            value={value.reference}
            onChange={(e) => onChange({ ...value, reference: e.target.value })}
            placeholder={value.method === "upi" ? "e.g. 4123 5678 9012" : value.method === "other" ? "Cheque no." : ""}
          />
        )}
      </Field>
    </div>
  );
}
