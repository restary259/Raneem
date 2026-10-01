import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CheckCircle2, CreditCard, FileText, Landmark, Loader2, Mail, RefreshCw, Search, Settings2, UserRound, Users, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Tab = "registrations" | "referrers" | "rewards";

interface RegistrationRecord {
  invoice: any;
  case: any;
  payment: any | null;
  referral: any | null;
}

const statusLabel: Record<string, string> = {
  new: "New",
  profile_completion: "Profile completion",
  payment_confirmed: "Payment confirmed",
  submitted: "Submitted",
  enrollment_paid: "Enrolled",
  contacted: "Contacted",
  appointment_scheduled: "Appointment",
};

const paymentLabel: Record<string, string> = {
  pending: "Awaiting payment",
  submitted: "Transfer submitted",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

export default function AdminReferralOperationsPage() {
  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();
  const isRtl = i18n.language === "ar";
  const [tab, setTab] = useState<Tab>("registrations");
  const [records, setRecords] = useState<RegistrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<RegistrationRecord | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [schoolNames, setSchoolNames] = useState<Record<string, { name_en: string; name_ar: string }>>({});
  const [bank, setBank] = useState({ bank_name: "", account_holder: "", iban: "", bic: "" });
  const [savingBank, setSavingBank] = useState(false);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data: invoices, error: invoiceError } = await (supabase as any)
        .from("case_registration_invoices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (invoiceError) throw invoiceError;

      const invoiceRows = invoices ?? [];
      const caseIds = invoiceRows.map((invoice: any) => invoice.case_id).filter(Boolean);
      const invoiceIds = invoiceRows.map((invoice: any) => invoice.id).filter(Boolean);
      const schoolIds = Array.from(new Set(invoiceRows.map((invoice: any) => invoice.school_id).filter(Boolean)));

      const [casesRes, paymentsRes, referralsRes, settingsRes, schoolRes] = await Promise.all([
        caseIds.length
          ? (supabase as any).from("cases").select("id,full_name,phone_number,case_reference,status,assigned_to,referred_by,source,created_at").in("id", caseIds)
          : Promise.resolve({ data: [], error: null }),
        invoiceIds.length
          ? (supabase as any).from("case_registration_payments").select("*").in("invoice_id", invoiceIds).order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        caseIds.length
          ? (supabase as any).from("referrals").select("id,referred_case_id,referrer_user_id,referred_name,referral_type,status,created_at").in("referred_case_id", caseIds)
          : Promise.resolve({ data: [], error: null }),
        (supabase as any).from("platform_settings").select("registration_payment_bank_name,registration_payment_account_holder,registration_payment_iban,registration_payment_bic").limit(1).maybeSingle(),
        schoolIds.length
          ? (supabase as any).from("schools").select("id,name_en,name_ar").in("id", schoolIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (casesRes.error) throw casesRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (referralsRes.error) throw referralsRes.error;

      const caseMap = new Map((casesRes.data ?? []).map((row: any) => [row.id, row]));
      const paymentsByInvoice = new Map<string, any>();
      for (const payment of paymentsRes.data ?? []) {
        if (!paymentsByInvoice.has(payment.invoice_id)) paymentsByInvoice.set(payment.invoice_id, payment);
      }
      const referralByCase = new Map((referralsRes.data ?? []).map((row: any) => [row.referred_case_id, row]));

      setRecords(invoiceRows.map((invoice: any) => ({
        invoice,
        case: caseMap.get(invoice.case_id) ?? null,
        payment: paymentsByInvoice.get(invoice.id) ?? null,
        referral: referralByCase.get(invoice.case_id) ?? null,
      })));

      setSchoolNames(Object.fromEntries(
        ((schoolRes as any).data ?? []).map((school: any) => [
          school.id,
          { name_en: school.name_en, name_ar: school.name_ar },
        ]),
      ));

      const settings = settingsRes.data;
      if (settings) {
        setBank({
          bank_name: settings.registration_payment_bank_name ?? "",
          account_holder: settings.registration_payment_account_holder ?? "",
          iban: settings.registration_payment_iban ?? "",
          bic: settings.registration_payment_bic ?? "",
        });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: t("admin.referralOperations.loadError"), description: error?.message ?? "" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => records.filter((record) => {
    const haystack = [
      record.invoice.student_name,
      record.invoice.invoice_number,
      record.invoice.case_reference,
      record.case?.case_reference,
      record.referral?.referred_name,
      record.invoice.referrer_name,
    ].filter(Boolean).join(" ").toLowerCase();
    const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
    const matchesPayment = paymentFilter === "all" || record.invoice.payment_status === paymentFilter;
    return matchesSearch && matchesPayment;
  }), [records, search, paymentFilter]);

  const counts = useMemo(() => ({
    total: records.length,
    pending: records.filter((r) => r.invoice.payment_status === "pending").length,
    submitted: records.filter((r) => r.invoice.payment_status === "submitted").length,
    paid: records.filter((r) => r.invoice.payment_status === "paid").length,
    failed: records.filter((r) => r.invoice.payment_status === "failed").length,
  }), [records]);

  const referrers = useMemo(() => {
    const grouped = new Map<string, { id: string; name: string; registrations: number; paid: number; pending: number; enrolled: number }>();
    for (const record of records) {
      const id = record.invoice.referrer_user_id ?? record.case?.referred_by ?? "unknown";
      const current = grouped.get(id) ?? {
        id,
        name: record.invoice.referrer_name ?? "Unknown",
        registrations: 0,
        paid: 0,
        pending: 0,
        enrolled: 0,
      };
      current.registrations += 1;
      if (record.invoice.payment_status === "paid") current.paid += 1;
      if (record.invoice.payment_status !== "paid") current.pending += 1;
      if (record.case?.status === "enrollment_paid" || record.case?.status === "enrolled") current.enrolled += 1;
      grouped.set(id, current);
    }
    return Array.from(grouped.values()).sort((a, b) => b.registrations - a.registrations);
  }, [records]);

  const confirmPayment = async (record: RegistrationRecord) => {
    if (!record.payment?.id) return;
    setActing(record.payment.id);
    try {
      const { error } = await (supabase as any).rpc("confirm_registration_payment", {
        p_payment_id: record.payment.id,
        p_reference: record.payment.reference || record.case?.case_reference || null,
      });
      if (error) throw error;
      toast({ title: t("admin.referralOperations.paymentConfirmed") });
      setSelected(null);
      await fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: t("admin.referralOperations.actionFailed"), description: error?.message ?? "" });
    } finally {
      setActing(null);
    }
  };

  const resendInvoice = async (record: RegistrationRecord) => {
    setActing(record.invoice.id);
    try {
      const { error } = await supabase.functions.invoke("send-student-registration-invoice", {
        body: { invoice_id: record.invoice.id },
      });
      if (error) throw error;
      toast({ title: t("admin.referralOperations.invoiceSent") });
      await fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: t("admin.referralOperations.actionFailed"), description: error?.message ?? "" });
    } finally {
      setActing(null);
    }
  };

  const saveBankSettings = async () => {
    setSavingBank(true);
    try {
      const { error } = await (supabase as any).rpc("update_registration_payment_settings", {
        p_bank_name: bank.bank_name,
        p_account_holder: bank.account_holder,
        p_iban: bank.iban,
        p_bic: bank.bic,
      });
      if (error) throw error;
      toast({ title: t("admin.referralOperations.bankSaved") });
    } catch (error: any) {
      toast({ variant: "destructive", title: t("admin.referralOperations.actionFailed"), description: error?.message ?? "" });
    } finally {
      setSavingBank(false);
    }
  };

  const empty = (
    <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
      {t("admin.referralOperations.empty")}
    </div>
  );

  return (
    <div className="w-full min-w-0 space-y-5 p-3 sm:p-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">DARB</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{t("admin.referralOperations.title")}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{t("admin.referralOperations.description")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={refreshing} className="gap-2">
          {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {t("common.refresh")}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label={t("admin.referralOperations.metrics.total")} value={counts.total} />
        <Metric label={t("admin.referralOperations.metrics.pending")} value={counts.pending} />
        <Metric label={t("admin.referralOperations.metrics.transferSubmitted")} value={counts.submitted} />
        <Metric label={t("admin.referralOperations.metrics.paid")} value={counts.paid} />
        <Metric label={t("admin.referralOperations.metrics.failed")} value={counts.failed} />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {([
          ["registrations", t("admin.referralOperations.tabs.registrations"), ReceiptIcon],
          ["referrers", t("admin.referralOperations.tabs.referrers"), Users],
          ["rewards", t("admin.referralOperations.tabs.rewards"), CheckCircle2],
        ] as const).map(([value, label, Icon]) => (
          <button key={value} type="button" onClick={() => setTab(value)} className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium ${tab === value ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="size-4" />{label}
          </button>
        ))}
      </div>

      {tab === "registrations" ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("admin.referralOperations.search")} className="ps-9" />
            </div>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.referralOperations.filters.all")}</SelectItem>
                <SelectItem value="pending">{t("admin.referralOperations.filters.pending")}</SelectItem>
                <SelectItem value="submitted">{t("admin.referralOperations.filters.submitted")}</SelectItem>
                <SelectItem value="paid">{t("admin.referralOperations.filters.paid")}</SelectItem>
                <SelectItem value="failed">{t("admin.referralOperations.filters.failed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3,4,5,6].map((i) => <div key={i} className="h-52 animate-pulse rounded-2xl bg-muted" />)}</div> : filtered.length === 0 ? empty : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((record) => (
                <button key={record.invoice.id} type="button" onClick={() => setSelected(record)} className="text-start">
                  <Card className="h-full transition hover:border-primary/40 hover:shadow-sm">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{record.invoice.student_name}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground" dir="ltr">{record.case?.case_reference ?? "—"}</p>
                        </div>
                        <Badge variant={record.invoice.payment_status === "paid" ? "success" : record.invoice.payment_status === "failed" ? "destructive" : "secondary"}>
                          {paymentLabel[record.invoice.payment_status] ?? record.invoice.payment_status}
                        </Badge>
                      </div>
                      <div className="grid gap-2 text-xs">
                        <Info label={t("admin.referralOperations.fields.referrer")} value={record.invoice.referrer_name} />
                        <Info label={t("admin.referralOperations.fields.type")} value={record.invoice.referral_type === "family" ? t("referralRegistration.family") : t("referralRegistration.friend")} />
                        <Info label={t("admin.referralOperations.fields.school")} value={schoolNames[record.invoice.school_id] ? (i18n.language.startsWith("ar") ? schoolNames[record.invoice.school_id].name_ar : schoolNames[record.invoice.school_id].name_en) : "—"} />
                        <Info label={t("admin.referralOperations.fields.invoice")} value={record.invoice.invoice_number} />
                        <Info label={t("admin.referralOperations.fields.amount")} value={money(record.invoice.total_amount, record.invoice.currency)} dir="ltr" />
                        <Info label={t("admin.referralOperations.fields.status")} value={statusLabel[record.case?.status] ?? record.case?.status} />
                      </div>
                      <div className="flex items-center justify-between pt-1 text-xs text-primary">
                        <span>{t("admin.referralOperations.openCase")}</span><ExternalCaseIcon />
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </>
      ) : tab === "referrers" ? (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("admin.referralOperations.referrersTitle")}</CardTitle></CardHeader>
          <CardContent>
            {referrers.length ? <div className="divide-y divide-border">{referrers.map((row) => (
              <div key={row.id} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1.5fr)_repeat(4,auto)] sm:items-center sm:gap-4">
                <div className="flex min-w-0 items-center gap-2"><UserRound className="size-4 shrink-0 text-muted-foreground" /><span className="truncate font-semibold">{row.name}</span></div>
                <Stat label={t("admin.referralOperations.referrers.registrations")} value={row.registrations} />
                <Stat label={t("admin.referralOperations.referrers.paid")} value={row.paid} />
                <Stat label={t("admin.referralOperations.referrers.pending")} value={row.pending} />
                <Stat label={t("admin.referralOperations.referrers.enrolled")} value={row.enrolled} />
              </div>
            ))}</div> : empty}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("admin.referralOperations.rewardsTitle")}</CardTitle></CardHeader>
          <CardContent>
            {records.length ? <div className="divide-y divide-border">{records.map((record) => (
              <div key={record.invoice.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{record.invoice.referrer_name ?? "—"} → {record.invoice.student_name}</p>
                  <p className="text-xs text-muted-foreground">{record.referral?.status ?? "pending"} · {record.case?.case_reference ?? "—"}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("admin.referralOperations.rewards.currentRule")}
                </div>
              </div>
            ))}</div> : empty}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Settings2 className="size-4" />{t("admin.referralOperations.bankSettings.title")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label={t("admin.referralOperations.bankSettings.bankName")} value={bank.bank_name} onChange={(value) => setBank((b) => ({ ...b, bank_name: value }))} />
          <Field label={t("admin.referralOperations.bankSettings.accountHolder")} value={bank.account_holder} onChange={(value) => setBank((b) => ({ ...b, account_holder: value }))} />
          <Field label={t("admin.referralOperations.bankSettings.iban")} value={bank.iban} onChange={(value) => setBank((b) => ({ ...b, iban: value }))} dir="ltr" />
          <Field label={t("admin.referralOperations.bankSettings.bic")} value={bank.bic} onChange={(value) => setBank((b) => ({ ...b, bic: value }))} dir="ltr" />
          <div className="sm:col-span-2"><Button onClick={saveBankSettings} disabled={savingBank}>{savingBank ? <Loader2 className="me-2 size-4 animate-spin" /> : null}{t("admin.referralOperations.bankSettings.save")}</Button></div>
        </CardContent>
      </Card>

      {selected ? (
        <div className="fixed inset-0 z-50 bg-black/40 p-3 sm:p-6" onClick={() => setSelected(null)}>
          <div className="mx-auto max-h-full w-full max-w-2xl overflow-y-auto rounded-3xl bg-background p-5 shadow-2xl sm:p-7" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("admin.referralOperations.detail.eyebrow")}</p><h2 className="mt-1 text-2xl font-bold">{selected.invoice.student_name}</h2><p className="mt-1 font-mono text-xs text-muted-foreground" dir="ltr">{selected.case?.case_reference}</p></div>
              <button type="button" className="rounded-full border px-3 py-1 text-sm" onClick={() => setSelected(null)}>×</button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <DetailBlock title={t("admin.referralOperations.detail.registration")} icon={<FileText className="size-4" />}>
                <Info label={t("admin.referralOperations.fields.referrer")} value={selected.invoice.referrer_name} />
                <Info label={t("admin.referralOperations.fields.type")} value={selected.invoice.referral_type === "family" ? t("referralRegistration.family") : t("referralRegistration.friend")} />
                <Info label={t("admin.referralOperations.fields.status")} value={statusLabel[selected.case?.status] ?? selected.case?.status} />
                <Info label={t("admin.referralOperations.fields.invoice")} value={selected.invoice.invoice_number} />
              </DetailBlock>

              <DetailBlock title={t("admin.referralOperations.detail.payment")} icon={<WalletCards className="size-4" />}>
                <Info label={t("admin.referralOperations.fields.payment")} value={paymentLabel[selected.invoice.payment_status] ?? selected.invoice.payment_status} />
                <Info label={t("admin.referralOperations.fields.amount")} value={money(selected.invoice.total_amount, selected.invoice.currency)} dir="ltr" />
                <Info label={t("admin.referralOperations.fields.reference")} value={selected.payment?.reference ?? selected.case?.case_reference} dir="ltr" />
                <Info label={t("admin.referralOperations.fields.method")} value={selected.payment?.payment_method ?? "—"} />
              </DetailBlock>
            </div>

            <Separator className="my-5" />

            <DetailBlock title={t("admin.referralOperations.detail.selectedServices")} icon={<GraduationIcon />}>
              {(selected.invoice.items ?? []).map((item: any, index: number) => (
                <div key={index} className="flex items-start justify-between gap-4 py-2 text-sm"><div><p className="font-medium">{i18n.language.startsWith("ar") ? item.name_ar || item.name_en : item.name_en || item.name_ar}</p><p className="text-xs text-muted-foreground">{item.weeks ? item.weeks + " weeks" : item.months ? item.months + " months" : ""}</p></div><span dir="ltr" className="font-semibold">{money(Number(item.total), selected.invoice.currency)}</span></div>
              ))}
            </DetailBlock>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Link to="/admin/cases/$id" params={{ id: selected.case?.id ?? selected.invoice.case_id }} className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"><ExternalCaseIcon />{t("admin.referralOperations.openCase")}</Link>
              <Button variant="outline" onClick={() => resendInvoice(selected)} disabled={acting === selected.invoice.id} className="gap-2"><Mail className="size-4" />{t("admin.referralOperations.detail.resendInvoice")}</Button>
              {selected.payment?.status === "submitted" && (
                <Button onClick={() => confirmPayment(selected)} disabled={acting === selected.payment.id} className="gap-2">
                  {acting === selected.payment.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  {t("admin.referralOperations.detail.confirmPayment")}
                </Button>
              )}
            </div>

            <div className="mt-5 rounded-2xl border bg-muted/20 p-4 text-xs leading-6 text-muted-foreground">
              {t("admin.referralOperations.detail.fullTrace")}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value.toLocaleString("en-US")}</p></CardContent></Card>;
}
function Info({ label, value, dir }: { label: string; value: string | null | undefined; dir?: "ltr" | "rtl" }) {
  return <div className="flex min-w-0 items-start justify-between gap-3 py-1.5"><span className="shrink-0 text-muted-foreground">{label}</span><span dir={dir} className="min-w-0 break-words text-end font-medium">{value || "—"}</span></div>;
}
function DetailBlock({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-2xl border p-4"><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">{icon}{title}</h3>{children}</section>;
}
function Field({ label, value, onChange, dir }: { label: string; value: string; onChange: (value: string) => void; dir?: "ltr" | "rtl" }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Input value={value} onChange={(e) => onChange(e.target.value)} dir={dir} /></div>;
}
function Stat({ label, value }: { label: string; value: number }) {
  return <div><p className="text-[11px] text-muted-foreground">{label}</p><p className="font-semibold">{value.toLocaleString("en-US")}</p></div>;
}
function findItemName(items: any[], kind: string, lang: string) {
  const match = (items ?? []).find((item) => item.kind === kind);
  return match ? (lang === "ar" ? match.name_ar || match.name_en : match.name_en || match.name_ar) : "—";
}
function money(value: number | string | null | undefined, currency: string) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value ?? 0)) + " " + currency;
}
function ReceiptIcon() { return <ReceiptTextIcon />; }
function ReceiptTextIcon() { return <FileText className="size-4" />; }
function ExternalCaseIcon() { return <ExternalIcon />; }
function ExternalIcon() { return <span aria-hidden className="inline-block">↗</span>; }
function GraduationIcon() { return <GraduationCapIcon />; }
function GraduationCapIcon() { return <span aria-hidden className="inline-block"><GraduationGlyph /></span>; }
function GraduationGlyph() { return <span>🎓</span>; }
