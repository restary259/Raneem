import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Bot, CheckCircle2, Clock3, Inbox, MessageCircle, RefreshCw, Search, ShieldCheck, Sparkles, UserRound, UsersRound } from "lucide-react";
import PageHeader from "@/components/shell/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/shell/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  addInternalNote, listConversationMessages, listConversationNotes, listWhatsAppStaff, listWhatsAppTemplates, listWhatsAppThreads,
  requestWhatsAppAiAssist, updateConversation, updateLead,
  type AiAssistResult, type ConversationState, type LeadStage, type StaffMember, type WhatsAppMessage, type WhatsAppNote, type WhatsAppTemplate, type WhatsAppThread,
} from "@/services/WhatsAppService";

const STATES: ConversationState[] = ["new", "open", "waiting", "resolved"];
const STAGES: LeadStage[] = ["new", "qualified", "consultation_booked", "documents_pending", "application_in_progress", "won", "lost"];
const fmt = (value: string, lang: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-IL" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function WhatsAppInboxPage() {
  const { t, i18n } = useTranslation("whatsapp");
  const { user } = useAuth();
  const { toast } = useToast();
  const mobile = useIsMobile();
  const rtl = i18n.language === "ar";
  const Back = rtl ? ArrowRight : ArrowLeft;
  const [threads, setThreads] = useState<WhatsAppThread[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [notes, setNotes] = useState<WhatsAppNote[]>([]);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [composer, setComposer] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiResult, setAiResult] = useState<AiAssistResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [threadRows, staffRows, templateRows] = await Promise.all([listWhatsAppThreads(), listWhatsAppStaff(), listWhatsAppTemplates()]);
      setThreads(threadRows); setStaff(staffRows); setTemplates(templateRows);
    } catch (e) { setError(e instanceof Error ? e.message : t("errors.load")); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const channel = supabase.channel("whatsapp-workspace")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_leads" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages" }, load)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const active = threads.find((x) => x.id === selectedId) ?? null;
  useEffect(() => {
    setMessages([]); setNotes([]); setAiResult(null); setComposer("");
    if (!selectedId) return;
    Promise.all([listConversationMessages(selectedId), listConversationNotes(selectedId)])
      .then(([m, n]) => { setMessages(m); setNotes(n); })
      .catch(() => toast({ variant: "destructive", description: t("errors.load") }));
  }, [selectedId, t, toast]);

  const filtered = useMemo(() => threads.filter((thread) => {
    const q = query.trim().toLowerCase();
    if (q && !`${thread.lead.student_name} ${thread.lead.whatsapp_number} ${thread.last_message_preview ?? ""}`.toLowerCase().includes(q)) return false;
    if (stateFilter !== "all" && thread.state !== stateFilter) return false;
    if (ownerFilter === "unassigned" && thread.assigned_to) return false;
    if (ownerFilter !== "all" && ownerFilter !== "unassigned" && thread.assigned_to !== ownerFilter) return false;
    if (unreadOnly && thread.unread_count === 0) return false;
    return true;
  }), [threads, query, stateFilter, ownerFilter, unreadOnly]);

  const saveConversation = async (patch: Parameters<typeof updateConversation>[1]) => {
    if (!active) return;
    try { await updateConversation(active.id, patch); await load(); }
    catch { toast({ variant: "destructive", description: t("errors.save") }); }
  };
  const saveLead = async (patch: Parameters<typeof updateLead>[1]) => {
    if (!active) return;
    try { await updateLead(active.lead.id, patch); await load(); toast({ description: t("profile.saved") }); }
    catch { toast({ variant: "destructive", description: t("errors.save") }); }
  };
  const addNote = async () => {
    if (!active || !user || !note.trim()) return;
    try { await addInternalNote(active.id, user.id, note); setNote(""); setNotes(await listConversationNotes(active.id)); }
    catch { toast({ variant: "destructive", description: t("errors.save") }); }
  };
  const generate = async (mode: "welcome" | "qualification" | "summary") => {
    if (!active) return;
    setAiLoading(true);
    try { setAiResult(await requestWhatsAppAiAssist({ mode, lead: active.lead, messages, instruction: aiInstruction, language: rtl ? "ar" : "en" })); }
    catch { toast({ variant: "destructive", description: t("errors.ai") }); }
    finally { setAiLoading(false); }
  };

  const newLeads = threads.filter((x) => x.lead.lead_stage === "new").length;
  const unassigned = threads.filter((x) => !x.assigned_to).length;
  const responseSamples = threads.filter((x) => x.first_response_at).map((x) => (new Date(x.first_response_at!).getTime() - new Date(x.created_at).getTime()) / 60000).filter((x) => x >= 0);
  const responseAvg = responseSamples.length ? Math.round(responseSamples.reduce((a, b) => a + b, 0) / responseSamples.length) : null;

  if (loading) return <LoadingState variant="cards" rows={4} label={t("title")} />;
  if (error) return <ErrorState title={t("errors.load")} description={error} onRetry={load} retryLabel={t("actions.retry")} />;

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="mx-auto w-full max-w-[1800px] pb-20 md:pb-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={<div className="flex items-center gap-2"><Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />{t("connected")}</Badge><Button size="icon" variant="outline" onClick={load} aria-label={t("actions.refresh")}><RefreshCw className="h-4 w-4" /></Button></div>} />
      <Tabs defaultValue="inbox" className="space-y-3">
        <TabsList className="grid w-full grid-cols-3 md:w-[470px]"><TabsTrigger value="inbox">{t("tabs.inbox")}</TabsTrigger><TabsTrigger value="dashboard">{t("tabs.dashboard")}</TabsTrigger><TabsTrigger value="templates">{t("tabs.templates")}</TabsTrigger></TabsList>
        <TabsContent value="inbox" className="m-0">
          <Card className="h-[calc(100dvh-14.5rem)] min-h-[560px] overflow-hidden rounded-xl shadow-none">
            <div className="grid h-full md:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(430px,1fr)_340px]">
              <aside className={cn("flex min-h-0 flex-col border-e", mobile && selectedId && "hidden")}>
                <div className="space-y-2 border-b p-3">
                  <div className="relative"><Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("filters.search")} className="ps-9" /></div>
                  <div className="grid grid-cols-2 gap-2"><Select value={stateFilter} onValueChange={setStateFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("filters.all")}</SelectItem>{STATES.map((s) => <SelectItem key={s} value={s}>{t(`state.${s}`)}</SelectItem>)}</SelectContent></Select><Select value={ownerFilter} onValueChange={setOwnerFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("filters.allOwners")}</SelectItem><SelectItem value="unassigned">{t("filters.unassigned")}</SelectItem>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent></Select></div>
                  <label className="flex items-center justify-between rounded-md border px-3 py-2 text-xs"><span>{t("filters.unread")}</span><Switch checked={unreadOnly} onCheckedChange={setUnreadOnly} /></label>
                </div>
                <ScrollArea className="min-h-0 flex-1">{filtered.length ? <div className="divide-y">{filtered.map((thread) => <button key={thread.id} onClick={() => setSelectedId(thread.id)} className={cn("w-full px-4 py-3 text-start transition-colors hover:bg-muted/60", selectedId === thread.id && "bg-muted")}><div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm font-semibold">{thread.lead.student_name || thread.lead.whatsapp_number}</span>{thread.unread_count > 0 && <Badge className="h-5 min-w-5 justify-center px-1.5">{thread.unread_count}</Badge>}</div><div dir="ltr" className="mt-0.5 text-start text-xs text-muted-foreground">{thread.lead.whatsapp_number}</div><p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{thread.last_message_preview || t("conversation.noMessages")}</p><div className="mt-2 flex items-center justify-between gap-2"><Badge variant="outline" className="font-normal">{t(`state.${thread.state}`)}</Badge><span className="text-[10px] text-muted-foreground">{fmt(thread.updated_at, i18n.language)}</span></div></button>)}</div> : <EmptyState title={t("empty.title")} description={t("empty.description")} icon={MessageCircle} className="h-full" />}</ScrollArea>
              </aside>
              <main className={cn("flex min-h-0 flex-col", mobile && !selectedId && "hidden")}>
                {!active ? <EmptyState title={t("empty.select")} icon={MessageCircle} className="h-full" /> : <>
                  <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5"><Button className="md:hidden" size="icon" variant="ghost" onClick={() => setSelectedId(null)}><Back className="h-4 w-4" /></Button><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{active.lead.student_name || active.lead.whatsapp_number}</h2><p dir="ltr" className="text-start text-xs text-muted-foreground">{active.lead.whatsapp_number}</p></div><Select value={active.state} onValueChange={(v) => saveConversation({ state: v })}><SelectTrigger className="h-9 w-[145px]"><SelectValue /></SelectTrigger><SelectContent>{STATES.map((s) => <SelectItem key={s} value={s}>{t(`state.${s}`)}</SelectItem>)}</SelectContent></Select></div>
                  <Conversation className="min-h-0"><ConversationContent className="gap-3">{messages.length ? messages.map((m) => <Message key={m.id} from={m.direction === "outbound" ? "user" : "assistant"} className={m.direction === "outbound" ? "ms-auto" : "me-auto"}><MessageContent className={cn("rounded-xl px-3 py-2", m.direction === "inbound" && "bg-muted")}><p className="whitespace-pre-wrap">{m.body}</p><span className="text-[10px] text-muted-foreground">{fmt(m.created_at, i18n.language)} · {m.delivery_status}</span></MessageContent></Message>) : <ConversationEmptyState title={t("conversation.noMessages")} description={t("empty.description")} icon={<Inbox className="h-8 w-8" />} />}</ConversationContent><ConversationScrollButton /></Conversation>
                  <div className="border-t p-3"><Textarea value={composer} onChange={(e) => setComposer(e.target.value)} placeholder={t("conversation.composer")} className="min-h-20 resize-none" /><div className="mt-2 flex items-center justify-between gap-2"><p className="max-w-xl text-[11px] text-muted-foreground">{t("conversation.sendUnavailable")}</p><Button disabled><MessageCircle className="me-2 h-4 w-4" />WhatsApp</Button></div></div>
                </>}
              </main>
              <aside className="hidden min-h-0 border-s xl:block">{active ? <ScrollArea className="h-full"><div className="space-y-5 p-4">
                <section className="space-y-3"><h3 className="text-sm font-semibold">{t("profile.title")}</h3><Field label={t("profile.studentName")} value={active.lead.student_name} onBlur={(v) => saveLead({ student_name: v })} /><Field label={t("profile.country")} value={active.lead.country ?? ""} onBlur={(v) => saveLead({ country: v || null })} /><Field label={t("profile.targetCountry")} value={active.lead.target_country ?? ""} onBlur={(v) => saveLead({ target_country: v || null })} /><Field label={t("profile.program")} value={active.lead.desired_program ?? ""} onBlur={(v) => saveLead({ desired_program: v || null })} />
                <div className="grid grid-cols-2 gap-2"><div><Label className="text-xs">{t("profile.stage")}</Label><Select value={active.lead.lead_stage} onValueChange={(v) => saveLead({ lead_stage: v })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{t(`stage.${s}`)}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs">{t("profile.advisor")}</Label><Select value={active.assigned_to ?? "unassigned"} onValueChange={(v) => saveConversation({ assigned_to: v === "unassigned" ? null : v })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unassigned">{t("filters.unassigned")}</SelectItem>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent></Select></div></div>
                <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 p-3"><div><Label>{t("conversation.takeover")}</Label><p className="mt-1 text-[11px] text-muted-foreground">{t("conversation.takeoverHelp")}</p></div><Switch checked={active.human_takeover} onCheckedChange={(checked) => saveConversation({ human_takeover: checked, takeover_by: checked ? user?.id : null, takeover_at: checked ? new Date().toISOString() : null })} /></div></section>
                <section className="space-y-2 border-t pt-4"><h3 className="text-sm font-semibold">{t("notes.title")}</h3><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notes.placeholder")} /><Button size="sm" variant="outline" disabled={!note.trim()} onClick={addNote}>{t("notes.add")}</Button>{notes.length ? notes.map((n) => <div key={n.id} className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"><p className="whitespace-pre-wrap">{n.body}</p><span className="mt-1 block text-[10px] opacity-60">{fmt(n.created_at, i18n.language)}</span></div>) : <p className="text-xs text-muted-foreground">{t("notes.empty")}</p>}</section>
                <section className="space-y-3 border-t pt-4"><div className="flex items-center gap-2"><Bot className="h-4 w-4" /><h3 className="text-sm font-semibold">{t("ai.title")}</h3></div><p className="text-[11px] text-muted-foreground">{t("ai.safe")}</p><Textarea value={aiInstruction} onChange={(e) => setAiInstruction(e.target.value)} placeholder={t("ai.instruction")} /><div className="grid grid-cols-3 gap-1"><Button size="sm" variant="outline" disabled={aiLoading} onClick={() => generate("welcome")}>{t("ai.welcome")}</Button><Button size="sm" variant="outline" disabled={aiLoading} onClick={() => generate("qualification")}>{t("ai.qualification")}</Button><Button size="sm" variant="outline" disabled={aiLoading} onClick={() => generate("summary")}>{t("ai.summary")}</Button></div>{aiLoading && <LoadingState inline label={t("ai.generating")} />}{aiResult && <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-xs">{aiResult.escalation_required && <Badge variant="destructive">{t("ai.escalation")}</Badge>}<p className="whitespace-pre-wrap leading-5">{aiResult.draft}</p>{aiResult.summary && <p className="border-t pt-2 text-muted-foreground">{aiResult.summary}</p>}<Button size="sm" onClick={() => setComposer(aiResult.draft)}>{t("ai.use")}</Button></div>}</section>
              </div></ScrollArea> : <EmptyState title={t("empty.select")} icon={UserRound} className="h-full" />}</aside>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="dashboard" className="m-0 space-y-4"><div className="grid gap-3 sm:grid-cols-3"><Metric icon={Sparkles} label={t("dashboard.newLeads")} value={newLeads} /><Metric icon={UsersRound} label={t("dashboard.unassigned")} value={unassigned} /><Metric icon={Clock3} label={t("dashboard.response")} value={responseAvg === null ? "—" : `${responseAvg} ${t("dashboard.minutes")}`} /></div><Card className="rounded-xl p-5 shadow-none"><h2 className="mb-4 font-semibold">{t("dashboard.byStage")}</h2>{threads.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{STAGES.map((s) => <div key={s} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>{t(`stage.${s}`)}</span><Badge variant="secondary">{threads.filter((x) => x.lead.lead_stage === s).length}</Badge></div>)}</div> : <EmptyState title={t("dashboard.noData")} icon={UsersRound} />}</Card></TabsContent>
        <TabsContent value="templates" className="m-0"><Card className="rounded-xl shadow-none"><div className="border-b p-5"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /><h2 className="font-semibold">{t("templates.title")}</h2></div><p className="mt-1 text-sm text-muted-foreground">{t("templates.required")}</p></div>{templates.length ? <div className="divide-y">{templates.map((x) => <div key={x.id} className="grid gap-2 p-4 text-sm sm:grid-cols-4"><strong>{x.purpose}</strong><span>{x.provider_name}</span><span>{x.language_code}</span><Badge variant="outline" className="w-fit">{x.approval_status}</Badge></div>)}</div> : <EmptyState title={t("templates.noneTitle")} description={t("templates.noneDescription")} icon={ShieldCheck} />}</Card></TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value, onBlur }: { label: string; value: string; onBlur: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <div><Label className="text-xs">{label}</Label><Input className="mt-1" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== value && onBlur(draft)} /></div>;
}
function Metric({ icon: Icon, label, value }: { icon: typeof Inbox; label: string; value: string | number }) {
  return <Card className="rounded-xl p-4 shadow-none"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div><div className="rounded-lg bg-muted p-2.5"><Icon className="h-5 w-5" /></div></div></Card>;
}
