import { CircleCheck, CircleHelp, CircleX, TriangleAlert } from "lucide-react";
import type { Verdict } from "@/lib/types";

export function VerdictIcon({ verdict, className }: { verdict: Verdict; className?: string }) {
  const props = { className, "aria-hidden": true } as const;
  switch (verdict) {
    case "TRUE":
      return <CircleCheck {...props} />;
    case "EXAGGERATED":
      return <TriangleAlert {...props} />;
    case "FALSE":
      return <CircleX {...props} />;
    default:
      return <CircleHelp {...props} />;
  }
}
