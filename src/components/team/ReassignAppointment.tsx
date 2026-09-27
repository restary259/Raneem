import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface Props {
  appointmentId: string;
  officeId: string | null | undefined;
  currentMemberId: string | null | undefined;
  onReassigned: () => void;
}

/** "Assign to…" picker. Only renders when the server says the caller may
 *  reassign inside this office (admin, or member with the admin switch on). */
export default function ReassignAppointment({ appointmentId, officeId, currentMemberId, onReassigned }: Props) {
  const { t } = useTranslation("dashboard");
  const [members, setMembers] = useState<{ id: string; full_name: string | null }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!officeId) return;
    let stale = false;
    (supabase.rpc as any)("list_office_members", { p_office_id: officeId }).then(({ data, error }: any) => {
      if (stale) return;
      if (error) { console.warn("list_office_members", error); return; }
      setMembers(data ?? []);
    });
    return () => { stale = true; };
  }, [officeId]);

  if (!officeId || members.length < 2) return null;

  const onChange = async (id: string) => {
    if (id === currentMemberId) return;
    setBusy(true);
    const { error } = await (supabase.rpc as any)("reassign_office_appointment", { p_appointment_id: appointmentId, p_new_member_id: id });
    setBusy(false);
    if (error) { toast({ variant: "destructive", description: error.message }); return; }
    toast({ description: t("team.appointments.reassigned", "Appointment reassigned") });
    onReassigned();
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t("team.appointments.reassignTo", "Reassign to")}
      </Label>
      <Select value={currentMemberId ?? undefined} onValueChange={onChange} disabled={busy}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name ?? "—"}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
