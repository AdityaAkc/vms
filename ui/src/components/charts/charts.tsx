"use client";

/**
 * Chart components. Categorical palette validated with the dataviz
 * validator (lightness, chroma, CVD separation, contrast all pass on the
 * light surface). Assign in fixed order; never cycle.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { formatMonthKey } from "@/lib/date";
import { formatCurrency, formatCurrencyCompact, formatPercent } from "@/lib/format";

export const SERIES = ["#3f5d9e", "#0d9488", "#c07a1a", "#a14d8f"] as const;
const GRID = "oklch(0.92 0.006 247)";
const AXIS = { fontSize: 11, fill: "oklch(0.52 0.02 257)" };

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-md border bg-popover px-2.5 py-2 text-xs shadow-sm">
      <div className="mb-1 font-medium">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-muted-foreground">
          {r.color && <span className="size-2 rounded-sm" style={{ background: r.color }} aria-hidden />}
          <span>{r.label}</span>
          <span className="ml-auto pl-3 font-medium text-foreground tabular">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function RevenueChart({ data, height = 220 }: { data: { month: string; revenue: number }[]; height?: number }) {
  const current = data[data.length - 1]?.month;
  return (
    <figure>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="month" tickFormatter={(k) => formatMonthKey(k)} tickLine={false} axisLine={false} tick={AXIS} />
          <YAxis tickFormatter={(v) => formatCurrencyCompact(v)} tickLine={false} axisLine={false} tick={AXIS} width={56} />
          <Tooltip
            cursor={{ fill: "oklch(0.95 0.005 247)" }}
            content={({ active, payload, label }: TooltipContentProps<ValueType, NameType>) =>
              active && payload?.length ? (
                <TooltipBox
                  title={formatMonthKey(String(label), "MMMM yyyy")}
                  rows={[{ label: "Collected", value: formatCurrency(Number(payload[0]!.value)), color: SERIES[0] }]}
                />
              ) : null
            }
          />
          <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.month} fill={SERIES[0]} fillOpacity={d.month === current ? 1 : 0.55} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <figcaption className="sr-only">
        Monthly collections: {data.map((d) => `${formatMonthKey(d.month, "MMMM")} ${formatCurrency(d.revenue)}`).join(", ")}
      </figcaption>
    </figure>
  );
}

export function OccupancyTrendChart({ data, height = 220 }: { data: { month: string; rate: number; occupied: number }[]; height?: number }) {
  return (
    <figure>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="month" tickFormatter={(k) => formatMonthKey(k)} tickLine={false} axisLine={false} tick={AXIS} />
          <YAxis domain={[0, 1]} tickFormatter={(v) => formatPercent(v)} tickLine={false} axisLine={false} tick={AXIS} width={44} />
          <Tooltip
            cursor={{ stroke: "oklch(0.8 0.01 247)" }}
            content={({ active, payload, label }: TooltipContentProps<ValueType, NameType>) =>
              active && payload?.length ? (
                <TooltipBox
                  title={formatMonthKey(String(label), "MMMM yyyy")}
                  rows={[
                    { label: "Occupancy", value: formatPercent(Number(payload[0]!.value)), color: SERIES[1] },
                    { label: "Seats held", value: String((payload[0]!.payload as { occupied: number }).occupied) },
                  ]}
                />
              ) : null
            }
          />
          <Line isAnimationActive={false} type="monotone" dataKey="rate" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 4, fill: SERIES[1], strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
      <figcaption className="sr-only">
        Occupancy by month: {data.map((d) => `${formatMonthKey(d.month, "MMMM")} ${formatPercent(d.rate)}`).join(", ")}
      </figcaption>
    </figure>
  );
}

/** Horizontal labelled bars; identity comes from the row label, not colour. */
export function LabeledBars({
  data,
  format = (v) => String(v),
  colorByIndex = false,
}: {
  data: { label: string; value: number; hint?: string }[];
  format?: (v: number) => string;
  colorByIndex?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-3">
      {data.map((d, i) => (
        <li key={d.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {colorByIndex && <span className="size-2 rounded-sm" style={{ background: SERIES[i % SERIES.length] }} aria-hidden />}
              {d.label}
            </span>
            <span className="font-medium text-foreground tabular">
              {format(d.value)}
              {d.hint && <span className="ml-1 font-normal text-muted-foreground">{d.hint}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className="h-full rounded-full"
              style={{ width: `${(d.value / max) * 100}%`, background: colorByIndex ? SERIES[i % SERIES.length] : SERIES[0] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
