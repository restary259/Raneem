import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Connection dot + New conversation + Refresh. Presentational only. */
export function WhatsAppActions({ receiving, connectedLabel, statusLabel, refreshLabel, startLabel, onRefresh, onStart }: { receiving: boolean; connectedLabel: string; statusLabel: string; refreshLabel: string; startLabel: string; onRefresh: () => void; onStart: () => void }) {
  return <div className="flex flex-wrap items-center gap-2"><span className="flex items-center gap-1.5 text-xs font-medium" title={statusLabel}><span className={cn("h-2 w-2 rounded-full", receiving ? "bg-emerald-500" : "bg-amber-500")} />{receiving ? connectedLabel : statusLabel}</span><Button size="sm" variant="outline" onClick={onStart}><Plus className="me-2 h-4 w-4" />{startLabel}</Button><Button size="icon" variant="outline" onClick={onRefresh} aria-label={refreshLabel}><RefreshCw className="h-4 w-4" /></Button></div>;
}
