"use client";

import { useRef, useState } from "react";
import { CalendarClock, Check, DoorOpen, Hourglass, User, Wrench, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/date";
import { rowLabel } from "@/lib/domain/seats";
import { initials } from "@/lib/format";
import type { SeatState, SeatView, TenantSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATE_TILE: Record<SeatState, string> = {
  available: "bg-card border-success/45 text-foreground hover:border-success hover:bg-success-soft/60",
  occupied: "bg-primary border-primary text-primary-foreground hover:bg-primary/90",
  reserved: "bg-warning-soft border-warning/60 text-[oklch(0.45_0.1_65)] hover:border-warning",
  maintenance: "seat-hatch bg-muted border-border text-muted-foreground hover:border-foreground/30",
};

/** Current member's term ends soon and no renewal is booked on this seat. */
export function needsRenewal(seat: SeatView) {
  return seat.current?.status === "expiring" && seat.upcoming?.studentId !== seat.current.studentId;
}

const STATE_ICON = { available: Check, occupied: User, reserved: CalendarClock, maintenance: Wrench } as const;

export interface SeatMapProps {
  seats: SeatView[];
  layout: TenantSettings["layout"];
  selectedId?: string | null;
  onSelect?: (seat: SeatView) => void;
  /** Override displayed state, e.g. availability for a future date range. */
  stateOf?: (seat: SeatView) => SeatState;
  /** When provided, seats returning false are rendered non-interactive. */
  isSelectable?: (seat: SeatView) => boolean;
  /** Dim seats that don't match an active filter. */
  isDimmed?: (seat: SeatView) => boolean;
  /** Show member initials on occupied seats (admin only). */
  showOccupant?: boolean;
  density?: "comfortable" | "compact";
  ariaLabel?: string;
}

export function SeatMap({
  seats,
  layout,
  selectedId,
  onSelect,
  stateOf = (s) => s.state,
  isSelectable,
  isDimmed,
  showOccupant = false,
  density = "comfortable",
  ariaLabel = "Seat layout",
}: SeatMapProps) {
  const cols = Math.max(1, layout.columns);
  const rows: SeatView[][] = [];
  for (let i = 0; i < seats.length; i += cols) rows.push(seats.slice(i, i + cols));

  const [focusIndex, setFocusIndex] = useState(() => Math.max(0, seats.findIndex((s) => s.id === selectedId)));
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.min(focusIndex, Math.max(0, seats.length - 1));

  const move = (to: number) => {
    const next = Math.max(0, Math.min(seats.length - 1, to));
    setFocusIndex(next);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const map: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      ArrowDown: index + cols,
      ArrowUp: index - cols,
      Home: index - (index % cols),
      End: Math.min(seats.length - 1, index - (index % cols) + cols - 1),
    };
    if (e.key in map) {
      e.preventDefault();
      move(map[e.key]!);
    }
  };

  const tile = density === "compact" ? "size-10 text-[10px]" : "size-11 sm:size-[3.25rem] text-[11px]";
  const aisle = layout.aisleEvery > 0 ? layout.aisleEvery : 0;
  const labelFor = (r: number) => (layout.numbering === "row-letter" ? rowLabel(r) : String(r + 1));

  return (
    <div className="overflow-x-auto overscroll-x-contain rounded-xl border bg-[oklch(0.975_0.003_247)] p-4 sm:p-6">
      <div className="mx-auto w-max">
        {/* Room front */}
        <div className="mb-5 flex items-center gap-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          <span className="flex items-center gap-1.5 rounded-md border border-dashed bg-card px-2.5 py-1">
            <DoorOpen className="size-3.5" aria-hidden /> Entrance
          </span>
          <span className="h-px flex-1 bg-border" />
          <span className="rounded-md border border-dashed bg-card px-2.5 py-1">Front desk</span>
        </div>

        <div role="grid" aria-label={ariaLabel} aria-rowcount={rows.length} aria-colcount={cols} className="flex flex-col gap-2">
          {rows.map((row, r) => (
            <div role="row" key={r} className="flex items-center gap-2">
              <span aria-hidden className="w-5 shrink-0 text-right text-[11px] font-medium text-muted-foreground tabular">
                {labelFor(r)}
              </span>
              {row.map((seat, c) => {
                const index = r * cols + c;
                const state = stateOf(seat);
                const selectable = isSelectable ? isSelectable(seat) : Boolean(onSelect);
                const Icon = STATE_ICON[state];
                const member = seat.current ?? seat.upcoming;
                const expiring = needsRenewal(seat);
                const selected = seat.id === selectedId;
                const dim = isDimmed?.(seat) ?? false;
                const label = [
                  `Seat ${seat.code}`,
                  state === "available" ? "available" : state,
                  showOccupant && member ? `${member.studentName}, until ${formatDate(member.endDate)}` : null,
                  expiring ? "membership expiring soon" : null,
                  seat.hasConflict ? "needs attention: member on a disabled seat" : null,
                  !selectable && isSelectable ? "not selectable" : null,
                  selected ? "selected" : null,
                ]
                  .filter(Boolean)
                  .join(", ");

                return (
                  <div role="gridcell" key={seat.id} className={cn(aisle && c > 0 && c % aisle === 0 && "ml-4 sm:ml-6")}>
                    <button
                      ref={(el) => {
                        refs.current[index] = el;
                      }}
                      type="button"
                      tabIndex={index === activeIndex ? 0 : -1}
                      aria-label={label}
                      aria-pressed={onSelect ? selected : undefined}
                      aria-disabled={!selectable || undefined}
                      onFocus={() => setFocusIndex(index)}
                      onKeyDown={(e) => onKeyDown(e, index)}
                      onClick={() => selectable && onSelect?.(seat)}
                      className={cn(
                        "relative flex flex-col items-center justify-center gap-0.5 rounded-lg border-[1.5px] font-semibold tabular transition-all outline-none",
                        "focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:ring-offset-1",
                        tile,
                        STATE_TILE[state],
                        !selectable && "cursor-not-allowed opacity-45 hover:bg-inherit",
                        dim && "opacity-25",
                        selected && "ring-3 ring-brand ring-offset-2",
                        seat.hasConflict && "border-destructive",
                      )}
                    >
                      <span className="leading-none">{seat.code}</span>
                      {showOccupant && member && state !== "available" ? (
                        <span className="text-[9px] leading-none font-medium opacity-80">{initials(member.studentName)}</span>
                      ) : (
                        <Icon className="size-3 opacity-70" aria-hidden />
                      )}
                      {expiring && (
                        <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-warning text-white ring-2 ring-[oklch(0.975_0.003_247)]">
                          <Hourglass className="size-2" aria-hidden />
                        </span>
                      )}
                      {seat.hasConflict && (
                        <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-destructive text-white">
                          <AlertTriangle className="size-2" aria-hidden />
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SeatLegend({
  counts,
  showExpiring = true,
  className,
}: {
  counts?: Partial<Record<SeatState, number>>;
  showExpiring?: boolean;
  className?: string;
}) {
  const items: { state: SeatState; label: string }[] = [
    { state: "available", label: "Available" },
    { state: "occupied", label: "Occupied" },
    { state: "reserved", label: "Reserved" },
    { state: "maintenance", label: "Maintenance" },
  ];
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground", className)} aria-label="Seat status legend">
      {items.map(({ state, label }) => {
        const Icon = STATE_ICON[state];
        return (
          <li key={state} className="flex items-center gap-1.5">
            <span className={cn("flex size-5 items-center justify-center rounded border-[1.5px]", STATE_TILE[state])}>
              <Icon className="size-3" aria-hidden />
            </span>
            {label}
            {counts?.[state] !== undefined && <span className="font-medium text-foreground tabular">{counts[state]}</span>}
          </li>
        );
      })}
      {showExpiring && (
        <li className="flex items-center gap-1.5">
          <span className="flex size-3.5 items-center justify-center rounded-full bg-warning text-white">
            <Hourglass className="size-2" aria-hidden />
          </span>
          Expiring soon
        </li>
      )}
    </ul>
  );
}
