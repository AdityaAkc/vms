import { useId } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Form field wrapper: label, control, hint and error message with proper
 * aria wiring. The child receives `id`, `aria-invalid` and
 * `aria-describedby` via the render prop.
 */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const id = useId();
  const descId = `${id}-desc`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-foreground/80">
        {label}
        {required && <span className="text-destructive" aria-hidden>*</span>}
      </Label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || hint ? descId : undefined,
      })}
      {error ? (
        <p id={descId} className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p id={descId} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}>{children}</div>;
}
