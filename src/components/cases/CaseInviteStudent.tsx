import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { readFunctionError, readFunctionErrorBody } from "@/lib/functionError";
import { identityConflictMessage } from "@/lib/identityConflict";

interface Props {
  caseId: string;
  fullName: string;
  phone?: string | null;
  /** Email already captured on the case profile. */
  email: string;
  /** Set once the student account exists. */
  studentUserId: string | null;
  onDone: () => void;
}

/**
 * The team member — not the admin — owns the student invite. The address is
 * pulled from the case profile and only editable until the account exists.
 */
export default function CaseInviteStudent({
  caseId,
  fullName,
  phone,
  email,
  studentUserId,
  onDone,
}: Props) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const [value, setValue] = useState(email);
  const [sending, setSending] = useState(false);

  const invite = async () => {
    const address = value.trim();
    if (!address || !address.includes("@")) {
      toast({ variant: "destructive", description: t("case.invite.invalidEmail") });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-student-from-case", {
        body: {
          case_id: caseId,
          student_email: address,
          student_full_name: fullName,
          student_phone: phone ?? null,
        },
      });
      if (error) {
        const body = await readFunctionErrorBody(error);
        const conflict = identityConflictMessage(body as any, t);
        throw new Error(conflict ?? (await readFunctionError(error)));
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ description: t("case.invite.sent", { email: address }) });
      onDone();
    } catch (err) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="mb-2 flex items-center gap-2">
        {studentUserId ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <Mail className="h-4 w-4 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">
          {studentUserId ? t("case.invite.linkedTitle") : t("case.invite.title")}
        </p>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {studentUserId ? t("case.invite.linkedBody") : t("case.invite.body")}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label className="text-xs">{t("case.fields.studentEmail")}</Label>
          <Input
            type="email"
            className="mt-1"
            value={value}
            disabled={!!studentUserId}
            onChange={(e) => setValue(e.target.value)}
            placeholder="student@email.com"
          />
        </div>
        <Button onClick={invite} disabled={sending} className="gap-1.5">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {studentUserId ? t("case.invite.resend") : t("case.invite.action")}
        </Button>
      </div>
    </div>
  );
}
