import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  VISA_INFO_STEPS, TOTAL_VISA_STEPS, completedSteps, isFieldVisible, isLocked, validateStep,
  type VisaInfoData, type VisaInfoField,
} from "@/lib/visaInfoSchema";
import { getVisaInfo, saveVisaInfoSection, submitVisaInfo, type VisaInfoRecord } from "@/services/VisaInfoService";
import VisaInfoFieldsView, { VisaInfoStatusBadge } from "./VisaInfoFieldsView";

const REVIEW = VISA_INFO_STEPS.length;

/** Prefill only from real values already on the student's profile. */
function prefillFromProfile(p: any, email: string | undefined): VisaInfoData {
  if (!p) return {};
  const clean = (o: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "string" && v.trim() !== "")) as Record<string, string>;
  const name = typeof p.full_name === "string" ? p.full_name.trim().split(/\s+/) : [];
  return {
    personal: clean({
      first_names: name.length > 1 ? name.slice(0, -1).join(" ") : name[0],
      surname: name.length > 1 ? name[name.length - 1] : undefined,
      date_of_birth: p.date_of_birth, nationality: p.nationality, eye_color: p.eye_color,
    }),
    contact: clean({ street: p.street, house_number: p.house_number, city: p.residential_city ?? p.city,
      phone: p.phone_number, email: p.email ?? email }),
    passport: clean({ expiry_date: p.passport_expiry }),
    travel: clean({ purpose: "language_course", arrival_date: p.arrival_date }),
  };
}

