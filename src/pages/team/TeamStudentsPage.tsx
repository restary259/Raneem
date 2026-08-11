import React, { useEffect, useState, useCallback } from "react";
import { User, RefreshCw, UserPlus, Loader2, Mail, Search, Copy, CheckCheck, Send, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { identityConflictMessage } from "@/lib/identityConflict";
import { readFunctionErrorBody, readFunctionError } from "@/lib/functionError";

/* ─── Types ──────────────────────────────────────────────────────────── */
interface StudentRecord {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

interface PendingInvitation {
  id: string;
  invited_email: string;
  invited_name: string | null;
  status: string;
  expires_at: string;
  created_at: string;
}

/* ═══════════════════════════════════════════════════════════════════════  
   MAIN COMPONENT  
═══════════════════════════════════════════════════════════════════════ */
export default function TeamStudentsPage() {
  const { toast } = useToast();
  const { t, i18n } = useTranslation("dashboard");
  const navigate = useNavigate();
  const isRtl = i18n.language === "ar";

  /* ── Student list ────────────────────────────────────────────────── */
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [search, setSearch] = useState("");

  /* ── Pending student invitations ─────────────────────────────────── */
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [busyInvite, setBusyInvite] = useState<string | null>(null);

  /* ── Dialog ──────────────────────────────────────────────────────── */
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newCreds, setNewCreds] = useState<{
    full_name: string;
    email: string;
    invited: boolean;
    alreadyInvited: boolean;
    invitationFailed: boolean;
    activationUrl: string | null;
  } | null>(null);

  /** 'invite' sends a branded activation email; 'manual' will show a temp password (wired in a later step). */
  const [mode, setMode] = useState<"invite" | "manual">("invite");

  /* ── Form fields ─────────────────────────────────────────────────── */
  const [form, setForm] = useState({
    firstName: "",
    fatherName: "",
    familyName: "",
    email: "",
  });

  const setField = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const resetForm = () => setForm({ firstName: "", fatherName: "", familyName: "", email: "" });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Fetch students ──────────────────────────────────────────────── */
  const fetchStudents = useCallback(async () => {
    setListLoading(true);
    try {
      const { data: roleData, error: roleErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");

      if (roleErr) {
        console.error("user_roles RLS error:", roleErr.message, roleErr.details);
        toast({ variant: "destructive", description: t("common.error") });
        return;
      }

      const ids = (roleData ?? []).map((r: any) => r.user_id);
      if (ids.length === 0) {
        setStudents([]);
        return;
      }

      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, email, created_at")
        .in("id", ids)
        .not("created_by", "is", null)
        .is("case_id", null)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("profiles fetch error:", error.message);
        throw error;
      }
      setStudents(data ?? []);
    } catch (err: any) {
      console.error("fetchStudents error:", err);
      toast({ variant: "destructive", description: t("common.error") });
    } finally {
      setListLoading(false);
    }
  }, [toast]);

  /* ── Fetch pending student invitations ───────────────────────────── */
  const fetchInvitations = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("user_invitations")
      .select("id, invited_email, invited_name, status, expires_at, created_at")
      .eq("status", "pending")
      .eq("invitation_type", "student")
      .order("created_at", { ascending: false });
    setInvitations((data || []) as PendingInvitation[]);
  }, []);

  useEffect(() => {
    fetchStudents();
    fetchInvitations();
  }, [fetchStudents, fetchInvitations]);

  /* ── Create account ──────────────────────────────────────────────── */
  const handleCreate = async () => {
    const { firstName, fatherName, familyName, email } = form;

    if (!firstName.trim() || !fatherName.trim() || !familyName.trim()) {
      toast({ variant: "destructive", description: t("team.students.namePartsRequired") });
      return;
    }

    if (!email.includes("@")) {
      toast({ variant: "destructive", description: t("team.students.invalidEmail") });
      return;
    }

    const fullName = `${firstName.trim()} ${fatherName.trim()} ${familyName.trim()}`;

    setCreating(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // NOTE: Step 3 finalizes the invite path. Both modes still route through
      // the invite flow here; the `manual` temp-password path is wired in Step 4.
      const { data, error } = await supabase.functions.invoke("create-student-from-case", {
        body: { student_email: email.trim().toLowerCase(), student_full_name: fullName },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (error) {
        // Surface identity-conflict wording ("one identity = one role") like the
        // Admin Team flow, instead of a generic error.
        const body = await readFunctionErrorBody(error);
        const conflict = identityConflictMessage(body as any, t);
        throw new Error(conflict ?? (await readFunctionError(error)));
      }
      if (!data?.success) throw new Error(data?.error || "Creation failed");

      setNewCreds({
        full_name: fullName,
        email: data.email,
        invited: data.invited === true,
        alreadyInvited: data.already_invited === true,
        invitationFailed: data.invitation_failed === true,
        activationUrl: data.activation_url ?? null,
      });

      resetForm();
      await Promise.all([fetchStudents(), fetchInvitations()]);
      toast({ description: t("team.students.createdSuccess") });
    } catch (err: any) {
      console.error("handleCreate error:", err);
      toast({ variant: "destructive", description: err?.message || t("common.error") });
    } finally {
      setCreating(false);
    }
  };

  /* ── Resend a pending invitation ─────────────────────────────────── */
  const resendInvitation = async (inv: PendingInvitation) => {
    setBusyInvite(inv.id);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("create-student-from-case", {
        body: {
          student_email: inv.invited_email.trim().toLowerCase(),
          student_full_name: inv.invited_name || inv.invited_email.split("@")[0],
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) {
        const body = await readFunctionErrorBody(error);
        const conflict = identityConflictMessage(body as any, t);
        throw new Error(conflict ?? (await readFunctionError(error)));
      }
      if (!data?.success) throw new Error(data?.error || "Resend failed");
      await fetchInvitations();
      toast({
        description: data.already_invited
          ? t(
              "team.students.inviteAlreadySent",
              "An activation link was sent recently. Ask the student to check their inbox.",
            )
          : t("team.students.invitationSent", "Invitation sent"),
      });
    } catch (err: any) {
      toast({ variant: "destructive", description: err?.message || t("common.error") });
    } finally {
      setBusyInvite(null);
    }
  };

  /* ── Filtered list ───────────────────────────────────────────────── */
  const filtered = students.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (s.full_name ?? "").toLowerCase().includes(q) || (s.email ?? "").toLowerCase().includes(q);
  });

  /* ─────────────────────────────────────────────────────────────────  
     RENDER  
  ─────────────────────────────────────────────────────────────────── */
  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t("team.students.title", "Student Accounts")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("team.students.subtitle", "Create and manage student portal accounts.")}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={t("common.refresh")}
            onClick={() => {
              fetchStudents();
              fetchInvitations();
            }}
            title={t("common.refresh")}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          {/* ── Create dialog ───────────────────────────────────────── */}
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) {
                resetForm();
                setNewCreds(null);
                setMode("invite");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                {t("team.students.createAccount", "Create Student Account")}
              </Button>
            </DialogTrigger>

            <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t("team.students.createAccount", "Create Student Account")}</DialogTitle>
                <DialogDescription>
                  {t(
                    "team.students.inviteDescription",
                    "Create a student account and send a secure activation link by email.",
                  )}
                </DialogDescription>
              </DialogHeader>

              {/* ── Invite success view ─────────────────────────────── */}
              {newCreds ? (
                <div className="space-y-4 pt-1">
                  <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <CheckCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <p className="text-sm text-muted-foreground">
                      {newCreds.invited
                        ? t(
                            "team.students.inviteSentHint",
                            "An activation email was sent. The link works once and expires in 7 days.",
                          )
                        : newCreds.alreadyInvited
                          ? t(
                              "team.students.inviteAlreadySent",
                              "An activation link was sent recently. Ask the student to check their inbox.",
                            )
                          : newCreds.invitationFailed
                            ? t(
                                "team.students.inviteEmailFailed",
                                "The invitation was created but the email could not be sent — share the link below instead.",
                              )
                            : t(
                                "team.students.invitePending",
                                "The student can activate their account using the email invitation.",
                              )}
                    </p>
                  </div>

                  <div className="space-y-3 rounded-lg bg-muted p-4">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("team.students.emailAddress", "Email")}
                      </p>
                      <p dir="ltr" className="break-all font-mono text-sm text-foreground">
                        {newCreds.email}
                      </p>
                    </div>

                    {newCreds.activationUrl && (
                      <>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            {t("team.students.activationLink", "Activation link")}
                          </p>
                          <p
                            dir="ltr"
                            className="select-all break-all rounded-md bg-background p-2 text-start font-mono text-xs leading-relaxed text-foreground"
                          >
                            {newCreds.activationUrl}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            variant="secondary"
                            className="w-full gap-2 sm:flex-1"
                            onClick={() => copyToClipboard(newCreds.activationUrl!)}
                          >
                            {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            {copied
                              ? t("team.students.copied", "Copied")
                              : t("team.students.copyInviteLink", "Copy activation link")}
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full gap-2 sm:w-auto"
                            onClick={() => window.open(newCreds.activationUrl!, "_blank", "noopener")}
                          >
                            <Link2 className="h-4 w-4" />
                            {t("team.students.openLink", "Open")}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => {
                      setNewCreds(null);
                      setOpen(false);
                    }}
                  >
                    {t("common.done", "Done")}
                  </Button>
                </div>
              ) : (
                /* ── Creation form ──────────────────────────────────── */
                <div className="space-y-4 pt-1">
                  {/* Three-part name */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {t("team.students.fullThreePart")}
                    </p>

                    <div className="space-y-1">
                      <Label htmlFor="firstName">{t("team.students.firstName")}</Label>
                      <Input
                        id="firstName"
                        value={form.firstName}
                        onChange={setField("firstName")}
                        placeholder={isRtl ? "مثال: محمد" : "e.g. Ahmad"}
                        autoFocus
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="fatherName">{t("team.students.fatherName")}</Label>
                      <Input
                        id="fatherName"
                        value={form.fatherName}
                        onChange={setField("fatherName")}
                        placeholder={isRtl ? "مثال: علي" : "e.g. Khalid"}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="familyName">{t("team.students.familyName")}</Label>
                      <Input
                        id="familyName"
                        value={form.familyName}
                        onChange={setField("familyName")}
                        placeholder={isRtl ? "مثال: النجار" : "e.g. Hassan"}
                      />
                    </div>
                  </div>

                  {/* Preview full name */}
                  {(form.firstName || form.fatherName || form.familyName) && (
                    <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {[form.firstName, form.fatherName, form.familyName].filter(Boolean).join(" ")}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-border" />

                  {/* Email */}
                  <div className="space-y-1">
                    <Label htmlFor="email">{t("team.students.emailAddress")}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={setField("email")}
                      placeholder="student@example.com"
                      onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    />
                  </div>

                  {/* How should the account be created? */}
                  <div className="space-y-2">
                    <Label>{t("team.students.howToCreate", "How should the account be created?")}</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(
                        [
                          {
                            key: "invite",
                            title: t("team.students.modeInvite", "Send invitation email"),
                            desc: t(
                              "team.students.modeInviteDesc",
                              "They receive a branded link and choose their own password.",
                            ),
                          },
                          {
                            key: "manual",
                            title: t("team.students.modeManual", "Create manually"),
                            desc: t(
                              "team.students.modeManualDesc",
                              "You get a temporary password to pass on; they must change it at first sign-in.",
                            ),
                          },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setMode(opt.key)}
                          className={`rounded-lg border p-3 text-start transition-colors ${
                            mode === opt.key ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                          }`}
                        >
                          <span className="block text-sm font-medium text-foreground">{opt.title}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button className="w-full gap-2" onClick={handleCreate} disabled={creating}>
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin me-2" />
                        {t("team.students.creating")}
                      </>
                    ) : mode === "invite" ? (
                      <>
                        <Mail className="h-4 w-4" />
                        {t("team.students.sendInvite", "Send invitation")}
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        {t("team.students.createAccount", "Create Account")}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Search bar ─────────────────────────────────────────────── */}
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("team.students.searchPlaceholder")}
          className="ps-9"
        />
      </div>

      {/* ── Pending invitations ────────────────────────────────────── */}
      {invitations.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="border-b px-4 py-3 text-sm font-medium text-foreground">
              {t("team.students.pendingInvites", "Pending invitations")}
            </div>
            <div className="divide-y divide-border">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {inv.invited_name || inv.invited_email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{inv.invited_email}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("team.students.inviteExpires", "Expires")}:{" "}
                      {new Date(inv.expires_at).toLocaleDateString("en-US")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{t("team.students.invited", "Invited")}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={busyInvite === inv.id}
                      onClick={() => resendInvitation(inv)}
                      title={t("team.students.resendInvite", "Resend invitation")}
                      aria-label={t("team.students.resendInvite", "Resend invitation")}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Student list ───────────────────────────────────────────── */}
      {listLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin me-2" />
          {t("team.students.loading")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center">
          <User className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground">
            {search ? t("team.students.noResults") : t("team.students.noStudents", "No student accounts yet")}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {!search && t("team.students.noStudentsHint", "Create a student account to get started.")}
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {filtered.map((s) => (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/team/students/${s.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/team/students/${s.id}`);
                    }
                  }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  {/* Avatar */}
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{s.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3 shrink-0" />
                      {s.email}
                    </p>
                  </div>

                  {/* Date */}
                  <p className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(s.created_at), "d MMM yyyy")}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
