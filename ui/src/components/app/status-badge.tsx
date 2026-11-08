import {
  Ban,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock,
  Hourglass,
  PauseCircle,
  User,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  BookingRequestStatus,
  MembershipStatus,
  PaymentRecordStatus,
  PaymentStatus,
  SeatState,
  SubscriptionStatus,
  TenantStatus,
} from "@/lib/types";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "primary" | "brand";

const TONE: Record<Tone, string> = {
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-[oklch(0.5_0.12_65)] border-warning/25",
  danger: "bg-danger-soft text-destructive border-destructive/20",
  info: "bg-info-soft text-info border-info/20",
  neutral: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/8 text-primary border-primary/15",
  brand: "bg-brand/10 text-brand border-brand/20",
};

/** Status pill with an icon + text label — colour is never the only cue. */
export function StatusPill({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: Tone;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[11px] font-medium whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3" aria-hidden />}
      {children}
    </span>
  );
}

export const MEMBERSHIP_STATUS_META: Record<MembershipStatus | "none", { label: string; tone: Tone; icon: LucideIcon }> = {
  active: { label: "Active", tone: "success", icon: CheckCircle2 },
  expiring: { label: "Expiring soon", tone: "warning", icon: Hourglass },
  upcoming: { label: "Upcoming", tone: "info", icon: CalendarClock },
  expired: { label: "Expired", tone: "neutral", icon: XCircle },
  cancelled: { label: "Cancelled", tone: "danger", icon: Ban },
  none: { label: "No membership", tone: "neutral", icon: CircleDashed },
};

export function MembershipStatusBadge({ status }: { status: MembershipStatus | "none" }) {
  const m = MEMBERSHIP_STATUS_META[status];
  return <StatusPill tone={m.tone} icon={m.icon}>{m.label}</StatusPill>;
}

const PAYMENT_META: Record<PaymentStatus | "none", { label: string; tone: Tone; icon: LucideIcon }> = {
  paid: { label: "Paid", tone: "success", icon: CheckCircle2 },
  partial: { label: "Partial", tone: "warning", icon: CircleDot },
  unpaid: { label: "Unpaid", tone: "danger", icon: XCircle },
  none: { label: "—", tone: "neutral", icon: CircleDashed },
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus | "none" }) {
  if (status === "none") return <span className="text-xs text-muted-foreground">—</span>;
  const m = PAYMENT_META[status];
  return <StatusPill tone={m.tone} icon={m.icon}>{m.label}</StatusPill>;
}

const RECORD_META: Record<PaymentRecordStatus, { label: string; tone: Tone; icon: LucideIcon }> = {
  completed: { label: "Received", tone: "success", icon: CheckCircle2 },
  pending: { label: "Pending", tone: "warning", icon: Clock },
  failed: { label: "Failed", tone: "danger", icon: XCircle },
};

export function PaymentRecordBadge({ status }: { status: PaymentRecordStatus }) {
  const m = RECORD_META[status];
  return <StatusPill tone={m.tone} icon={m.icon}>{m.label}</StatusPill>;
}

export const SEAT_STATE_STYLE: Record<SeatState, { tone: Tone; icon: LucideIcon; label: string }> = {
  available: { tone: "success", icon: CheckCircle2, label: "Available" },
  occupied: { tone: "primary", icon: User, label: "Occupied" },
  reserved: { tone: "warning", icon: CalendarClock, label: "Reserved" },
  maintenance: { tone: "neutral", icon: Wrench, label: "Maintenance" },
};

export function SeatStateBadge({ state }: { state: SeatState }) {
  const m = SEAT_STATE_STYLE[state];
  return <StatusPill tone={m.tone} icon={m.icon}>{m.label}</StatusPill>;
}

const TENANT_META: Record<TenantStatus, { label: string; tone: Tone; icon: LucideIcon }> = {
  active: { label: "Active", tone: "success", icon: CheckCircle2 },
  inactive: { label: "Inactive", tone: "neutral", icon: PauseCircle },
  suspended: { label: "Suspended", tone: "danger", icon: Ban },
};

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  const m = TENANT_META[status];
  return <StatusPill tone={m.tone} icon={m.icon}>{m.label}</StatusPill>;
}

const SUB_META: Record<SubscriptionStatus, { label: string; tone: Tone }> = {
  trial: { label: "Trial", tone: "info" },
  active: { label: "Active", tone: "success" },
  past_due: { label: "Past due", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function SubscriptionBadge({ status }: { status: SubscriptionStatus }) {
  const m = SUB_META[status];
  return <StatusPill tone={m.tone}>{m.label}</StatusPill>;
}

const REQUEST_META: Record<BookingRequestStatus, { label: string; tone: Tone; icon: LucideIcon }> = {
  pending: { label: "Awaiting approval", tone: "warning", icon: Clock },
  approved: { label: "Approved", tone: "success", icon: CheckCircle2 },
  declined: { label: "Declined", tone: "danger", icon: XCircle },
  withdrawn: { label: "Withdrawn", tone: "neutral", icon: Ban },
};

export function BookingRequestBadge({ status }: { status: BookingRequestStatus }) {
  const m = REQUEST_META[status];
  return <StatusPill tone={m.tone} icon={m.icon}>{m.label}</StatusPill>;
}