export default function VisaInfoWizard({ caseId, userId }: { caseId: string; userId: string }) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const [rec, setRec] = useState<VisaInfoRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<VisaInfoData>({});
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [r, prof, auth] = await Promise.all([
        getVisaInfo(caseId),
        (supabase as any).from("profiles")
          .select("full_name, email, phone_number, date_of_birth, nationality, eye_color, passport_expiry, street, house_number, residential_city, city, arrival_date")
          .eq("id", userId).maybeSingle(),
        supabase.auth.getUser(),
      ]);
      const seed = prefillFromProfile(prof?.data, auth.data.user?.email ?? undefined);
      const merged: VisaInfoData = {};
      for (const s of VISA_INFO_STEPS) merged[s.id] = { ...(seed[s.id] ?? {}), ...(r.info[s.id] ?? {}) };
      setData(merged);
      setRec(r);
      setConfirmed(r.info.review?.confirmed === "true");
      setStep(Math.min(r.lastStep ?? 0, REVIEW));
    } catch (e: any) {
      setLoadError(e?.message ?? String(e));
    }
  }, [caseId, userId]);

  useEffect(() => { void load(); }, [load]);

  const locked = isLocked(rec?.status);
  const done = useMemo(() => completedSteps(data), [data]);

  const setField = (sid: string, key: string, v: string) => {
    setData((d) => ({ ...d, [sid]: { ...(d[sid] ?? {}), [key]: v } }));
    setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  };

  const go = (n: number) => { setStep(n); setErrors({}); topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  const saveAndNext = async () => {
    const s = VISA_INFO_STEPS[step];
    const sec = data[s.id] ?? {};
    const errs = validateStep(s, sec);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    // Hidden conditional answers are dropped so stale details never get saved.
    const payload = Object.fromEntries(s.fields.filter((f) => isFieldVisible(f, sec) && (sec[f.key] ?? "") !== "").map((f) => [f.key, sec[f.key].trim()]));
    setSaving(true);
    try {
      await saveVisaInfoSection(caseId, s.id, payload, step + 1);
      setRec((r) => (r ? { ...r, status: r.status === "needs_correction" ? r.status : "in_progress" } : r));
      go(step + 1);
    } catch (e: any) {
      toast({ variant: "destructive", title: t("visaInfo.saveError"), description: e?.message });
    } finally { setSaving(false); }
  };

  const submit = async () => {
    if (!confirmed) return;
    const firstBad = VISA_INFO_STEPS.findIndex((s) => Object.keys(validateStep(s, data[s.id] ?? {})).length > 0);
    if (firstBad >= 0) { toast({ variant: "destructive", title: t("visaInfo.incomplete") }); go(firstBad); return; }
    setSaving(true);
    try {
      await saveVisaInfoSection(caseId, "review", { confirmed: "true" }, REVIEW);
      await submitVisaInfo(caseId);
      toast({ title: t("visaInfo.submitted") });
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: t("visaInfo.saveError"), description: e?.message });
    } finally { setSaving(false); }
  };

  if (loadError) {
    return (
      <Card><CardContent className="space-y-2 p-4 text-sm">
        <p className="text-destructive">{t("visaInfo.loadError")}</p>
        <Button size="sm" variant="outline" onClick={() => void load()}>{t("visaInfo.retry")}</Button>
      </CardContent></Card>
    );
  }
  if (!rec) return <Card><CardContent className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card>;

  const renderField = (sid: string, f: VisaInfoField) => {
    const v = data[sid]?.[f.key] ?? "";
    const id = `visa-${sid}-${f.key}`;
    const err = errors[f.key];
    let control: React.ReactNode;
    if (f.type === "select" || f.type === "yesno") {
      const opts = f.type === "yesno" ? ["yes", "no"] : f.options ?? [];
      control = f.type === "yesno" ? (
        <div className="flex gap-2" role="radiogroup" aria-labelledby={`${id}-l`}>
          {opts.map((o) => (
            <Button key={o} type="button" role="radio" aria-checked={v === o} variant={v === o ? "default" : "outline"}
              className="min-h-11 flex-1" onClick={() => setField(sid, f.key, o)}>{t(`visaInfo.o.${o}`)}</Button>
          ))}
        </div>
      ) : (
        <Select value={v || undefined} onValueChange={(x) => setField(sid, f.key, x)}>
          <SelectTrigger id={id} className="min-h-11"><SelectValue placeholder={t("visaInfo.choose")} /></SelectTrigger>
          <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{t(`visaInfo.o.${o}`)}</SelectItem>)}</SelectContent>
        </Select>
      );
    } else if (f.type === "textarea") {
      control = <Textarea id={id} value={v} maxLength={1500} dir="auto" onChange={(e) => setField(sid, f.key, e.target.value)} />;
    } else {
      control = (
        <Input id={id} className="min-h-11" value={v} dir={f.type === "date" || f.type === "number" || f.key === "email" ? "ltr" : "auto"}
          type={f.type === "date" ? "date" : f.type === "number" ? "number" : f.key === "email" ? "email" : "text"}
          inputMode={f.type === "number" ? "numeric" : undefined} maxLength={200}
          onChange={(e) => setField(sid, f.key, e.target.value)} />
      );
    }
    return (
      <div key={f.key} className={f.type === "textarea" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
        <label id={`${id}-l`} htmlFor={id} className="text-sm font-medium">
          {t(`visaInfo.f.${f.key}`)}
          {f.required ? <span className="text-destructive"> *</span> : <span className="ms-1 text-xs text-muted-foreground">({t("visaInfo.optional")})</span>}
        </label>
        {control}
        {err && <p className="text-xs text-destructive">{t(`visaInfo.err.${err}`)}</p>}
      </div>
    );
  };

  const current = VISA_INFO_STEPS[step];

  return (
    <Card ref={topRef} className="scroll-mt-20">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">{t("visaInfo.title")}</CardTitle>
          <VisaInfoStatusBadge status={rec.status} />
        </div>
        <p className="text-sm text-muted-foreground">{t("visaInfo.intro")}</p>
        <div className="space-y-1">
          <Progress value={(done / VISA_INFO_STEPS.length) * 100} />
          <p className="text-xs text-muted-foreground" dir="ltr">{t("visaInfo.progress", { done, total: VISA_INFO_STEPS.length })}</p>
        </div>
        {rec.status === "needs_correction" && rec.correctionNote && (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <strong>{t("visaInfo.correctionNote")}:</strong> {rec.correctionNote}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {locked ? (
          <>
            <p className="text-sm text-muted-foreground">{t(rec.status === "checked" ? "visaInfo.lockedChecked" : "visaInfo.lockedSubmitted")}</p>
            <VisaInfoFieldsView data={rec.info} />
          </>
        ) : step === REVIEW ? (
          <>
            <h3 className="font-semibold">{t("visaInfo.steps.review")} <span className="text-xs text-muted-foreground" dir="ltr">({TOTAL_VISA_STEPS}/{TOTAL_VISA_STEPS})</span></h3>
            <VisaInfoFieldsView data={data} onEdit={go} />
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={confirmed} onCheckedChange={(c) => setConfirmed(c === true)} className="mt-0.5" />
              {t("visaInfo.confirm")}
            </label>
            <div className="sticky bottom-0 flex gap-2 bg-card pt-2 pb-[env(safe-area-inset-bottom)]">
              <Button variant="outline" className="min-h-11" onClick={() => go(step - 1)}>{t("visaInfo.back")}</Button>
              <Button className="min-h-11 flex-1" disabled={!confirmed || saving} onClick={() => void submit()}>
                {saving && <Loader2 className="h-4 w-4 animate-spin me-1" />}{t("visaInfo.submit")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h3 className="font-semibold">
              {t(`visaInfo.steps.${current.id}`)} <span className="text-xs text-muted-foreground" dir="ltr">({step + 1}/{TOTAL_VISA_STEPS})</span>
            </h3>
            {current.optional && <p className="text-xs text-muted-foreground">{t("visaInfo.familyHint")}</p>}
            {current.id === "family" ? (
              (["father", "mother"] as const).map((g) => (
                <details key={g} className="rounded-lg border border-border p-3" open={g === "father"}>
                  <summary className="cursor-pointer text-sm font-medium">{t(`visaInfo.${g}`)}</summary>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {current.fields.filter((f) => f.group === g).map((f) => renderField(current.id, f))}
                  </div>
                </details>
              ))
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {current.fields.filter((f) => isFieldVisible(f, data[current.id] ?? {})).map((f) => renderField(current.id, f))}
              </div>
            )}
            <div className="sticky bottom-0 flex gap-2 bg-card pt-2 pb-[env(safe-area-inset-bottom)]">
              {step > 0 && <Button variant="outline" className="min-h-11" onClick={() => go(step - 1)}>{t("visaInfo.back")}</Button>}
              <Button className="min-h-11 flex-1" disabled={saving} onClick={() => void saveAndNext()}>
                {saving && <Loader2 className="h-4 w-4 animate-spin me-1" />}{t("visaInfo.continue")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
