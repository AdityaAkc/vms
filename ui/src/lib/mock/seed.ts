/**
 * Deterministic demo data generator.
 *
 * Every business (tenant) gets its own isolated dataset. Dates are generated
 * relative to "today" in the tenant timezone, so the demo always shows a
 * realistic mix of active, expiring, upcoming and expired memberships.
 *
 * Consistency guarantees:
 *  - A seat never has two non-cancelled memberships with overlapping dates.
 *  - A student never holds two overlapping memberships.
 *  - Payments never exceed a membership's total and are never future-dated.
 *  - Seat state / membership status are derived, so they always match dates.
 */
import { defaultTenantSettings, DEFAULT_PLATFORM_SETTINGS, FACILITY_CATALOG } from "@/config/app";
import { addDays, addMonths, daysBetween, membershipEndDate, rangesOverlap, todayIn } from "../date";
import { generateSeats } from "../domain/seats";
import { pad } from "../id";
import type {
  BookingRequest,
  Gender,
  ISODate,
  Membership,
  MembershipPlan,
  Payment,
  PaymentMethod,
  PlatformData,
  Seat,
  SeatEvent,
  Student,
  Tenant,
  TenantData,
  TenantSettings,
} from "../types";
import { FEMALE_NAMES, LOCALITIES, MALE_NAMES, STUDENT_NOTES, SURNAMES } from "./names";
import { EXAM_TRACKS } from "@/config/app";

/* ---------------------------- PRNG ---------------------------- */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = ReturnType<typeof mulberry32>;
const int = (r: Rng, min: number, max: number) => min + Math.floor(r() * (max - min + 1));
const pick = <T,>(r: Rng, list: readonly T[]) => list[Math.floor(r() * list.length)]!;
function weighted<T>(r: Rng, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [item, w] of items) {
    if ((x -= w) <= 0) return item;
  }
  return items[items.length - 1]![0];
}
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/* ---------------------------- Specs ---------------------------- */

interface TenantSpec {
  id: string;
  short: string;
  seed: number;
  tenant: Omit<Tenant, "id" | "createdAt" | "subscription"> & {
    tierKey: string;
    subscriptionStatus: Tenant["subscription"]["status"];
  };
  createdMonthsAgo: number;
  seats: number;
  layout: TenantSettings["layout"];
  receiptPrefix: string;
  general: Partial<TenantSettings["general"]>;
  hours: Pick<TenantSettings["hours"], "openTime" | "closeTime" | "workingDays">;
  pricing: Partial<TenantSettings["pricing"]>;
  rules: Partial<TenantSettings["rules"]>;
  facilities: string[];
  plans: { name: string; months: number; price: number; active?: boolean; featured?: boolean; description?: string }[];
  mix: {
    current: number;
    expiring: number; // 0-6 days left
    soon15: number;
    soon30: number;
    renewedAhead: number;
    upcoming: number;
    expired: number;
    overdueExpired: number;
    fresh: number;
    inactive: number;
    cancelled: number;
  };
  maintenance: { note: string }[];
}

const SPECS: TenantSpec[] = [
  {
    id: "tnt_sunrise",
    short: "sr",
    seed: 1101,
    tenant: {
      slug: "sunrise-reading-room",
      name: "Sunrise Reading Room",
      ownerName: "Rajesh Meena",
      ownerEmail: "rajesh@sunrisereadingroom.in",
      ownerPhone: "9829012345",
      city: "Kota",
      state: "Rajasthan",
      status: "active",
      tierKey: "growth",
      subscriptionStatus: "active",
    },
    createdMonthsAgo: 14,
    seats: 50,
    layout: { columns: 10, aisleEvery: 5, numbering: "row-letter", prefix: "S-" },
    receiptPrefix: "SRR",
    general: {
      tagline: "Quiet, air-conditioned study seats in Talwandi",
      brandColor: "#2f7f86",
      address: "2nd Floor, Plot 14, Road No. 3, Talwandi",
      pincode: "324005",
      email: "hello@sunrisereadingroom.in",
      phone: "9829012345",
      description:
        "A focused, fully air-conditioned reading room for competitive exam aspirants. Reserved personal seats, silent zone, Wi-Fi and RO water. Open early morning to late night, all seven days.",
    },
    hours: { openTime: "06:00", closeTime: "23:00", workingDays: [0, 1, 2, 3, 4, 5, 6] },
    pricing: { defaultMonthlyPrice: 1500, admissionFee: 200, securityDeposit: 500 },
    rules: { bookingMode: "instant", expiringSoonDays: 7, advanceBookingDays: 15 },
    facilities: ["ac", "wifi", "power_backup", "charging", "cctv", "water", "locker", "silent_zone"],
    plans: [
      { name: "Monthly", months: 1, price: 1500, description: "Flexible month-to-month seat" },
      { name: "Quarterly", months: 3, price: 4200, featured: true, description: "Save ₹300 over monthly" },
      { name: "Half-yearly", months: 6, price: 8000, description: "Save ₹1,000 over monthly" },
      { name: "Annual", months: 12, price: 15000, description: "Best value — save ₹3,000" },
    ],
    mix: {
      current: 34, expiring: 4, soon15: 3, soon30: 3, renewedAhead: 2,
      upcoming: 2, expired: 2, overdueExpired: 1, fresh: 1, inactive: 1, cancelled: 0,
    },
    maintenance: [{ note: "Chair replacement scheduled" }, { note: "Desk lamp not working" }],
  },
  {
    id: "tnt_scholar",
    short: "sh",
    seed: 2202,
    tenant: {
      slug: "scholar-study-hub",
      name: "Scholar Study Hub",
      ownerName: "Sneha Kulkarni",
      ownerEmail: "sneha@scholarstudyhub.com",
      ownerPhone: "9850123456",
      city: "Pune",
      state: "Maharashtra",
      status: "active",
      tierKey: "scale",
      subscriptionStatus: "active",
    },
    createdMonthsAgo: 9,
    seats: 100,
    layout: { columns: 10, aisleEvery: 5, numbering: "numeric", prefix: "S-" },
    receiptPrefix: "SSH",
    general: {
      tagline: "Premium study space near FC Road",
      brandColor: "#4f46a8",
      address: "Office 301, Sai Plaza, Shivajinagar",
      pincode: "411005",
      email: "desk@scholarstudyhub.com",
      phone: "9850123456",
      description:
        "Pune's 100-seat premium study hub with ergonomic chairs, personal lockers and a dedicated discussion lounge. Booking requests are confirmed by the front desk within a few hours.",
    },
    hours: { openTime: "07:00", closeTime: "22:00", workingDays: [1, 2, 3, 4, 5, 6] },
    pricing: { defaultMonthlyPrice: 2000, admissionFee: 500, securityDeposit: 1000 },
    rules: { bookingMode: "approval", expiringSoonDays: 10, advanceBookingDays: 30, allowStudentSeatChange: true },
    facilities: ["ac", "wifi", "power_backup", "charging", "cctv", "water", "locker", "parking", "newspaper"],
    plans: [
      { name: "1 Month", months: 1, price: 2000 },
      { name: "3 Months", months: 3, price: 5700, featured: true },
      { name: "6 Months", months: 6, price: 10800 },
      { name: "12 Months", months: 12, price: 19999, active: false, description: "Paused for new sign-ups" },
    ],
    mix: {
      current: 62, expiring: 7, soon15: 5, soon30: 6, renewedAhead: 3,
      upcoming: 4, expired: 5, overdueExpired: 2, fresh: 3, inactive: 3, cancelled: 1,
    },
    maintenance: [{ note: "Power socket repair" }],
  },
  {
    id: "tnt_knowledge",
    short: "kp",
    seed: 3303,
    tenant: {
      slug: "knowledge-point",
      name: "Knowledge Point Reading Room",
      ownerName: "Amit Kumar Singh",
      ownerEmail: "amit.singh@knowledgepoint.in",
      ownerPhone: "9934567810",
      city: "Patna",
      state: "Bihar",
      status: "active",
      tierKey: "starter",
      subscriptionStatus: "trial",
    },
    createdMonthsAgo: 4,
    seats: 40,
    layout: { columns: 8, aisleEvery: 4, numbering: "numeric", prefix: "K" },
    receiptPrefix: "KPR",
    general: {
      tagline: "Affordable study seats on Boring Road",
      brandColor: "#c2711b",
      address: "Near Patna Women's College, Boring Road",
      pincode: "800001",
      email: "knowledgepoint.patna@gmail.com",
      phone: "9934567810",
      description: "A friendly, budget-friendly reading room with power backup and Wi-Fi.",
    },
    hours: { openTime: "06:00", closeTime: "21:00", workingDays: [1, 2, 3, 4, 5, 6] },
    pricing: { defaultMonthlyPrice: 1000 },
    rules: { bookingMode: "instant" },
    facilities: ["wifi", "power_backup", "water", "cctv"],
    plans: [
      { name: "Monthly", months: 1, price: 1000 },
      { name: "Quarterly", months: 3, price: 2800, featured: true },
    ],
    mix: {
      current: 22, expiring: 3, soon15: 2, soon30: 2, renewedAhead: 1,
      upcoming: 2, expired: 3, overdueExpired: 1, fresh: 1, inactive: 1, cancelled: 0,
    },
    maintenance: [],
  },
  {
    id: "tnt_ekagra",
    short: "ek",
    seed: 4404,
    tenant: {
      slug: "ekagra-study-space",
      name: "Ekagra Study Space",
      ownerName: "Pooja Jain",
      ownerEmail: "pooja@ekagra.space",
      ownerPhone: "9826543210",
      city: "Indore",
      state: "Madhya Pradesh",
      status: "inactive",
      statusReason: "Owner paused operations for renovation.",
      tierKey: "growth",
      subscriptionStatus: "cancelled",
    },
    createdMonthsAgo: 11,
    seats: 60,
    layout: { columns: 10, aisleEvery: 5, numbering: "numeric", prefix: "E-" },
    receiptPrefix: "EKS",
    general: { brandColor: "#2f7d5b", address: "Bhanwarkuan Main Road", pincode: "452001" },
    hours: { openTime: "06:30", closeTime: "22:30", workingDays: [0, 1, 2, 3, 4, 5, 6] },
    pricing: { defaultMonthlyPrice: 1200 },
    rules: {},
    facilities: ["ac", "wifi", "water"],
    plans: [
      { name: "Monthly", months: 1, price: 1200 },
      { name: "Quarterly", months: 3, price: 3300 },
    ],
    mix: {
      current: 14, expiring: 2, soon15: 2, soon30: 1, renewedAhead: 0,
      upcoming: 0, expired: 8, overdueExpired: 1, fresh: 0, inactive: 2, cancelled: 0,
    },
    maintenance: [],
  },
  {
    id: "tnt_pathshala",
    short: "pl",
    seed: 5505,
    tenant: {
      slug: "pathshala-reading-lounge",
      name: "Pathshala Reading Lounge",
      ownerName: "Mohd. Faizan Ahmed",
      ownerEmail: "faizan@pathshalalounge.in",
      ownerPhone: "9415098765",
      city: "Lucknow",
      state: "Uttar Pradesh",
      status: "suspended",
      statusReason: "Subscription payment overdue by 21 days.",
      tierKey: "starter",
      subscriptionStatus: "past_due",
    },
    createdMonthsAgo: 7,
    seats: 30,
    layout: { columns: 6, aisleEvery: 3, numbering: "numeric", prefix: "P" },
    receiptPrefix: "PRL",
    general: { brandColor: "#7a3e6c", address: "Kapoorthala Complex, Aliganj", pincode: "226024" },
    hours: { openTime: "07:00", closeTime: "21:00", workingDays: [1, 2, 3, 4, 5, 6] },
    pricing: { defaultMonthlyPrice: 900 },
    rules: {},
    facilities: ["wifi", "power_backup", "water"],
    plans: [{ name: "Monthly", months: 1, price: 900 }],
    mix: {
      current: 15, expiring: 2, soon15: 1, soon30: 1, renewedAhead: 0,
      upcoming: 1, expired: 3, overdueExpired: 1, fresh: 0, inactive: 1, cancelled: 0,
    },
    maintenance: [],
  },
];

