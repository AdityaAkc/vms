/**
 * Application-wide (product) configuration. Nothing here is specific to a
 * single reading-room business — tenant-specific values live in
 * `TenantSettings` and are edited from each workspace's settings screen.
 */
import type { Facility, PlatformSettings, TenantSettings } from "@/lib/types";
import { DEFAULT_TIMEZONE } from "@/lib/date";

export const APP_CONFIG = {
  /** Fallback product name; the live value comes from platform settings. */
  productName: "Seatwise",
  productTagline: "Operating system for reading rooms",
  storageKey: "seatwise-demo-db",
  sessionKey: "seatwise-demo-session",
  /** Bump when the persisted shape changes; older data is reseeded. */
  dataVersion: 4,
  /** Artificial latency for mock services, so loading states are visible. */
  mockLatencyMs: 350,
} as const;

export const FACILITY_CATALOG: Omit<Facility, "enabled">[] = [
  { key: "ac", label: "Air conditioning" },
  { key: "wifi", label: "High-speed Wi-Fi" },
  { key: "power_backup", label: "Power backup" },
  { key: "charging", label: "Charging points" },
  { key: "cctv", label: "CCTV surveillance" },
  { key: "water", label: "RO drinking water" },
  { key: "locker", label: "Personal lockers" },
  { key: "parking", label: "Two-wheeler parking" },
  { key: "silent_zone", label: "Silent zone" },
  { key: "newspaper", label: "Newspapers & magazines" },
];

export const SEAT_TAGS = [
  "Window",
  "Charging point",
  "Near AC",
  "Corner",
  "Locker below",
  "Quiet zone",
] as const;

export const EXAM_TRACKS = [
  "UPSC CSE",
  "SSC CGL",
  "Banking (IBPS PO)",
  "NEET UG",
  "JEE Main",
  "CA Foundation",
  "State PSC",
  "Railway NTPC",
  "GATE",
  "CLAT",
  "University exams",
  "Other",
] as const;

export const BRAND_COLORS = [
  { name: "Teal", value: "#2f7f86" },
  { name: "Navy", value: "#243b63" },
  { name: "Indigo", value: "#4f46a8" },
  { name: "Emerald", value: "#2f7d5b" },
  { name: "Saffron", value: "#c2711b" },
  { name: "Plum", value: "#7a3e6c" },
] as const;

export function defaultTenantSettings(input: {
  name: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  columns?: number;
}): TenantSettings {
  return {
    general: {
      name: input.name,
      tagline: "A calm, focused space to study",
      brandColor: BRAND_COLORS[0].value,
      address: "",
      city: input.city,
      state: input.state,
      pincode: "",
      phone: input.phone,
      email: input.email,
      description: "",
    },
    locale: { timezone: DEFAULT_TIMEZONE, currency: "INR" },
    hours: {
      openTime: "06:00",
      closeTime: "22:00",
      workingDays: [0, 1, 2, 3, 4, 5, 6],
      holidays: [],
    },
    layout: { columns: input.columns ?? 10, aisleEvery: 5, numbering: "numeric", prefix: "S-" },
    pricing: { defaultMonthlyPrice: 1500, admissionFee: 0, securityDeposit: 0, charges: [] },
    facilities: FACILITY_CATALOG.map((f, i) => ({ ...f, enabled: i < 6 })),
    rules: {
      minDurationMonths: 1,
      advanceBookingDays: 15,
      renewalWindowDays: 10,
      gracePeriodDays: 3,
      expiringSoonDays: 7,
      bookingMode: "instant",
      allowStudentSeatChange: false,
      cancellationPolicy: "Fees once paid are non-refundable. Seats are released on cancellation.",
      seatChangePolicy: "Seat changes are subject to availability and must be requested at the front desk.",
      renewalPolicy: "Renew before expiry to keep the same seat. Unrenewed seats are released after the grace period.",
    },
  };
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  productName: APP_CONFIG.productName,
  supportEmail: "support@seatwise.app",
  supportPhone: "8045671200",
  defaultTrialDays: 14,
  tiers: [
    { key: "starter", name: "Starter", monthlyFee: 999, seatLimit: 50, description: "Single room, up to 50 seats" },
    { key: "growth", name: "Growth", monthlyFee: 1999, seatLimit: 150, description: "Up to 150 seats, reports & student portal" },
    { key: "scale", name: "Scale", monthlyFee: 3999, seatLimit: null, description: "Unlimited seats, priority support" },
  ],
};
