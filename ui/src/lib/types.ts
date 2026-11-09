/**
 * Domain model for the reading-room platform.
 *
 * Everything that belongs to a single reading-room business lives inside
 * `TenantData` and is always addressed by `tenantId`. Platform-wide records
 * (the list of businesses, SaaS subscription tiers) live in `PlatformData`.
 *
 * Derived values (membership status, seat occupancy, amount paid, balances)
 * are NOT stored. They are computed from dates and payments in `lib/domain`
 * so that the data can never contradict itself.
 */

export type ID = string;
/** Calendar date in `YYYY-MM-DD` (interpreted in the tenant's timezone). */
export type ISODate = string;
/** Full ISO-8601 timestamp. */
export type ISODateTime = string;

/* ------------------------------------------------------------------ */
/* Platform / tenants                                                  */
/* ------------------------------------------------------------------ */

export type TenantStatus = "active" | "inactive" | "suspended";
export type SubscriptionStatus = "trial" | "active" | "past_due" | "cancelled";

export interface SubscriptionTier {
  key: string;
  name: string;
  monthlyFee: number;
  seatLimit: number | null;
  description: string;
}

export interface Tenant {
  id: ID;
  slug: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  city: string;
  state: string;
  status: TenantStatus;
  statusReason?: string;
  subscription: {
    tierKey: string;
    status: SubscriptionStatus;
    startedOn: ISODate;
    renewsOn: ISODate;
  };
  createdAt: ISODateTime;
}

export interface PlatformSettings {
  productName: string;
  supportEmail: string;
  supportPhone: string;
  defaultTrialDays: number;
  tiers: SubscriptionTier[];
}

export interface PlatformData {
  tenants: Tenant[];
  settings: PlatformSettings;
}

/* ------------------------------------------------------------------ */
/* Tenant settings                                                     */
/* ------------------------------------------------------------------ */

export type SeatNumbering = "row-letter" | "numeric";

export interface Holiday {
  id: ID;
  date: ISODate;
  label: string;
}

export interface ExtraCharge {
  id: ID;
  name: string;
  amount: number;
  frequency: "one-time" | "monthly";
  isActive: boolean;
}

export interface Facility {
  key: string;
  label: string;
  enabled: boolean;
  custom?: boolean;
}

export interface TenantSettings {
  general: {
    name: string;
    tagline: string;
    logoDataUrl?: string;
    brandColor: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    email: string;
    description: string;
  };
  locale: {
    timezone: string;
    currency: "INR";
  };
  hours: {
    openTime: string; // HH:mm
    closeTime: string; // HH:mm
    workingDays: number[]; // 0 = Sunday
    holidays: Holiday[];
  };
  layout: {
    columns: number;
    aisleEvery: number; // 0 = no aisle
    numbering: SeatNumbering;
    prefix: string; // used by numeric numbering, e.g. "S-"
  };
  pricing: {
    defaultMonthlyPrice: number;
    admissionFee: number;
    securityDeposit: number;
    charges: ExtraCharge[];
  };
  facilities: Facility[];
  rules: {
    minDurationMonths: number;
    advanceBookingDays: number;
    renewalWindowDays: number;
    gracePeriodDays: number;
    expiringSoonDays: number;
    bookingMode: "instant" | "approval";
    allowStudentSeatChange: boolean;
    cancellationPolicy: string;
    seatChangePolicy: string;
    renewalPolicy: string;
  };
}

/* ------------------------------------------------------------------ */
/* Tenant operational data                                             */
/* ------------------------------------------------------------------ */

export interface Seat {
  id: ID;
  /** Monotonic number, never reused, used for ordering. */
  number: number;
  /** Display code, e.g. "A-01" or "S-051". Stable identifier for humans. */
  code: string;
  tags: string[];
  notes?: string;
  isUnderMaintenance: boolean;
  maintenanceNote?: string;
  createdAt: ISODateTime;
  /** Soft-delete: removed seats keep their history. */
  removedAt?: ISODateTime;
}

export type SeatEventType =
  | "created"
  | "assigned"
  | "renewed"
  | "transferred_in"
  | "transferred_out"
  | "released"
  | "maintenance_on"
  | "maintenance_off"
  | "edited"
  | "removed"
  | "restored";

