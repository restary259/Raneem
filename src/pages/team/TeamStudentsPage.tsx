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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";  
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
    mode: "invite" | "manual";  
    invited: boolean;  
    alreadyInvited: boolean;  
    invitationFailed: boolean;  
    activationUrl: string | null;  
    tempPassword: string | null;  
  } | null>(null);  
  
  /** 'invite' sends a branded activation email; 'manual' returns a temp password. */  
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
      const { data: { session } } = await supabase.auth.getSession();  
  
      const { data, error } = await supabase.functions.invoke("create-student-from-case", {  
        body: {  
          student_email: email.trim().toLowerCase(),  
          student_full_name: fullName,  
          mode,  
        },  
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
        mode: data.mode === "manual" ? "manual" : "invite",  
        invited: data.invited === true,  
        alreadyInvited: data.already_invited === true,  
        invitationFailed: data.invitation_failed === true,  
        activationUrl: data.activation_url ?? null,  
        tempPassword: data.temp_password ?? null,  
      });  
  
      resetForm();  
      await Promise.all([fetchStudents(), fetchInvitations()]);  
      toast({  
        description: data.mode === "manual"  
          ? t("team.students.accountCreated", "Account created successfully")  
          : t("team.students.createdSuccess"),  
      });  
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
      const { data: { session } } = await supabase.auth.getSession();  
      const { data, error } = await supabase.functions.invoke("create-student-from-case", {  
        body: {  
          student_email: inv.invited_email.trim().toLowerCase(),  
          student_full_name: inv.invited_name || inv.invited_email.split("@")[0],  
          mode: "invite",  
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
          ? t("team.students.inviteAlreadySent", "An activation link was sent recently. Ask the student to check their inbox.")  
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
          <Button variant="outline" size="icon" aria-label={t("common.refresh")} onClick={() => { fetchStudents(); fetchInvitations(); }} title={t("common.refresh")}>  
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
                  {t("team.students.inviteDescription", "Create a student account and send a secure activation link by email.")}  
                </DialogDescription>  
              </DialogHeader>  
  
              {/* ── Success view ────────────────────────────────────── */}  
              {newCreds ? (  
                newCreds.mode === "manual" ? (  
                  /* ── Manual: temporary password ─────────────────── */  
                  <div className="space-y-4 pt-1">  
                    <p className="text-sm text-muted-foreground">  
                      {t("team.students.credentialsHint", "Account created. Share these credentials with the student — they must change the password at first sign-in.")}  
                    </p>  
                    <div className="space-y-3 rounded-lg bg-muted p-4">  
                      <div className="space-y-1">  
                        <p className="text-xs font-medium text-muted-foreground">{t("team.students.emailAddress", "Email")}</p>  
                        <p dir="ltr" className="break-all font-mono text-sm text-foreground">{newCreds.email}</p>  
                      </div>  
                      <div className="space-y-1">  
                        <p className="text-xs font-medium text-muted-foreground">{t("team.students.tempPassword", "Temp Password")}</p>  
                        <p dir="ltr" className="select-all break-all rounded-md bg-background p-2 text-start font-mono text-sm text-foreground">  
                          {newCreds.tempPassword}  
                        </p>  
                      </div>  
                      {newCreds.tempPassword && (  
                        <Button  
                          variant="secondary"  
                          className="w-full gap-2"  
                          onClick={() => copyToClipboard(newCreds.tempPassword!)}  
                        >  
                          {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}  
                          {copied ? t("team.students.copied", "Copied") : t("team.students.copyPassword", "Copy password")}  
                        </Button>  
                      )}  
                    </div>  
                    <Button className="w-full" onClick={() => { setNewCreds(null); setOpen(false); }}>  
                      {t("common.done", "Done")}  
                    </Button>  
                  </div>  
                ) : (  
                  /* ── Invite: activation link