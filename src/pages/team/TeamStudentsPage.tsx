import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { User, RefreshCw, UserPlus, Loader2, Mail, Search, Copy, CheckCheck, Send } from "lucide-react";
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
import { filterActiveInvitations } from "@/lib/studentInvitations";
import { LoadingState, EmptyState, usePagination, TablePagination, useDebouncedValue } from "@/components/shell";

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
  case_id: string | null;
}

interface LinkedCase {
  id: string;
  case_reference: string | null;
  status: string;
  program: string | null;
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
  const debouncedSearch = useDebouncedValue(search, 250);

  /* ── Pending student invitations ─────────────────────────────────── */
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [busyInvite, setBusyInvite] = useState<string | null>(null);

  /* ── Dialog ──────────────────────────────────────────────────────── */
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  /** Which copy button was last pressed ("password" | "link" | null). */
  const [copied, setCopied] = useState<"password" | "link" | null>(null);
  const [newCreds, setNewCreds] = useState<{
    full_name: string;
    email: string;
    mode: "invite" | "manual";
    invited: boolean;
    alreadyInvited: boolean;
    invitationFailed: boolean;
    activationUrl: string | null;
    tempPassword: string | null;
  } | null>(null);

  /** 'invite' sends a branded activation email; 'manual' returns a temp password. */
  const [mode, setMode] = useState<"invite" | "manual">("invite");

  /* ── Linked cases discovered from the typed email ────────────────── */
  const [linkedCases, setLinkedCases] = useState<LinkedCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  /** The single case that will be linked on submit (backend links one). */
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  /* ── Form fields ─────────────────────────────────────────────────── */
  const [form, setForm] = useState({
    firstName: "",
    fatherName: "",
    familyName: "",
    email: "",
  });

  const setField = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const resetForm = () => {
    setForm({ firstName: "", fatherName: "", familyName: "", email: "" });
    setLinkedCases([]);
    setSelectedCaseId(null);
  };

