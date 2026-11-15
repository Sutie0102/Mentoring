import { cn } from "@/lib/utils";

export function Progress({ value, className, barClassName, label }: { value: number; className?: string; barClassName?: string; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-700", barClassName)} style={{ width: `${v}%` }} />
    </div>
  );
}
