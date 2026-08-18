import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, X } from "lucide-react";
import { identityConflictMessage } from "@/lib/identityConflict";
import { getRoleLabel, getRoleColors } from "@/lib/roleLabels";
import { filterActiveInvitations } from "@/lib/studentInvitations";

interface PendingInvitation {
  id: string;
  invited_email: string;
  invited_name: string | null;
  invitation_type: string;
  intended_role: string;
  status: string;
  expires_at: string;
  created_at: string;
}

interface PendingInvitationsProps {
  refreshKey?: number;
  /**
   * Emails of active (non-deactivated) member accounts. A pending invitation
   * whose email already belongs to an active account is not genuinely pending
   * — the DB reconciliation trigger closes it, and this prop is the
   * defense-in-depth that hides it here before that runs (replication lag,
   * a missed path, etc.).
   */
  activeEmails?: string[];
}

const PendingInvitations: React.FC<PendingInvitationsProps> = ({ refreshKey = 0, activeEmails = [] }) => {
  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();

  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [busyInvite, setBusyInvite] = useState<string | null>(null);

  const visibleInvitations = useMemo(
    () => filterActiveInvitations(invitations, activeEmails.map((e) => ({ id: e, email: e }))),
    [invitations, activeEmails],
  );

  const conflictMessage = useCallback(
    (result: any) => identityConflictMessage(result, t),
    [t],
  );

  const callInviteFn = useCallback(
    async (payload: Record<string, unknown>) => {
      let { data: { session } } = await supabase.auth.getSession();
      const expSoon = !session?.expires_at || session.expires_at * 1000 - Date.now() < 60_000;
      if (expSoon) {
        const { data } = await supabase.auth.refreshSession();
        session = data.session ?? session;
      }
      if (!session?.access_token) {
        throw new Error(
          t("admin.team.sessionExpired", "Your session expired. Please sign in again and retry."),
        );
      }
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (resp.status === 401) {
          throw new Error(
            t("admin.team.sessionExpired", "Your session expired. Please sign in again and retry."),
          );
        }
        throw new Error(conflictMessage(result) || (result as any)?.error || "Request failed");
      }
      return result;
    },
    [conflictMessage, t],
  );

  const fetchInvitations = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("user_invitations")
      .select("id, invited_email, invited_name, invitation_type, intended_role, status, expires_at, created_at")
      .eq("status", "pending")
      .in("invitation_type", ["team", "partner", "ambassador", "agent"])
      .order("created_at", { ascending: false });
    setInvitations((data || []) as PendingInvitation[]);
  }, []);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations, refreshKey]);

  const resendInvitation = async (inv: PendingInvitation) => {
    setBusyInvite(inv.id);
    try {
      await callInviteFn({
        action: "send",
        full_name: inv.invited_name || inv.invited_email.split("@")[0],
        email: inv.invited_email,
        role: inv.intended_role,
      });
      await fetchInvitations();
      toast({ description: t("admin.team.invitationSent", "Invitation sent") });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setBusyInvite(null);
    }
  };

  const revokeInvitation = async (inv: PendingInvitation) => {
    setBusyInvite(inv.id);
    try {
      await callInviteFn({ action: "revoke", invitation_id: inv.id });
      await fetchInvitations();
      toast({ description: t("admin.team.invitationRevoked", "Invitation revoked") });
    } catch {
      toast({
        variant: "destructive",
        title: t("common.error", "Error"),
        description: t("common.actionFailed", "Something went wrong. Please try again or contact support."),
      });
    } finally {
      setBusyInvite(null);
    }
  };

  if (visibleInvitations.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b px-4 py-3 text-sm font-medium text-foreground">
          {t("admin.team.pendingInvites", "Pending invitations")}
        </div>
        <div className="divide-y divide-border">
          {visibleInvitations.map((inv) => (
            <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {inv.invited_name || inv.invited_email}
                </p>
                <p className="truncate text-xs text-muted-foreground">{inv.invited_email}</p>
                <p className="text-xs text-muted-foreground">
                  {t("admin.team.inviteExpires", "Expires")}:{" "}
                  {new Date(inv.expires_at).toLocaleDateString(i18n.language === "ar" ? "ar-EG" : "en-US")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={getRoleColors(inv.intended_role)}>{getRoleLabel(inv.intended_role)}</Badge>
                <Badge variant="outline">{t("admin.team.invited", "Invited")}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={busyInvite === inv.id}
                  onClick={() => resendInvitation(inv)}
                  title={t("admin.team.resendInvite", "Resend invitation")}
                  aria-label={t("admin.team.resendInvite", "Resend invitation")}
                >
                  <Send className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  disabled={busyInvite === inv.id}
                  onClick={() => revokeInvitation(inv)}
                  title={t("admin.team.revokeInvite", "Revoke invitation")}
                  aria-label={t("admin.team.revokeInvite", "Revoke invitation")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PendingInvitations;