/* ---------------------------- Builder ---------------------------- */

const METHOD_WEIGHTS: [PaymentMethod, number][] = [
  ["upi", 55],
  ["cash", 35],
  ["bank_transfer", 8],
  ["other", 2],
];

function referenceFor(r: Rng, method: PaymentMethod): string | undefined {
  switch (method) {
    case "upi":
      return `UPI ${int(r, 3000, 4999)}${int(r, 10000000, 99999999)}`;
    case "bank_transfer":
      return `NEFT ${pick(r, ["HDFC", "SBIN", "ICIC", "UTIB"])}${int(r, 100000000, 999999999)}`;
    case "other":
      return `Cheque ${pad(int(r, 1000, 99999), 6)}`;
    default:
      return undefined;
  }
}

function buildTenant(spec: TenantSpec, today: ISODate): { tenant: Tenant; data: TenantData } {
  const r = mulberry32(spec.seed);
  const createdOn = addMonths(today, -spec.createdMonthsAgo);
  const createdAt = `${createdOn}T10:00:00.000Z`;
  let seq = 0;
  const id = (kind: string) => `${kind}_${spec.short}_${++seq}`;

  /* settings */
  const base = defaultTenantSettings({
    name: spec.tenant.name,
    city: spec.tenant.city,
    state: spec.tenant.state,
    phone: spec.tenant.ownerPhone,
    email: spec.tenant.ownerEmail,
  });
  const settings: TenantSettings = {
    ...base,
    general: { ...base.general, ...spec.general, name: spec.tenant.name },
    hours: {
      ...spec.hours,
      holidays: [
        { id: id("hol"), date: `${today.slice(0, 4)}-01-26`, label: "Republic Day" },
        { id: id("hol"), date: `${today.slice(0, 4)}-08-15`, label: "Independence Day" },
        { id: id("hol"), date: addDays(today, 24), label: "Annual maintenance day" },
      ],
    },
    layout: spec.layout,
    pricing: {
      ...base.pricing,
      ...spec.pricing,
      charges: [
        { id: id("chg"), name: "Locker rent", amount: 200, frequency: "monthly", isActive: spec.facilities.includes("locker") },
        { id: id("chg"), name: "ID card / admission kit", amount: 100, frequency: "one-time", isActive: true },
      ],
    },
    facilities: FACILITY_CATALOG.map((f) => ({ ...f, enabled: spec.facilities.includes(f.key) })),
    rules: { ...base.rules, ...spec.rules },
  };

  /* plans */
  const plans: MembershipPlan[] = spec.plans.map((p) => ({
    id: id("plan"),
    name: p.name,
    durationMonths: p.months,
    price: p.price,
    description: p.description,
    isActive: p.active ?? true,
    isFeatured: p.featured,
    createdAt,
  }));
  const activePlans = plans.filter((p) => p.isActive);
  const planWeights: [MembershipPlan, number][] = activePlans.map((p) => [
    p,
    p.durationMonths === 1 ? 45 : p.durationMonths === 3 ? 30 : p.durationMonths === 6 ? 15 : 10,
  ]);
  const randomPlan = (maxMonths = 12) =>
    weighted(r, planWeights.filter(([p]) => p.durationMonths <= maxMonths).length
      ? planWeights.filter(([p]) => p.durationMonths <= maxMonths)
      : planWeights);

  /* seats */
  let seatSeq = 0;
  const seats: Seat[] = generateSeats([], spec.seats, spec.layout, 1, () => `seat_${spec.short}_${++seatSeq}`, createdAt);
  seats.forEach((s, i) => {
    const col = i % spec.layout.columns;
    if ((col === 0 || col === spec.layout.columns - 1) && r() < 0.6) s.tags.push("Window");
    if (r() < 0.3) s.tags.push("Charging point");
    if (r() < 0.08) s.tags.push("Locker below");
  });
  const seatEvents: SeatEvent[] = seats.map((s) => ({
    id: id("evt"),
    seatId: s.id,
    type: "created",
    at: createdAt,
  }));

  // Seats under maintenance are chosen from the back rows and kept free.
  const maintenanceIds = new Set<string>();
  spec.maintenance.forEach((m, i) => {
    const seat = seats[seats.length - 3 - i * 7]!;
    seat.isUnderMaintenance = true;
    seat.maintenanceNote = m.note;
    maintenanceIds.add(seat.id);
    seatEvents.push({ id: id("evt"), seatId: seat.id, type: "maintenance_on", at: `${addDays(today, -int(r, 1, 6))}T08:30:00.000Z`, note: m.note });
  });

  const timeline = new Map<string, [ISODate, ISODate][]>();
  const seatFree = (seatId: string, s: ISODate, e: ISODate) =>
    !(timeline.get(seatId) ?? []).some(([a, b]) => rangesOverlap(a, b, s, e));
  const pickSeat = (s: ISODate, e: ISODate, allowMaintenance = false): Seat => {
    const candidates = seats.filter(
      (seat) => (allowMaintenance || !maintenanceIds.has(seat.id)) && seatFree(seat.id, s, e),
    );
    if (!candidates.length) throw new Error(`Seed: no free seat for ${spec.id} ${s}..${e}`);
    return pick(r, candidates);
  };

  /* students */
  const students: Student[] = [];
  const memberships: Membership[] = [];
  const payments: Payment[] = [];
  const usedNames = new Set<string>();
  const localities = LOCALITIES[spec.tenant.city] ?? ["Main Road"];

  const newStudent = (joinedOn: ISODate): Student => {
    let name = "";
    let gender: Gender = "female";
    do {
      gender = r() < 0.48 ? "female" : "male";
      name = `${pick(r, gender === "female" ? FEMALE_NAMES : MALE_NAMES)} ${pick(r, SURNAMES)}`;
    } while (usedNames.has(name));
    usedNames.add(name);
    const [first, last] = name.toLowerCase().split(" ");
    const phone = `${pick(r, ["98", "97", "96", "94", "93", "88", "87", "79", "70", "63"])}${int(r, 10000000, 99999999)}`;
    const s: Student = {
      id: id("stu"),
      code: "",
      name,
      phone,
      email: `${first}.${last}${int(r, 1, 99)}@${pick(r, ["gmail.com", "gmail.com", "gmail.com", "yahoo.in", "outlook.com"])}`,
      gender,
      dateOfBirth: addDays(today, -int(r, 18 * 365, 27 * 365)),
      address: `${int(r, 1, 220)}, ${pick(r, localities)}, ${spec.tenant.city}`,
      guardianName: `${pick(r, MALE_NAMES)} ${last![0]!.toUpperCase()}${last!.slice(1)}`,
      guardianPhone: `9${int(r, 100000000, 999999999)}`,
      preparingFor: pick(r, EXAM_TRACKS),
      joinedOn,
      status: "active",
      notes: r() < 0.25 ? [{ id: id("note"), text: pick(r, STUDENT_NOTES), at: `${joinedOn}T11:00:00.000Z` }] : [],
    };
    students.push(s);
    return s;
  };

  const addMembership = (
    student: Student,
    seat: Seat,
    plan: MembershipPlan,
    start: ISODate,
    opts: { end?: ISODate; renewalOf?: string; bookedOn?: ISODate; cancelled?: string; source?: "admin" | "student" } = {},
  ): Membership => {
    const end = opts.end ?? membershipEndDate(start, plan.durationMonths);
    const discount = plan.durationMonths >= 3 && r() < 0.15 ? pick(r, [100, 200, 300]) : 0;
    const bookedOn = opts.bookedOn ?? start;
    const m: Membership = {
      id: id("mem"),
      code: "",
      studentId: student.id,
      seatId: seat.id,
      planId: plan.id,
      planName: plan.name,
      durationMonths: plan.durationMonths,
      startDate: start,
      endDate: end,
      listPrice: plan.price,
      discount,
      totalAmount: plan.price - discount,
      source: opts.source ?? "admin",
      renewalOf: opts.renewalOf,
      createdAt: `${bookedOn}T${pad(int(r, 9, 19), 2)}:${pad(int(r, 0, 59), 2)}:00.000Z`,
      ...(opts.cancelled ? { cancelledAt: `${bookedOn}T12:00:00.000Z`, cancelReason: opts.cancelled } : {}),
    };
    memberships.push(m);
    if (!opts.cancelled) {
      const list = timeline.get(seat.id) ?? [];
      list.push([start, end]);
      timeline.set(seat.id, list);
    }
    seatEvents.push({
      id: id("evt"),
      seatId: seat.id,
      type: opts.renewalOf ? "renewed" : "assigned",
      at: m.createdAt,
      studentId: student.id,
      membershipId: m.id,
    });
    if (opts.cancelled) {
      seatEvents.push({ id: id("evt"), seatId: seat.id, type: "released", at: m.cancelledAt!, studentId: student.id, membershipId: m.id, note: opts.cancelled });
    }
    return m;
  };

  const clampToday = (d: ISODate) => (d > today ? today : d);
  const pay = (m: Membership, mode: "full" | "partial" | "unpaid", paidOnBase?: ISODate) => {
    if (mode === "unpaid") return;
    const firstDate = clampToday(paidOnBase ?? addDays(m.startDate, int(r, 0, 3)));
    const make = (amount: number, date: ISODate) => {
      const method = weighted(r, METHOD_WEIGHTS);
      payments.push({
        id: id("pay"),
        receiptNo: "",
        studentId: m.studentId,
        membershipId: m.id,
        amount,
        method,
        status: "completed",
        paidOn: date,
        reference: referenceFor(r, method),
        createdAt: `${date}T${pad(int(r, 8, 20), 2)}:${pad(int(r, 0, 59), 2)}:00.000Z`,
      });
    };
    if (mode === "partial") {
      make(Math.max(100, roundTo(m.totalAmount * (0.35 + r() * 0.3), 100)), firstDate);
      return;
    }
    const second = addDays(firstDate, int(r, 12, 25));
    if (m.totalAmount >= 8000 && r() < 0.45 && second <= today) {
      const first = roundTo(m.totalAmount * 0.6, 100);
      make(first, firstDate);
      make(m.totalAmount - first, second);
    } else {
      make(m.totalAmount, firstDate);
    }
  };

  /** Add back-to-back history memberships before `start`. */
  const addHistory = (student: Student, seat: Seat, start: ISODate, max: number, after: Membership): ISODate => {
    let cursor = start;
    let next = after;
    const n = r() < 0.55 ? int(r, 1, max) : 0;
    for (let i = 0; i < n; i++) {
      const plan = randomPlan(6);
      const prevStart = addMonths(cursor, -plan.durationMonths);
      if (prevStart < createdOn) break;
      const prevEnd = addDays(cursor, -1);
      const useSeat = seatFree(seat.id, prevStart, prevEnd) ? seat : pickSeat(prevStart, prevEnd, true);
      const m = addMembership(student, useSeat, plan, prevStart, { end: prevEnd });
      pay(m, "full");
      // Link the chain: the later membership is a renewal of this one.
      next.renewalOf = m.id;
      const evt = seatEvents.find((e) => e.membershipId === next.id && e.type === "assigned");
      if (evt && next.seatId === m.seatId) evt.type = "renewed";
      next = m;
      cursor = prevStart;
    }
    return cursor;
  };

  const { mix } = spec;

  // 1. Current members
  for (let i = 0; i < mix.current; i++) {
    let range: [number, number] | null = null;
    if (i < mix.expiring) range = [0, settings.rules.expiringSoonDays - 1];
    else if (i < mix.expiring + mix.soon15) range = [settings.rules.expiringSoonDays + 1, 15];
    else if (i < mix.expiring + mix.soon15 + mix.soon30) range = [16, 30];
    const plan = randomPlan();
    const planDays = daysBetween(today, addMonths(today, plan.durationMonths)) - 1;
    const remaining = range
      ? int(r, range[0], Math.min(range[1], planDays))
      : int(r, Math.min(planDays < 31 ? 16 : 31, planDays), planDays);
    const end = addDays(today, remaining);
    let start = addMonths(addDays(end, 1), -plan.durationMonths);
    if (start > today) start = today;
    if (start < createdOn) start = createdOn;
    const seat = pickSeat(start, end);
    const student = newStudent(start);
    const m = addMembership(student, seat, plan, start, { end });
    const startedDaysAgo = daysBetween(start, today);
    const mode = weighted<"full" | "partial" | "unpaid">(r, [
      ["full", 70],
      ["partial", 18],
      ["unpaid", startedDaysAgo <= 20 ? 12 : 0],
    ]);
    pay(m, mode);
    student.joinedOn = addHistory(student, seat, start, 3, m);

    if (i < mix.renewedAhead) {
      const rp = randomPlan(3);
      const rStart = addDays(end, 1);
      if (seatFree(seat.id, rStart, membershipEndDate(rStart, rp.durationMonths))) {
        const bookedOn = addDays(today, -int(r, 0, 3));
        const renewal = addMembership(student, seat, rp, rStart, { renewalOf: m.id, bookedOn });
        pay(renewal, r() < 0.6 ? "full" : "partial", bookedOn);
      }
    }
  }

  // 2. Upcoming (new students who booked ahead)
  for (let i = 0; i < mix.upcoming; i++) {
    const plan = randomPlan(3);
    const start = addDays(today, int(r, 1, 9));
    const end = membershipEndDate(start, plan.durationMonths);
    const seat = pickSeat(start, end);
    const bookedOn = addDays(today, -int(r, 0, 4));
    const student = newStudent(bookedOn);
    const m = addMembership(student, seat, plan, start, { bookedOn, source: r() < 0.5 ? "student" : "admin" });
    pay(m, weighted(r, [["full", 50], ["partial", 30], ["unpaid", 20]]), bookedOn);
  }

  // 3. Expired, not renewed
  for (let i = 0; i < mix.expired; i++) {
    const plan = randomPlan(3);
    const end = addDays(today, -int(r, 1, 40));
    const start = addMonths(addDays(end, 1), -plan.durationMonths);
    const seat = pickSeat(start, end, true);
    const student = newStudent(start);
    const m = addMembership(student, seat, plan, start, { end });
    pay(m, i < mix.overdueExpired ? "partial" : "full");
    student.joinedOn = addHistory(student, seat, start, 2, m);
  }

  // 4. Inactive former members
  for (let i = 0; i < mix.inactive; i++) {
    const plan = randomPlan(3);
    const end = addDays(today, -int(r, 60, 110));
    const start = addMonths(addDays(end, 1), -plan.durationMonths);
    if (start < createdOn) continue;
    const seat = pickSeat(start, end, true);
    const student = newStudent(start);
    student.status = "inactive";
    student.inactiveReason = pick(r, ["Exam cleared — moved for training", "Relocated to another city", "Joined a coaching hostel"]);
    pay(addMembership(student, seat, plan, start, { end }), "full");
  }

  // 5. Cancelled bookings
  for (let i = 0; i < mix.cancelled; i++) {
    const plan = randomPlan(1);
    const start = addDays(today, int(r, 3, 8));
    const seat = pickSeat(start, membershipEndDate(start, plan.durationMonths));
    const bookedOn = addDays(today, -int(r, 2, 6));
    const student = newStudent(bookedOn);
    addMembership(student, seat, plan, start, { bookedOn, cancelled: "Student changed plans before start date", source: "student" });
  }

  // 6. Newly registered, no membership yet
  const fresh: Student[] = [];
  for (let i = 0; i < mix.fresh; i++) fresh.push(newStudent(addDays(today, -int(r, 0, 4))));

  /* Pending / failed payment records for realism */
  const recentUpi = payments.filter((p) => p.method === "upi" && daysBetween(p.paidOn, today) <= 10);
  recentUpi.slice(0, 2).forEach((p) => {
    p.status = "pending";
    p.note = "Awaiting UPI settlement confirmation";
  });
  const recentAny = payments.filter((p) => p.status === "completed" && daysBetween(p.paidOn, today) <= 20);
  if (recentAny[0]) {
    const p = recentAny[0];
    payments.push({
      ...p,
      id: id("pay"),
      method: "upi",
      status: "failed",
      reference: referenceFor(r, "upi"),
      note: "UPI transaction declined by bank; student paid again.",
      createdAt: `${p.paidOn}T07:45:00.000Z`,
    });
  }

  /* Booking requests (approval-mode tenants) */
  const bookingRequests: BookingRequest[] = [];
  if (settings.rules.bookingMode === "approval") {
    fresh.slice(0, 2).forEach((s, i) => {
      const plan = activePlans[i % activePlans.length]!;
      const start = addDays(today, 2 + i);
      const seat = pickSeat(start, membershipEndDate(start, plan.durationMonths));
      bookingRequests.push({
        id: id("req"),
        studentId: s.id,
        seatId: seat.id,
        planId: plan.id,
        startDate: start,
        status: "pending",
        createdAt: `${s.joinedOn}T16:20:00.000Z`,
      });
    });
  }

  /* Human-readable codes, assigned chronologically */
  [...students].sort((a, b) => (a.joinedOn < b.joinedOn ? -1 : 1)).forEach((s, i) => (s.code = `STU-${pad(i + 1, 3)}`));
  [...memberships].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)).forEach((m, i) => (m.code = `M-${pad(i + 1)}`));
  [...payments].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)).forEach((p, i) => (p.receiptNo = `${spec.receiptPrefix}-${pad(i + 1, 5)}`));

  const tenant: Tenant = {
    id: spec.id,
    slug: spec.tenant.slug,
    name: spec.tenant.name,
    ownerName: spec.tenant.ownerName,
    ownerEmail: spec.tenant.ownerEmail,
    ownerPhone: spec.tenant.ownerPhone,
    city: spec.tenant.city,
    state: spec.tenant.state,
    status: spec.tenant.status,
    statusReason: spec.tenant.statusReason,
    subscription: {
      tierKey: spec.tenant.tierKey,
      status: spec.tenant.subscriptionStatus,
      startedOn: createdOn,
      renewsOn: addMonths(createdOn, spec.createdMonthsAgo + 1),
    },
    createdAt,
  };

  return {
    tenant,
    data: {
      settings,
      seats,
      seatEvents,
      students,
      plans,
      memberships,
      payments,
      bookingRequests,
      counters: {
        seat: seats.length + 1,
        student: students.length + 1,
        membership: memberships.length + 1,
        receipt: payments.length + 1,
      },
    },
  };
}

export interface SeedResult {
  platform: PlatformData;
  tenants: Record<string, TenantData>;
}

export function buildSeed(): SeedResult {
  const tenants: Record<string, TenantData> = {};
  const list: Tenant[] = [];
  for (const spec of SPECS) {
    const today = todayIn("Asia/Kolkata");
    const { tenant, data } = buildTenant(spec, today);
    tenants[tenant.id] = data;
    list.push(tenant);
  }
  return {
    platform: { tenants: list, settings: structuredClone(DEFAULT_PLATFORM_SETTINGS) },
    tenants,
  };
}
