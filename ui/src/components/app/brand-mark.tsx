/* eslint-disable @next/next/no-img-element */
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Tenant logo, or initials on the tenant brand colour. */
export function BrandMark({
  name,
  logo,
  color,
  size = "md",
  className,
}: {
  name: string;
  logo?: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = { sm: "size-7 text-[10px]", md: "size-8 text-xs", lg: "size-12 text-base" }[size];
  if (logo) {
    return <img src={logo} alt={`${name} logo`} className={cn(dims, "shrink-0 rounded-md border object-cover", className)} />;
  }
  return (
    <span
      aria-hidden
      className={cn(dims, "flex shrink-0 items-center justify-center rounded-md font-semibold text-white", !color && "bg-brand", className)}
      style={color ? { backgroundColor: color } : undefined}
    >
      {initials(name)}
    </span>
  );
}

export function PersonAvatar({ name, className }: { name: string; className?: string }) {
  // Deterministic, calm hue per person.
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hues = [195, 220, 250, 160, 30, 330, 280];
  const hue = hues[hash % hues.length];
  return (
    <span
      aria-hidden
      className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", className)}
      style={{ backgroundColor: `oklch(0.94 0.03 ${hue})`, color: `oklch(0.4 0.08 ${hue})` }}
    >
      {initials(name)}
    </span>
  );
}
