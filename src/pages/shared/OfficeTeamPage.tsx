import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useOfficeWorkspaceContext } from "@/components/office/OfficeWorkspaceLayout";

type TeamMember = {
  user_id: string;
  full_name: string | null;
  membership_type: string | null;
  is_primary: boolean | null;
  is_active: boolean | null;
};

/**
 * The office team — the same office_members that drive booking routing. There
 * is no separate Google "team"; Primary / Side Manager here are the Google
 * operators too, because both attach to office_id.
 */
export default function OfficeTeamPage() {
  const { t } = useTranslation("dashboard");
  const workspace = useOfficeWorkspaceContext();
  const officeId = workspace?.officeId;
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!officeId) return;
    setLoading(true);
    setError(false);
    // Scoped SECURITY DEFINER read authorizes admin-or-member server-side.
    const { data, error: rpcError } = await supabase.rpc(
      "get_office_team" as never,
      {
        p_office_id: officeId,
      } as never,
    );
    // A failed read must not look like an empty team.
    if (rpcError) {
      setError(true);
      setMembers([]);
    } else {
      setMembers((data as unknown as TeamMember[]) ?? []);
    }
    setLoading(false);
  }, [officeId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardContent className="space-y-2 py-4">
        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("common.loading", "Loading…")}
          </p>
        ) : error ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("common.error", "Something went wrong. Please try again.")}
          </p>
        ) : members.length === 0 ? (
          <p className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
            <Users className="size-6" />
            {t("officeWorkspace.noTeam", "No team members assigned yet.")}
          </p>
        ) : (
          members.map((member) => (
            <div
              key={member.user_id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            >
              <span className="truncate text-sm font-medium">
                {member.full_name ??
                  t("officeWorkspace.unknownMember", "Team member")}
              </span>
              <div className="flex items-center gap-2">
                {member.is_primary ? (
                  <Badge variant="secondary">
                    {t("officeWorkspace.primary", "Primary")}
                  </Badge>
                ) : null}
                <Badge variant="outline">
                  {member.membership_type ??
                    t("officeWorkspace.staff", "Staff")}
                </Badge>
                {!member.is_active ? (
                  <Badge variant="outline">
                    {t("officeWorkspace.inactive", "Inactive")}
                  </Badge>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
