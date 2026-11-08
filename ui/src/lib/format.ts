import type { PaymentMethod } from "./types";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrCompact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const num = new Intl.NumberFormat("en-IN");

export function formatCurrency(amount: number): string {
  return inr.format(Math.round(amount));
}

export function formatCurrencyCompact(amount: number): string {
  return inrCompact.format(amount);
}

export function formatNumber(n: number): string {
  return num.format(n);
}

export function formatPercent(ratio: number, digits = 0): string {
  if (!Number.isFinite(ratio)) return "0%";
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** "+91 98290 12345" style display for a 10-digit Indian mobile. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return phone;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank transfer",
  other: "Other",
};

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