  const copyToClipboard = async (text: string, target: "password" | "link") => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement("textarea");
        el.value = text;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(target);
    } catch (err) {
      console.error("copyToClipboard failed:", err);
      return;
    }
    setTimeout(() => setCopied(null), 2000);
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

      // Staff-created student accounts (created_by IS NOT NULL). The case_id
      // filter was removed: a manually-created student linked to a case must
      // still appear under active accounts, otherwise it vanishes from both
      // this list and the pending-invitations list. Self-registered students
      // (created_by IS NULL) are excluded — they are not team-managed here.
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, email, created_at")
        .in("id", ids)
        .not("created_by", "is", null)
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
  const [invitesError, setInvitesError] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    setInvitesError(null);
    const { data, error } = await (supabase as any)
      .from("user_invitations")
      .select("id, invited_email, invited_name, status, expires_at, created_at, case_id")
      .eq("status", "pending")
      .eq("invitation_type", "student")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("fetchInvitations error:", error.message, error.details);
      setInvitesError(error.message ?? t("common.error"));
      setInvitations([]);
      return;
    }
    setInvitations((data || []) as PendingInvitation[]);
  }, [t]);

  useEffect(() => {
    fetchStudents();
    fetchInvitations();
  }, [fetchStudents, fetchInvitations]);

  // Refetch both lists when the team member returns to the tab. A student may
  // have activated their invitation (via link) or been provisioned manually on
  // another device since the page was last focused, and the invitation/account
  // state should reflect that without a manual refresh.
  useEffect(() => {
    const onFocus = () => {
      fetchStudents();
      fetchInvitations();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchStudents, fetchInvitations]);

  // Defensive safeguard: hide any pending invitation whose email already
  // belongs to an active student, even if the DB reconciliation has not yet
  // closed the row. The DB trigger + edge-function helper are the source of
  // truth; this prevents the contradictory "active account + pending invite"
  // from ever rendering.
  const visibleInvitations = useMemo(
    () => filterActiveInvitations(invitations, students),
    [invitations, students],
  );

  /* ── Find the case(s) already associated with this email ─────────── */
  const [casesError, setCasesError] = useState<string | null>(null);
  /** Monotonic sequence so an outdated (slow) lookup can't win the race. */
  const lookupSeq = useRef(0);

  const lookupCasesForEmail = useCallback(async (rawEmail: string) => {
    const email = rawEmail.trim().toLowerCase();
    const seq = ++lookupSeq.current;
    if (!email.includes("@")) {
      setLinkedCases([]);
      setSelectedCaseId(null);
      setCasesError(null);
      return;
    }
    setCasesLoading(true);
    setCasesError(null);
    try {
      // cases carry no email — case_submissions.student_email is the link.
      const { data: subs, error: subsError } = await (supabase as any)
        .from("case_submissions")
        .select("case_id, program_id")
        .eq("student_email", email);
      if (subsError) throw subsError;

      const caseIds = [...new Set((subs || []).map((s: any) => s.case_id).filter(Boolean))] as string[];
      if (caseIds.length === 0) {
        setLinkedCases([]);
        setSelectedCaseId(null);
        return;
      }

      const programByCase = new Map<string, string | null>();
      const programIds = [...new Set((subs || []).map((s: any) => s.program_id).filter(Boolean))] as string[];
      let programNames = new Map<string, string | null>();
      if (programIds.length > 0) {
        // H3: programs carry the real programme names (name_en/name_ar).
        const { data: programRows, error: programError } = await (supabase as any)
          .from("programs")
          .select("id, name_en, name_ar")
          .in("id", programIds);
        if (programError) throw programError;
        programNames = new Map(
          (programRows || []).map((p: any) => [p.id, p.name_en ?? p.name_ar ?? null]),
        );
      }
      (subs || []).forEach((s: any) => {
        if (s.case_id) programByCase.set(s.case_id, s.program_id ? (programNames.get(s.program_id) ?? null) : null);
      });

      const { data: caseRows, error: casesError } = await supabase
        .from("cases")
        .select("id, case_reference, status")
        .in("id", caseIds);
      if (casesError) throw casesError;

      const cases: LinkedCase[] = (caseRows || []).map((c: any) => ({
        id: c.id,
        case_reference: c.case_reference,
        status: c.status,
        program: programByCase.get(c.id) ?? null,
      }));

      // Only apply the result if no newer lookup started while we were away.
      if (seq !== lookupSeq.current) return;
      setLinkedCases(cases);
      // Default-select when exactly one case is found.
      setSelectedCaseId(cases.length === 1 ? cases[0].id : null);
    } catch (err: any) {
      console.error("lookupCasesForEmail error:", err);
      if (seq !== lookupSeq.current) return;
      setLinkedCases([]);
      setSelectedCaseId(null);
      setCasesError(err?.message ?? t("common.error"));
    } finally {
      if (seq === lookupSeq.current) setCasesLoading(false);
    }
  }, [t]);

  // Debounced lookup whenever the email changes.
  useEffect(() => {
    const handle = setTimeout(() => lookupCasesForEmail(form.email), 400);
    return () => clearTimeout(handle);
  }, [form.email, lookupCasesForEmail]);

  /* ── Create account (invite or manual, optional case link) ───────── */
  const submitCreate = async (confirmTransfer = false) => {
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

      const { data, error } = await supabase.functions.invoke("create-student-from-case", {
        body: {
          student_email: email.trim().toLowerCase(),
          student_full_name: fullName,
          mode,
          case_id: selectedCaseId ?? null,
          ...(confirmTransfer ? { confirm_transfer: true } : {}),
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (error) {
        const body = await readFunctionErrorBody(error);
        // Existing active case → ask before transferring.
        if ((body as any)?.code === "ALREADY_LINKED" && !confirmTransfer) {
          const ref = (body as any).existing_case_reference || (body as any).existing_case_id;
          if (
            window.confirm(
              t("team.students.confirmTransfer", {
                ref,
                defaultValue: `This student is already linked to an active case (${ref}). Move them to the selected case?`,
              }),
            )
          ) {
            setCreating(false);
            return submitCreate(true);
          }
          setCreating(false);
          return;
        }
        const conflict = identityConflictMessage(body as any, t);
        throw new Error(conflict ?? (await readFunctionError(error)));
      }

      if (!data?.success) throw new Error(data?.error || "Creation failed");

      setNewCreds({
        full_name: fullName,
        email: data.email,
        mode,
        invited: data.invited === true,
        alreadyInvited: data.already_invited === true,
        invitationFailed: data.invitation_failed === true,
        activationUrl: data.activation_url ?? null,
        tempPassword: data.temp_password ?? null,
      });

      resetForm();
      await Promise.all([fetchStudents(), fetchInvitations()]);
      toast({ description: t("team.students.createdSuccess") });
    } catch (err: any) {
      console.error("submitCreate error:", err);
      toast({ variant: "destructive", description: err?.message || t("common.error") });
    } finally {
      setCreating(false);
    }
  };

  const handleCreate = () => submitCreate(false);

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
          mode: "invite",
          // Keep the original case context so the resend targets the same case.
          ...(inv.case_id ? { case_id: inv.case_id } : {}),
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
  const filtered = useMemo(() => students.filter((s) => {
    if (!debouncedSearch.trim()) return true;
    const q = debouncedSearch.toLowerCase();
    return (s.full_name ?? "").toLowerCase().includes(q) || (s.email ?? "").toLowerCase().includes(q);
  }), [students, debouncedSearch]);

  const studentPagination = usePagination(filtered, 25);

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
              if (v) {
                // M2: never show a previous result while reopening.
                setNewCreds(null);
                setCopied(null);
                lookupSeq.current++;
              }
              if (!v) {
                resetForm();
                setNewCreds(null);
                setMode("invite");
                setCopied(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                {t("team.students.createAccount", "Create Student Account")}
              </Button>
            </DialogTrigger>

            <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("team.students.createAccount", "Create Student Account")}</DialogTitle>
                <DialogDescription>
                  {t(
                    "team.students.inviteDescription",
                    "Create a student account and send a secure activation link by email.",
                  )}
                </DialogDescription>
              </DialogHeader>

              {/* ── Success view ────────────────────────────────────── */}
              {newCreds ? (
                newCreds.mode === "manual" ? (
                  /* ── Manual: temporary password ─────────────────── */
                  <div className="space-y-4 pt-1">
                    <p className="text-sm text-muted-foreground">
                      {t(
                        "team.students.credentialsHint",
                        "Account created. Share these credentials with the student — they must change the password at first sign-in.",
                      )}
                    </p>
                    <div className="space-y-3 rounded-lg bg-muted p-4">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          {t("team.students.emailAddress", "Email")}
                        </p>
                        <p dir="ltr" className="break-all font-mono text-sm text-foreground">
                          {newCreds.email}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          {t("team.students.tempPassword", "Temporary Password")}
                        </p>
                        <p
                          dir="ltr"
                          className="select-all break-all rounded-md bg-background p-2 text-start font-mono text-sm text-foreground"
                        >
                          {newCreds.tempPassword}
                        </p>
                      </div>
                      {newCreds.tempPassword && (
                        <Button
                          variant="secondary"
                          className="w-full gap-2"
                          onClick={() => copyToClipboard(newCreds.tempPassword!, "password")}
                        >
                          {copied === "password" ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                          {copied === "password"
                            ? t("team.students.copied", "Copied")
                            : t("team.students.copyPassword", "Copy password")}
                        </Button>
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
                  /* ── Invite: activation link + status ───────────── */
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
                            : t(
                                "team.students.inviteEmailFailed",
                                "The invitation was created but the email could not be sent — share the link below instead.",
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
                          <Button
                            variant="secondary"
                            className="w-full gap-2"
                            onClick={() => copyToClipboard(newCreds.activationUrl!, "link")}
                          >
                            {copied === "link" ? (
                              <CheckCheck className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                            {copied === "link"
                              ? t("team.students.copied", "Copied")
                              : t("team.students.copyInviteLink", "Copy activation link")}
                          </Button>
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
                )
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

                  {/* Linked Cases */}
                  <div className="space-y-2">
                    <Label>{t("team.students.linkedCases", "Linked Cases")}</Label>
                    {casesLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("team.students.checkingCases", "Checking for linked cases…")}
                      </div>
                    ) : casesError ? (
                      <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {t("team.students.lookupFailed", "Could not look up linked cases.")} {casesError}
                      </p>
                    ) : !form.email.includes("@") ? (
                      <p className="text-xs text-muted-foreground">
                        {t("team.students.enterEmailForCases", "Enter the student's email to see linked cases.")}
                      </p>
                    ) : linkedCases.length === 0 ? (
                      <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                        {t(
                          "team.students.noLinkedCases",
                          "No existing case is linked to this email. The account will be created without a case.",
                        )}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {linkedCases.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedCaseId(c.id)}
                            className={`flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-start transition-colors ${
                              selectedCaseId === c.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="font-mono text-sm font-medium text-foreground" dir="ltr">
                                {c.case_reference || `#${c.id.slice(0, 8)}`}
                              </p>
                              {c.program && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {t("team.students.caseProgram", "Program")}: {c.program}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {t("team.students.caseStatus", "Status")}: {c.status.replace(/_/g, " ")}
                              </p>
                            </div>
                            {selectedCaseId === c.id && <CheckCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                          </button>
                        ))}
                        {linkedCases.length > 1 && (
                          <p className="text-xs text-muted-foreground">
                            {t(
                              "team.students.multipleCasesHint",
                              "Multiple cases found. Select the one to link to this account.",
                            )}
                          </p>
                        )}
                      </div>
                    )}
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
                          className={`rounded-lg border p-3 text-start transition-colors ${mode === opt.key ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
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
      {invitesError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("team.students.invitesLoadFailed", "Could not load pending invitations.")} {invitesError}
        </p>
      )}
      {visibleInvitations.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="border-b px-4 py-3 text-sm font-medium text-foreground">
              {t("team.students.pendingInvites", "Pending invitations")}
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
                      {busyInvite === inv.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
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
        <LoadingState variant="table" rows={5} label={t("team.students.loading")} />

      ) : filtered.length === 0 ? (
        <EmptyState
          icon={User}
          title={search ? t("team.students.noResults") : t("team.students.noStudents", "No student accounts yet")}
          description={!search ? t("team.students.noStudentsHint", "Create a student account to get started.") : undefined}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {studentPagination.items.map((s) => (
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
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{s.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3 shrink-0" />
                      {s.email}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(s.created_at), "d MMM yyyy")}
                  </p>
                </div>
              ))}
            </div>
            <TablePagination pagination={studentPagination} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

