import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

/** Small KPI card used by the Overview (Tools) surface. */
export function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return <Card className="rounded-lg p-3.5 shadow-none"><div className="flex items-center justify-between"><div><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1.5 text-2xl font-semibold">{value}</p></div><div className="rounded-md bg-brand/10 p-2 text-brand"><Icon className="h-4.5 w-4.5" /></div></div></Card>;
}