export interface SeatEvent {
  id: ID;
  seatId: ID;
  type: SeatEventType;
  at: ISODateTime;
  studentId?: ID;
  membershipId?: ID;
  note?: string;
}

export type Gender = "female" | "male" | "other";

export interface StudentNote {
  id: ID;
  text: string;
  at: ISODateTime;
}

export interface Student {
  id: ID;
  code: string;
  name: string;
  phone: string;
  email: string;
  gender: Gender;
  dateOfBirth?: ISODate;
  address: string;
  guardianName?: string;
  guardianPhone?: string;
  preparingFor?: string;
  joinedOn: ISODate;
  status: "active" | "inactive";
  inactiveReason?: string;
  notes: StudentNote[];
}

export interface MembershipPlan {
  id: ID;
  name: string;
  durationMonths: number;
  price: number;
  description?: string;
  isActive: boolean;
  isFeatured?: boolean;
  createdAt: ISODateTime;
}

export interface Membership {
  id: ID;
  code: string;
  studentId: ID;
  seatId: ID;
  /** Plan reference plus a snapshot so later plan edits never alter it. */
  planId: ID;
  planName: string;
  durationMonths: number;
  startDate: ISODate;
  endDate: ISODate; // inclusive
  listPrice: number;
  discount: number;
  totalAmount: number;
  source: "admin" | "student";
  renewalOf?: ID;
  cancelledAt?: ISODateTime;
  cancelReason?: string;
  createdAt: ISODateTime;
}

export type PaymentMethod = "cash" | "upi" | "bank_transfer" | "other";
export type PaymentRecordStatus = "completed" | "pending" | "failed";

export interface Payment {
  id: ID;
  receiptNo: string;
  studentId: ID;
  membershipId: ID;
  amount: number;
  method: PaymentMethod;
  status: PaymentRecordStatus;
  paidOn: ISODate;
  reference?: string;
  note?: string;
  createdAt: ISODateTime;
}

export type BookingRequestStatus = "pending" | "approved" | "declined" | "withdrawn";

export interface BookingRequest {
  id: ID;
  studentId: ID;
  seatId: ID;
  planId: ID;
  startDate: ISODate;
  status: BookingRequestStatus;
  createdAt: ISODateTime;
  decidedAt?: ISODateTime;
  decisionNote?: string;
  membershipId?: ID;
}

export interface TenantData {
  settings: TenantSettings;
  seats: Seat[];
  seatEvents: SeatEvent[];
  students: Student[];
  plans: MembershipPlan[];
  memberships: Membership[];
  payments: Payment[];
  bookingRequests: BookingRequest[];
  counters: {
    seat: number;
    student: number;
    membership: number;
    receipt: number;
  };
}

/* ------------------------------------------------------------------ */
/* Derived (view) types                                                */
/* ------------------------------------------------------------------ */

export type MembershipStatus =
  | "upcoming"
  | "active"
  | "expiring"
  | "expired"
  | "cancelled";

export type PaymentStatus = "paid" | "partial" | "unpaid";

export type SeatState = "available" | "occupied" | "reserved" | "maintenance";

export interface MembershipView extends Membership {
  status: MembershipStatus;
  amountPaid: number;
  amountPending: number; // payments awaiting verification
  balance: number;
  paymentStatus: PaymentStatus;
  daysRemaining: number; // negative once expired
  studentName: string;
  seatCode: string;
}

export interface SeatView extends Seat {
  state: SeatState;
  current?: MembershipView;
  upcoming?: MembershipView;
  /** True when maintenance was switched on while a student still holds it. */
  hasConflict: boolean;
}

export interface StudentView extends Student {
  current?: MembershipView;
  upcoming?: MembershipView;
  latest?: MembershipView;
  membershipStatus: MembershipStatus | "none";
  seatCode?: string;
  /** Last date covered by current + chained upcoming memberships. */
  coveredUntil?: ISODate;
  balance: number;
  paymentStatus: PaymentStatus | "none";
}

export type Role = "platform" | "owner" | "student";

export interface DemoSession {
  role: Role;
  tenantId?: ID;
  studentId?: ID;
}
