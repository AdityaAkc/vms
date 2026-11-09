# Reading Room Management — Frontend

Multi-tenant SaaS frontend for reading-room (study seat) businesses. It has three role-separated areas: the platform super admin, the reading room owner, and students.

> **Demo mode.** All data is generated in the browser and saved to `localStorage`. No backend, payment gateway or real authentication is connected yet.

## Run it

```bash
cd ui
npm install
npm run dev          # http://localhost:3000
# production
npm run build && npm start
```

Open `/login` and pick a role. You can switch roles at any time with the **Demo** button (flask icon). Use **Demo → Reset demo data** to restore the original sample data.

| Demo persona | How to reach it |
| --- | --- |
| Platform super admin | Login → *Platform admin* |
| Owner, Sunrise Reading Room (50 seats, instant booking) | Login → *Reading room owner* → Sunrise |
| Owner, Scholar Study Hub (100 seats, approval booking) | Login → *Reading room owner* → Scholar |
| Suspended / inactive business | Owner of Pathshala / Ekagra (shows the blocked state) |
| Student | Login → *Student* → pick anyone. Students marked “No membership” can book a seat |

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Radix), Zustand (persisted store), TanStack Table v8, Recharts, react-hook-form + zod, date-fns, lucide-react.

## Routes

| Platform | Owner | Student |
| --- | --- | --- |
| `/platform/dashboard` | `/admin/dashboard` | `/student/dashboard` |
| `/platform/businesses` | `/admin/seats` (`?seat=<id>` opens a seat) | `/student/book-seat` |
| `/platform/businesses/[id]` | `/admin/students`, `/admin/students/[id]` | `/student/membership` |
| `/platform/settings` | `/admin/memberships` (`?tab=requests`), `/admin/memberships/expiring` | `/student/payments` |
| | `/admin/plans`, `/admin/payments` (`?tab=dues`), `/admin/reports` | `/student/profile` |
| | `/admin/settings?section=general\|hours\|seats\|pricing\|facilities\|rules` | |

## Architecture

```
src/
  config/app.ts            product-wide config (name, facility catalogue, defaults) — no tenant data
  lib/
    types.ts               domain model (Tenant, TenantData, Seat, Membership, Payment …)
    domain/                pure logic: status derivation, availability, metrics, seat numbering
    mock/                  deterministic seed generator (5 tenants)
    store/db.ts            Zustand store: { platform, tenants: Record<tenantId, TenantData> }
    store/session.ts       demo session (role / tenantId / studentId)
    services/              seatService, studentService, membershipService, paymentService,
                           planService, bookingService, settingsService, tenantService, authService
    hooks/use-tenant.tsx   TenantProvider — the only way screens learn which business they render
  components/              app shell, seat map, dialogs, charts, shared UI
  app/                     routes (platform / admin / student / login)
```

**Key design decisions**

- **Statuses are derived, never stored.** Membership status (upcoming / active / expiring / expired / cancelled), seat state (available / occupied / reserved / maintenance), amount paid, balance and payment status are all computed from dates and payment records in `lib/domain/derive.ts`. An expired membership can't show as active, and a seat can't show as free while it is booked.
- **Tenant isolation.** Every operational record lives in `tenants[tenantId]`, and every service call takes `tenantId` explicitly. UI components read tenant context from `useTenant()` and never branch on a specific business. A new business needs only data (`tenantService.create`), not code.
- **Snapshots.** A membership copies its plan name, duration and price when it is sold, so editing a plan never changes existing memberships.
- **Soft deletes.** Removed seats keep `removedAt` and their history, and can be restored.
- **Renewals** are new membership records linked through `renewalOf`. They start the day after the current one ends, which keeps receipts and history intact.

## Business rules enforced in the mock services

| Rule | Where |
| --- | --- |
| No overlapping memberships on a seat, or for a student | `membershipService.applyCreateMembership`, `changeSeat` |
| Occupied / reserved seats can't be removed; capacity reduction never deletes bookings | `seatService.removeSeats`, `seatRemovalBlocker` |
| Disabling an occupied seat requires acknowledgement; the booking is kept and flagged | `seatService.setMaintenance` |
| Maintenance seats can't be booked | `applyCreateMembership`, `bookingService.book` |
| Payments can't exceed the outstanding balance; UPI/bank payments need a reference | `paymentService.buildPayment` |
| Student booking limits: min duration, advance window, renewal window | `applyCreateMembership`, `membershipService.renew` |
| A student can't be made inactive while holding a seat unless the booking is cancelled | `studentService.deactivate` |
| Seat change updates both seats' history and moves upcoming renewals too | `membershipService.changeSeat` |

**These checks must also be enforced on the server.** Frontend validation runs against a local snapshot only. The API must reject double bookings transactionally (for example with a seat + date-range exclusion constraint or row locking), validate payment totals, and authorise every request by tenant and role. Route guards in `RoleGate` exist for the demo only and are not a security boundary.

## Backend integration points

The Spring Boot backend currently exposes only `POST /api/auth/register` and `POST /api/auth/login` for owners. Responses use `ApiResponse<T> { success, message, data, timestamp }`, and that type is mirrored in `services/authService.ts`.

To connect the real API:

1. **Auth.** Replace `authService.signInDemo` with a call to `/api/auth/login`. The login response needs to return a token plus the owner's `tenantId` and `role`. Student and platform-admin login don't exist yet.
2. **Services.** Each service method maps to a tenant-scoped endpoint. Swap the body of each method from store mutation to `fetch`, for example:
   - `seatService.*` → `/api/tenants/{tenantId}/seats`
   - `studentService.*` → `/api/tenants/{tenantId}/students`
   - `membershipService.*` → `/api/tenants/{tenantId}/memberships` (`/renew`, `/cancel`, `/change-seat`)
   - `paymentService.*` → `/api/tenants/{tenantId}/payments`
   - `planService.*`, `settingsService.*`, `bookingService.*` → equivalent tenant-scoped routes
   - `tenantService.*` → `/api/platform/tenants`

   These paths are suggestions; none of them exist in the backend yet.
3. **Reads.** Screens read from `useTenant()`, which derives views from the store. Replace its data source with a query layer (e.g. TanStack Query) that fills the same `TenantData` shape, or move the derivation to the server.
4. **Server-side derivations.** Membership status, balances and metrics should eventually be computed by the API, for consistency across clients.

## Known limitations

- Demo data lives in one browser's `localStorage`. It isn't shared between devices and is cleared with site data.
- No online payments; receipts are clearly marked as demo records.
- Extra charges (locker rent, admission fee) are configurable but not automatically added to membership totals.
- Student self-service seat changes show the policy only; seat changes are done by the owner.
- Light theme only.
- Platform subscription billing is informational; nothing is charged.
