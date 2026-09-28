import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, Check, ChevronDown, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { readFunctionError } from "@/lib/functionError";

interface Props {
  appointmentId: string;
  onDone: () => void;
  size?: "sm" | "default";
}

/** Two-step appointment action: tap "Manage" → Confirm / Reschedule / Cancel. */
export default function AppointmentActionMenu({ appointmentId, onDone, size = "sm" }: Props) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<null | "reschedule" | "cancel">(null);
  const [newDate, setNewDate] = useState("");

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast({ description: ok });
      setDialog(null);
      setNewDate("");
      onDone();
    } catch (err: any) {
      toast({ variant: "destructive", description: err?.message ?? String(err) });
    } finally {
      setBusy(false);
    }
  };

  const confirm = () =>
    run(async () => {
      const { error } = await supabase.rpc("confirm_public_appointment", { p_appointment_id: appointmentId });
      if (error) throw error;
    }, t("appointmentActions.confirmed", "Appointment confirmed"));

  const outcome = (kind: "cancelled" | "rescheduled") =>
    run(async () => {
      const resp = await supabase.functions.invoke("record-appointment-outcome", {
        body: {
          appointment_id: appointmentId,
          outcome: kind,
          outcome_notes: null,
          new_scheduled_at: kind === "rescheduled" ? new Date(newDate).toISOString() : null,
        },
      });
      if (resp.error) throw new Error(await readFunctionError(resp.error));
      if ((resp.data as any)?.error) throw new Error((resp.data as any).error);
    }, kind === "cancelled" ? t("appointmentActions.cancelled", "Appointment cancelled") : t("appointmentActions.rescheduled", "Appointment rescheduled"));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size={size} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("appointmentActions.manage", "Manage appointment")}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onSelect={confirm} className="gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            {t("appointmentActions.confirm", "Confirm")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("reschedule")} className="gap-2">
            <CalendarClock className="h-4 w-4" />
            {t("appointmentActions.reschedule", "Reschedule")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("cancel")} className="gap-2 text-destructive focus:text-destructive">
            <X className="h-4 w-4" />
            {t("appointmentActions.cancel", "Cancel appointment")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && !busy && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dialog === "reschedule"
                ? t("appointmentActions.reschedule", "Reschedule")
                : t("appointmentActions.cancelConfirm", "Cancel this appointment?")}
            </DialogTitle>
          </DialogHeader>
          {dialog === "reschedule" && (
            <div className="space-y-1">
              <Label>{t("appointmentActions.newTime", "New date and time")}</Label>
              <Input type="datetime-local" value={newDate} onChange={(e) => setNewDate(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>
              {t("appointmentActions.back", "Back")}
            </Button>
            {dialog === "reschedule" ? (
              <Button disabled={busy || !newDate} onClick={() => outcome("rescheduled")}>
                {busy && <Loader2 className="h-4 w-4 me-1 animate-spin" />}
                {t("appointmentActions.save", "Save")}
              </Button>
            ) : (
              <Button variant="destructive" disabled={busy} onClick={() => outcome("cancelled")}>
                {busy && <Loader2 className="h-4 w-4 me-1 animate-spin" />}
                {t("appointmentActions.cancel", "Cancel appointment")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
