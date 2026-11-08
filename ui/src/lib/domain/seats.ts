import type { Seat, TenantSettings } from "../types";

export function rowLabel(index: number): string {
  // 0 -> A, 25 -> Z, 26 -> AA
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

/** Code for the seat that will occupy `position` (0-based) in the layout. */
export function seatCodeFor(
  position: number,
  number: number,
  layout: TenantSettings["layout"],
): string {
  if (layout.numbering === "row-letter") {
    const cols = Math.max(1, layout.columns);
    const row = Math.floor(position / cols);
    const col = (position % cols) + 1;
    return `${rowLabel(row)}-${String(col).padStart(2, "0")}`;
  }
  return `${layout.prefix}${String(number).padStart(2, "0")}`;
}

/**
 * Generate `count` new seats appended after the existing ones. Codes are
 * de-duplicated against every seat ever created (including removed ones) so a
 * code always refers to exactly one seat in history.
 */
export function generateSeats(
  existing: Seat[],
  count: number,
  layout: TenantSettings["layout"],
  startNumber: number,
  makeId: () => string,
  now: string,
): Seat[] {
  const taken = new Set(existing.map((s) => s.code));
  const activeCount = existing.filter((s) => !s.removedAt).length;
  const seats: Seat[] = [];
  for (let i = 0; i < count; i++) {
    const number = startNumber + i;
    let code = seatCodeFor(activeCount + i, number, layout);
    if (taken.has(code)) code = `${layout.prefix || "S-"}${String(number).padStart(2, "0")}`;
    let suffix = 2;
    const base = code;
    while (taken.has(code)) code = `${base}-${suffix++}`;
    taken.add(code);
    seats.push({
      id: makeId(),
      number,
      code,
      tags: [],
      isUnderMaintenance: false,
      createdAt: now,
    });
  }
  return seats;
}
