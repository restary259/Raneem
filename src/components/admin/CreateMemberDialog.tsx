import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCheck, Copy, Link2, Mail, UserPlus } from "lucide-react";
import { identityConflictMessage } from "@/lib/identityConflict";
import { checkEmailAvailability } from "@/lib/checkEmailAvailability";

interface CreateMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRole?: string;
  onCreated?: (role: string) => void;
}

const STAFF_ROLES = ["team_member", "social_media_partner", "ambassador", "agent"];

const ROLE_LABEL_KEYS: Record<string, string> = {
  team_member: "admin.members.roleTeamMember",
  agent: "admin.members.roleAgent",
  social_media_partner: "admin.members.rolePartner",
  ambassador: "admin.members.roleAmbassador",
};

const CreateMemberDialog: React.FC<CreateMemberDialogProps> = ({
  open,
  onOpenChange,
  defaultRole = "team_member",
  onCreated,
}) => {
  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();
  const isRtl = i18n.language === "ar";

  const [form, setForm] = useState({ fullName: "", email: "", role: defaultRole });
  const [mode, setMode] = useState<"invite" | "manual">("invite");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newCreds, setNewCreds] = useState<{ email: string; password: string } | null>(null);
  const [invitedInfo, setInvitedInfo] = useState<{ email: string; emailed: boolean; url: string } | null>(null);

  useEffect(() => {
    if (open) {
      setForm((f) => ({ ...f, role: defaultRole }));
      setMode("invite");
      setInvitedInfo(null);
      setNewCreds(null);
      setCopied(false);
    }
  }, [open, defaultRole]);

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

  const resetForm = () => {
    setForm({ fullName: "", email: "", role: defaultRole });
  };

  const createMember = async () => {
    if (!form.fullName.trim() || !form.email.trim()) {
      toast({ variant: "destructive", description: t("admin.team.allFieldsRequired") });
      return;
    }
    setCreating(true);
    try {
      try {
        const availability = await checkEmailAvailability(form.email.trim());
        if (!availability.available) {
          throw new Error(
            conflictMessage({
              code: "identity_conflict",
              existing_role: availability.existing_role ?? undefined,
              intended_role: form.role,
              deactivated: availability.deactivated,
            }) ?? t("admin.team.conflictActive", { role: t("admin.team.someRole", "another") }),
          );
        }
      } catch (checkErr: any) {
        if (checkErr instanceof Error && checkErr.message && !("status" in checkErr)) {
          if (checkErr.message !== "email-availability check failed") throw checkErr;
        }
      }

      if (mode === "invite") {
        const result = await callInviteFn({
          action: "send",
          full_name: form.fullName.trim(),
          email: form.email.trim(),
          role: form.role,
        });
        setInvitedInfo({ email: form.email.trim(), emailed: !!result.emailed, url: result.activationUrl });
        resetForm();
        onCreated?.(form.role);
        toast({ description: t("admin.team.invitationSent", "Invitation sent") });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-team-member`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ full_name: form.fullName, email: form.email, role: form.role }),
      });
      const result = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(
          conflictMessage(result) ||
            (result as any)?.error ||
            t("admin.team.createFailed", "Failed to create member"),
        );
      }
      setNewCreds({ email: form.email, password: result.tempPassword || result.temp_password });
      resetForm();
      onCreated?.(form.role);
      toast({ description: t("admin.team.accountCreated") });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setInvitedInfo(null);
      setNewCreds(null);
      setCopied(false);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-[95vw] sm:max-w-lg w-full">
        <DialogHeader>
          <DialogTitle>
            {invitedInfo
              ? t("admin.team.inviteSentTitle", "Invitation sent")
              : newCreds
                ? t("admin.team.accountCreatedTitle", "Account created")
                : t("admin.team.createMember", "Create Team Member")}
          </DialogTitle>
        </DialogHeader>

        {invitedInfo ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <CheckCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">
                {invitedInfo.emailed
                  ? t("admin.team.inviteSentHint", "An activation email was sent. The link works once and expires in 7 days.")
                  : t("admin.team.inviteEmailFailed", "The invitation was created but the email could not be sent — share the link below instead.")}
              </p>
            </div>

            <div className="space-y-3 rounded-lg bg-muted p-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{t("admin.team.email", "Email")}</p>
                <p dir="ltr" className="break-all font-mono text-sm text-foreground">{invitedInfo.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("admin.team.activationLink", "Activation link")}
                </p>
                <p
                  dir="ltr"
                  className="select-all break-all rounded-md bg-background p-2 text-start font-mono text-xs leading-relaxed text-foreground"
                >
                  {invitedInfo.url}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="secondary"
                  className="w-full gap-2 sm:flex-1"
                  onClick={() => copyToClipboard(invitedInfo.url)}
                >
                  {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  {copied
                    ? t("admin.team.copied", "Copied")
                    : t("admin.team.copyInviteLink", "Copy activation link")}
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2 sm:w-auto"
                  onClick={() => window.open(invitedInfo.url, "_blank", "noopener")}
                >
                  <Link2 className="h-4 w-4" />
                  {t("admin.team.openLink", "Open")}
                </Button>
              </div>
            </div>

            <Button className="w-full" onClick={() => { setInvitedInfo(null); handleOpenChange(false); }}>
              {t("common.done", "Done")}
            </Button>
          </div>
        ) : newCreds ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("admin.team.credentialsHint")}
            </p>
            <div className="space-y-3 rounded-lg bg-muted p-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{t("admin.team.email", "Email")}</p>
                <p dir="ltr" className="break-all font-mono text-sm text-foreground">{newCreds.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{t("admin.team.tempPassword", "Temp Password")}</p>
                <p dir="ltr" className="select-all break-all rounded-md bg-background p-2 font-mono text-sm text-foreground">
                  {newCreds.password}
                </p>
              </div>
              <Button
                variant="secondary"
                className="w-full gap-2"
                onClick={() => copyToClipboard(newCreds.password)}
              >
                {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                {copied ? t("admin.team.copied", "Copied") : t("admin.team.copyPassword", "Copy password")}
              </Button>
            </div>
            <Button className="w-full" onClick={() => { setNewCreds(null); handleOpenChange(false); }}>
              {t("common.done", "Done")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>{t("admin.team.fullName", "Full Name")}</Label>
              <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("admin.team.email", "Email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("admin.team.role", "Role")}</Label>
              <Select value={form.role} onValueChange={(val) => setForm((f) => ({ ...f, role: val }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAFF_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {t(ROLE_LABEL_KEYS[role], role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("admin.team.howToCreate", "How should the account be created?")}</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  { key: "invite", title: t("admin.team.modeInvite", "Send invitation email"), desc: t("admin.team.modeInviteDesc", "They receive a branded link and choose their own password.") },
                  { key: "manual", title: t("admin.team.modeManual", "Create manually"), desc: t("admin.team.modeManualDesc", "You get a temporary password to pass on; they must change it at first sign-in.") },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setMode(opt.key)}
                    className={`rounded-lg border p-3 text-start transition-colors ${mode === opt.key ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                  >
                    <span className="block text-sm font-medium text-foreground">{opt.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full gap-2"
              onClick={createMember}
              disabled={creating}
            >
              {mode === "invite" ? <Mail className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {creating
                ? t("admin.team.creating")
                : mode === "invite"
                  ? t("admin.team.sendInvite", "Send invitation")
                  : t("admin.team.createBtn", "Create Account")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateMemberDialog;