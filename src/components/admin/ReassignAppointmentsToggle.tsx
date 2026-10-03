import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import ProfileFeatureToggle from "./ProfileFeatureToggle";

interface Props {
  userId: string;
  userName: string;
  /**
   * Controlled value. When omitted the toggle self-loads the flag, keeping the
   * component usable standalone; the Members Directory passes it so all
   * permissions come from one profiles read.
   */
  value?: boolean;
  onChanged?: (next: boolean) => void;
}

/** Admin switch: lets a team member reassign appointments to others in their office. */
export default function ReassignAppointmentsToggle({ userId, userName, value, onChanged }: Props) {
  const { t } = useTranslation("dashboard");
  const [internal, setInternal] = useState(false);
  useEffect(() => {
    if (value !== undefined) return;
    let stale = false;
    supabase.from("profiles").select("can_reassign_office_appointments" as any).eq("id", userId).maybeSingle()
      .then(({ data }) => { if (!stale) setInternal(!!(data as any)?.can_reassign_office_appointments); });
    return () => { stale = true; };
  }, [userId, value]);
  return (
    <ProfileFeatureToggle
      userId={userId}
      column="can_reassign_office_appointments"
      label={t("admin.members.reassignSwitch", "Reassign office appointments")}
      value={value ?? internal}
      onChanged={onChanged ?? setInternal}
      enableTitle={t("admin.members.reassignEnableTitle", "Allow reassigning appointments?")}
      enableBody={t("admin.members.reassignEnableBody", { name: userName, defaultValue: "{{name}} will be able to move appointments to other team members in the same office." })}
      disableTitle={t("admin.members.reassignDisableTitle", "Stop reassigning appointments?")}
      disableBody={t("admin.members.reassignDisableBody", { name: userName, defaultValue: "{{name}} will no longer be able to move appointments to other team members." })}
      enabledToast={t("admin.members.reassignEnabled", "Reassigning enabled")}
      disabledToast={t("admin.members.reassignDisabled", "Reassigning disabled")}
    />
  );
}
