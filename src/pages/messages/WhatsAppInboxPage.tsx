import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "@/lib/router-compat";
import { ArrowLeft, ArrowRight, Bot, CheckCircle2, Clock3, FileText, Inbox, MessageCircle, Paperclip, Plus, RefreshCw, Search, ShieldCheck, Sparkles, Tag, UserRound, UsersRound, X } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useChatFullscreen } from "@/components/messages/chatFullscreen";
import WhatsAppIdentityPanel from "@/components/messages/WhatsAppIdentityPanel";
import { requiresApprovedTemplate } from "@/lib/whatsappPolicy";
import { supabase } from "@/integrations/supabase/client";
import {
  addInternalNote, createWhatsAppTemplate, getWhatsAppInboundStatus, listConversationMessages, listConversationNotes, listWhatsAppStaff, listWhatsAppTemplates, listWhatsAppThreads,
  markConversationRead, requestWhatsAppAiAssist, sendWhatsAppMedia, sendWhatsAppTemplate, sendWhatsAppText, setWhatsAppTemplateFlags, startWhatsAppConversation, syncWhatsAppTemplates, updateConversation, updateLead, whatsAppMediaUrl,
  type AiAssistResult, type ConversationState, type LeadStage, type StaffMember, type WhatsAppInboundStatus, type WhatsAppMessage, type WhatsAppNote, type WhatsAppTemplate, type WhatsAppThread,
} from "@/services/WhatsAppService";

const STATES: ConversationState[] = ["new", "open", "waiting", "resolved"];
const STAGES: LeadStage[] = ["new", "qualified", "consultation_booked", "documents_pending", "application_in_progress", "won", "lost"];
const CONSENT = ["unknown", "granted", "declined", "withdrawn"] as const;
const TEMPLATE_PURPOSES = ["inquiry_follow_up", "consultation_confirmation", "document_reminder", "application_update"] as const;
const fmt = (value: string, lang: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-IL" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const fmtDay = (value: string, lang: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-IL" : "en-GB", { dateStyle: "full" }).format(new Date(value));
const KNOWN_TYPES = ["image", "video", "audio", "document", "sticker", "location", "contacts", "reaction"];

export default function WhatsAppInboxPage({
  embedded = false,
  conversationOnly = false,
  conversationId,
  onConversationClose,
  canManageTemplates = false,
  inboxOnly = false,
}: {
  embedded?: boolean;
  conversationOnly?: boolean;
  conversationId?: string;
  onConversationClose?: () => void;
  /** Admin only: show the Templates tab (sync, create, activate, release). */
  canManageTemplates?: boolean;
  /** Team view: render only the inbox — conversations, chat, read-only lead panel with notes. */
  inboxOnly?: boolean;
}) {
  const { t, i18n } = useTranslation("whatsapp");
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const mobile = useIsMobile();
  const rtl = i18n.language === "ar";
  // Match the case/direct inbox behavior: on mobile an open WhatsApp thread
  // owns the whole viewport and the dashboard bottom navigation stays hidden.
  const Back = rtl ? ArrowRight : ArrowLeft;
  const [threads, setThreads] = useState<WhatsAppThread[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(conversationId ?? null);
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateParameters, setTemplateParameters] = useState<string[]>([]);
  const [templateSyncing, setTemplateSyncing] = useState(false);
  const [templatePurpose, setTemplatePurpose] = useState<string>(TEMPLATE_PURPOSES[0]);
  const [templateLanguage, setTemplateLanguage] = useState<"ar" | "en">("ar");
  const [templateCategory, setTemplateCategory] = useState<"UTILITY" | "MARKETING">("UTILITY");
  const [templateBody, setTemplateBody] = useState("");
  const [templateCreating, setTemplateCreating] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [startNumber, setStartNumber] = useState("");
  const [startName, setStartName] = useState("");
  const [starting, setStarting] = useState(false);
  const [inbound, setInbound] = useState<WhatsAppInboundStatus | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useChatFullscreen(!!mobile && !!selectedId);

  // URL deep-link support is intentionally separate from data effects so a
  // shared WhatsApp URL reopens the exact thread after the workspace loads.
  useEffect(() => {
    const requested = searchParams.get("conversation");
    if (!requested || !threads.some((thread) => thread.id === requested)) return;
    setSelectedId((current) => (current === requested ? current : requested));
  }, [searchParams, threads]);

  const load = useCallback(async () => {
    setError("");
    try {
      const [threadRows, staffRows, templateRows, inboundStatus] = await Promise.all([listWhatsAppThreads(), listWhatsAppStaff(), listWhatsAppTemplates(), getWhatsAppInboundStatus()]);
      setThreads(threadRows); setStaff(staffRows); setTemplates(templateRows); setInbound(inboundStatus);
    } catch (e) { setError(e instanceof Error ? e.message : t("errors.load")); }
    finally { setLoading(false); }
  }, [t]);
  const refreshThreads = useCallback(async () => {
    try { setThreads(await listWhatsAppThreads()); }
    catch { toast({ variant: "destructive", description: t("errors.load") }); }
  }, [t, toast]);
  // A burst of inbound rows (message + conversation + status) must cost one refetch, not three.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRefreshThreads = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => { void refreshThreads(); }, 300);
  }, [refreshThreads]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const channel = supabase.channel("whatsapp-workspace")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, queueRefreshThreads)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_leads" }, queueRefreshThreads)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages" }, queueRefreshThreads)
      .subscribe();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [queueRefreshThreads]);

  const active = threads.find((x) => x.id === selectedId) ?? null;
  useEffect(() => {
    if (!conversationId || !threads.some((thread) => thread.id === conversationId)) return;
    setSelectedId((current) => (current === conversationId ? current : conversationId));
  }, [conversationId, threads]);
  // Team members may only pick templates an admin switched on AND released.
  const sendableTemplates = useMemo(
    () => templates.filter((item) => item.approval_status === "APPROVED" && item.is_active !== false && (canManageTemplates || item.available_to_team !== false)),
    [templates, canManageTemplates],
  );
  // WhatsApp only allows free-form replies for 24h after the contact's last message.
  const windowClosed = !!active && requiresApprovedTemplate(active.last_inbound_at);
  const selectedTemplate = templates.find((item) => item.id === templateId) ?? null;
  const selectedTemplateText = useMemo(() => {
    if (!selectedTemplate || !Array.isArray(selectedTemplate.components)) return "";
    const body = selectedTemplate.components.find((item) => item && typeof item === "object" && String((item as Record<string, unknown>).type ?? "").toUpperCase() === "BODY") as Record<string, unknown> | undefined;
    return String(body?.text ?? "");
  }, [selectedTemplate]);
  const parameterCount = useMemo(() => [...selectedTemplateText.matchAll(/{{\s*(\d+)\s*}}/g)].length, [selectedTemplateText]);
  useEffect(() => {
    setMessages([]); setNotes([]); setAiResult(null); setComposer(""); setTemplateId(null); setTemplateParameters([]); setAttachment(null);
    if (!selectedId) return;
    Promise.all([listConversationMessages(selectedId), listConversationNotes(selectedId)])
      .then(([m, n]) => { setMessages(m); setNotes(n); })
      .catch(() => toast({ variant: "destructive", description: t("errors.load") }));
    void markConversationRead(selectedId).catch(() => undefined);
  }, [selectedId, t, toast]);
  useEffect(() => {
    if (!selectedId) return;
    const channel = supabase.channel(`whatsapp-thread-${selectedId}`)
      // "*" so delivery/read ticks (UPDATE on the same row) land too, not just new messages.
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages", filter: `conversation_id=eq.${selectedId}` }, () => {
        void listConversationMessages(selectedId).then(setMessages).catch(() => undefined);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_internal_notes", filter: `conversation_id=eq.${selectedId}` }, () => {
        void listConversationNotes(selectedId).then(setNotes).catch(() => undefined);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [selectedId]);

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
  const reloadConversation = async () => {
    if (!active) return;
    const [nextMessages] = await Promise.all([listConversationMessages(active.id), load()]);
    setMessages(nextMessages);
  };
  const sendReply = async (submittedText?: string) => {
    if (!active || sending) return;
    setSending(true);
    try {
      if (requiresApprovedTemplate(active.last_inbound_at)) {
        if (!templateId) return;
        await sendWhatsAppTemplate(active.id, templateId, templateParameters);
        setTemplateId(null); setTemplateParameters([]);
      } else if (attachment) {
        await sendWhatsAppMedia(active.id, attachment, (submittedText ?? composer).trim());
        setAttachment(null); setComposer("");
      } else {
        const body = (submittedText ?? composer).trim();
        if (!body) return;
        await sendWhatsAppText(active.id, body);
        setComposer("");
      }
      await reloadConversation();
      toast({ description: t("conversation.sent") });
    } catch (e) { toast({ variant: "destructive", description: e instanceof Error ? e.message : t("errors.send") }); }
    finally { setSending(false); }
  };
  const syncTemplates = async () => {
    setTemplateSyncing(true);
    try { const result = await syncWhatsAppTemplates(); setTemplates(await listWhatsAppTemplates()); toast({ description: t("templates.synced", { count: result.synced }) }); }
    catch (e) { toast({ variant: "destructive", description: e instanceof Error ? e.message : t("errors.templates") }); }
    finally { setTemplateSyncing(false); }
  };
  const toggleTemplateFlag = async (id: string, flags: { is_active?: boolean; available_to_team?: boolean }) => {
    const previous = templates;
    setTemplates((current) => current.map((item) => (item.id === id ? { ...item, ...flags } : item)));
    try { await setWhatsAppTemplateFlags(id, flags); }
    catch (e) { setTemplates(previous); toast({ variant: "destructive", description: e instanceof Error ? e.message : t("errors.templates") }); }
  };
  const createTemplate = async () => {
    if (!templateBody.trim()) return;
    setTemplateCreating(true);
    try {
      await createWhatsAppTemplate({ purpose: templatePurpose, language: templateLanguage, category: templateCategory, body: templateBody.trim() });
      setTemplateBody(""); setTemplates(await listWhatsAppTemplates()); toast({ description: t("templates.submitted") });
    } catch (e) { toast({ variant: "destructive", description: e instanceof Error ? e.message : t("errors.templates") }); }
    finally { setTemplateCreating(false); }
  };
  const closeConversation = () => {
    if (conversationOnly) {
      onConversationClose?.();
      return;
    }
    setSelectedId(null);
    const next = new URLSearchParams(searchParams);
    next.delete("conversation");
    next.set("tab", "whatsapp");
    setSearchParams(next, { replace: true });
  };

  const selectConversation = (id: string) => {
    setSelectedId(id);
    const next = new URLSearchParams(searchParams);
    next.set("tab", "whatsapp");
    next.set("conversation", id);
    setSearchParams(next, { replace: true });
  };

  const startConversation = async () => {
    if (!startNumber.trim() || starting) return;
    setStarting(true);
    try {
      const result = await startWhatsAppConversation(startNumber, startName);
      await load();
      selectConversation(result.conversation.id);
      setStartOpen(false); setStartNumber(""); setStartName("");
      toast({ description: result.created ? t("start.created") : t("start.existing") });
    } catch (e) { toast({ variant: "destructive", description: e instanceof Error ? e.message : t("errors.start") }); }
    finally { setStarting(false); }
  };

  const newLeads = threads.filter((x) => x.lead.lead_stage === "new").length;
  const unassigned = threads.filter((x) => !x.assigned_to).length;
  const responseSamples = threads.filter((x) => x.first_response_at).map((x) => (new Date(x.first_response_at!).getTime() - new Date(x.created_at).getTime()) / 60000).filter((x) => x >= 0);
  const responseAvg = responseSamples.length ? Math.round(responseSamples.reduce((a, b) => a + b, 0) / responseSamples.length) : null;

  const receiving = (inbound?.inboundCount ?? 0) > 0;
  const statusLabel = receiving ? t("status.receiving") : t("status.waiting");

  if (loading) return <LoadingState variant="cards" rows={4} label={t("title")} />;
  if (error) return <ErrorState title={t("errors.load")} description={error} onRetry={load} retryLabel={t("actions.retry")} />;

  const conversationOnlyView = (
    <Card className={cn("min-h-0 h-full w-full overflow-hidden rounded-xl shadow-none", mobile && "max-md:fixed max-md:inset-0 max-md:z-50 max-md:h-[100dvh] max-md:rounded-none max-md:border-0")}>
      <div className="flex h-full min-h-0 flex-col">
        {!active ? (
          <EmptyState title={t("empty.select")} icon={MessageCircle} className="flex-1" />
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b bg-card p-2 md:p-3">
              <Button size="icon" variant="ghost" onClick={closeConversation} aria-label={t("actions.back")}>
                <Back className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{active.lead.student_name || active.lead.whatsapp_number}</p>
                <p dir="ltr" className="text-start text-xs text-muted-foreground">{active.lead.whatsapp_number}</p>
              </div>
              <Select value={active.state} onValueChange={(v) => saveConversation({ state: v })}>
                <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>{STATES.map((s) => <SelectItem key={s} value={s}>{t(`state.${s}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <WhatsAppIdentityPanel lead={active.lead} onChanged={() => void load()} />
            <Conversation className="min-h-0 flex-1">
              <ConversationContent className="gap-3">
                {messages.length ? messages.map((m, index) => {
                  const previous = index > 0 ? messages[index - 1] : null;
                  const newDay = !previous || new Date(previous.created_at).toDateString() !== new Date(m.created_at).toDateString();
                  const body = m.body?.trim();
                  const typeLabel = KNOWN_TYPES.includes(m.message_type) ? t(`messageType.${m.message_type}`) : t("messageType.unknown");
                  return (
                    <div key={m.id} className="space-y-3">
                      {newDay && <div className="flex justify-center"><span className="rounded-full bg-muted px-3 py-1 text-[10px] text-muted-foreground">{fmtDay(m.created_at, i18n.language)}</span></div>}
                      <Message from={m.direction === "outbound" ? "user" : "assistant"} className={m.direction === "outbound" ? "ms-auto" : "me-auto"}>
                        <MessageContent className={cn("rounded-xl px-3 py-2", m.direction === "inbound" && "bg-muted")}>
                          {m.message_type !== "text" && <p className="mb-1 text-xs font-medium opacity-80">{typeLabel}</p>}
                          {body ? <p className="whitespace-pre-wrap">{body}</p> : m.message_type === "text" && <p className="text-xs italic opacity-70">{t("messageType.unknown")}</p>}
                          <span className="text-[10px] text-muted-foreground">{fmt(m.created_at, i18n.language)} · {m.delivery_status}</span>
                        </MessageContent>
                      </Message>
                    </div>
                  );
                }) : <ConversationEmptyState title={t("conversation.noMessages")} description={t("empty.description")} icon={<Inbox className="h-8 w-8" />} />}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
            <div className="shrink-0 space-y-2 border-t p-3">
              {/* The typing area is always visible. Outside WhatsApp's 24-hour
                  service window it is locked and the template picker takes over. */}
              <PromptInput onSubmit={({ text }) => void sendReply(text)} className="rounded-lg">
                <PromptInputTextarea
                  value={composer}
                  onChange={(event) => setComposer(event.target.value)}
                  disabled={windowClosed || sending}
                  placeholder={windowClosed ? t("conversation.composerLocked", "Replies are locked until the contact writes again — send an approved template below.") : t("conversation.composer")}
                />
                <PromptInputFooter>
                  <div className="flex min-w-0 items-center gap-2">
                    <input ref={fileRef} type="file" className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(event) => { setAttachment(event.target.files?.[0] ?? null); event.target.value = ""; }} />
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={windowClosed || sending} onClick={() => fileRef.current?.click()} aria-label={t("conversation.attach", "Attach a photo or file")}>
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    {attachment ? (
                      <span className="flex min-w-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">
                        <span className="truncate max-w-[160px]">{attachment.name}</span>
                        <button type="button" onClick={() => setAttachment(null)} aria-label={t("actions.remove", "Remove")}><X className="h-3 w-3" /></button>
                      </span>
                    ) : (
                      <span className="truncate text-[11px] text-muted-foreground">{windowClosed ? t("conversation.windowClosed") : t("conversation.windowOpen")}</span>
                    )}
                  </div>
                  <PromptInputSubmit status={sending ? "submitted" : undefined} disabled={windowClosed || sending || (!composer.trim() && !attachment)} aria-label={t("conversation.send")} />
                </PromptInputFooter>
              </PromptInput>
              {windowClosed && (
                <div className="space-y-2">
                  {sendableTemplates.length ? (
                    <Select value={templateId ?? undefined} onValueChange={(value) => { setTemplateId(value); setTemplateParameters([]); }}>
                      <SelectTrigger><SelectValue placeholder={t("conversation.chooseTemplate")} /></SelectTrigger>
                      <SelectContent>{sendableTemplates.map((item) => <SelectItem key={item.id} value={item.id}>{t(`templates.purpose.${item.purpose}`, item.purpose)} · {item.language_code}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-muted-foreground">{t("conversation.noTemplateReleased", "No approved template has been released yet. Ask an administrator to make one available.")}</p>
                  )}
                  {selectedTemplate && <div className="rounded-md border bg-muted/30 p-3 text-xs"><p className="whitespace-pre-wrap">{selectedTemplateText}</p>{Array.from({ length: parameterCount }, (_, index) => <Input key={index} className="mt-2" value={templateParameters[index] ?? ""} onChange={(event) => setTemplateParameters((current) => { const next = [...current]; next[index] = event.target.value; return next; })} placeholder={t("conversation.templateField", { number: index + 1 })} />)}</div>}
                  <div className="flex justify-end"><Button disabled={!templateId || templateParameters.length < parameterCount || templateParameters.some((value) => !value.trim()) || sending} onClick={() => void sendReply()}><MessageCircle className="me-2 h-4 w-4" />{t("conversation.send")}</Button></div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );

  if (conversationOnly) return conversationOnlyView;

  if (inboxOnly) {
    const advisorName = active?.lead.assigned_advisor ? staff.find((member) => member.id === active.lead.assigned_advisor)?.full_name ?? null : null;
    return (
      <div dir={rtl ? "rtl" : "ltr"} className="mx-auto flex h-full w-full min-w-0 max-w-[1800px] min-h-0 flex-col overflow-hidden">
        <div className="mb-3 shrink-0 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">{t("title")}</h2><p className="text-sm text-muted-foreground">{t("subtitle")}</p></div><WhatsAppActions receiving={receiving} connectedLabel={t("connected")} statusLabel={statusLabel} refreshLabel={t("actions.refresh")} startLabel={t("start.action")} onRefresh={load} onStart={() => setStartOpen(true)} /></div>
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
          {/* Conversations */}
          <Card className={cn("min-h-0 flex-col overflow-hidden rounded-xl shadow-none", "hidden lg:flex")}>
            <div className="shrink-0 space-y-2 border-b p-3">
              <div className="relative"><Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="ps-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("filters.search")} /></div>
              <div className="flex items-center gap-2">
                <Select value={stateFilter} onValueChange={setStateFilter}><SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("filters.all")}</SelectItem>{STATES.map((s) => <SelectItem key={s} value={s}>{t(`state.${s}`)}</SelectItem>)}</SelectContent></Select>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Switch checked={unreadOnly} onCheckedChange={setUnreadOnly} aria-label={t("filters.unread")} />{t("filters.unread")}</label>
              </div>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              {filtered.length ? filtered.map((thread) => (
                <button key={thread.id} type="button" onClick={() => selectConversation(thread.id)} className={cn("flex w-full items-start gap-2 border-b p-3 text-start transition-colors hover:bg-muted/50", thread.id === selectedId && "bg-muted")}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-medium">{thread.lead.student_name || thread.lead.whatsapp_number}</p>{(thread.last_inbound_at ?? thread.last_outbound_at) && <span className="shrink-0 text-[10px] text-muted-foreground">{fmt((thread.last_inbound_at ?? thread.last_outbound_at)!, i18n.language)}</span>}</div>
                    {thread.lead.student_name && <p dir="ltr" className="truncate text-start text-[11px] text-muted-foreground">{thread.lead.whatsapp_number}</p>}
                    <p className="truncate text-xs text-muted-foreground">{thread.last_message_preview ?? t("empty.description")}</p>
                  </div>
                  {thread.unread_count > 0 && <Badge className="shrink-0 rounded-full px-1.5 text-[10px]">{thread.unread_count}</Badge>}
                </button>
              )) : <EmptyState title={t("empty.title")} description={t("empty.description")} icon={MessageCircle} className="p-6" />}
            </ScrollArea>
          </Card>
          {/* Chat */}
          <div className="min-h-0 min-w-0">{conversationOnlyView}</div>
          {/* Lead */}
          <Card className={cn("min-h-0 flex-col overflow-hidden rounded-xl shadow-none", "hidden lg:flex")}>
            {!active ? (
              <EmptyState title={t("empty.select")} icon={UserRound} className="flex-1" />
            ) : (
              <>
                <div className="shrink-0 border-b p-4">
                  <div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-muted-foreground" /><h3 className="font-semibold">{t("profile.title")}</h3></div>
                  <p className="mt-2 truncate text-sm font-medium">{active.lead.student_name || "—"}</p>
                  <p dir="ltr" className="text-start text-xs text-muted-foreground">{active.lead.whatsapp_number}</p>
                  <Badge variant="secondary" className="mt-2">{t(`stage.${active.lead.lead_stage}`, active.lead.lead_stage)}</Badge>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                  <dl className="space-y-3 p-4 text-sm">
                    {([
                      [t("profile.country"), active.lead.country],
                      [t("profile.targetCountry"), active.lead.target_country],
                      [t("profile.program"), active.lead.desired_program],
                      [t("profile.language"), active.lead.language_level],
                      [t("profile.budget"), active.lead.budget_range],
                      [t("profile.start"), active.lead.intended_start_date],
                      [t("profile.advisor"), advisorName],
                      [t("profile.source"), active.lead.source],
                      [t("profile.consent"), t(`consent.${active.lead.consent_status}`, active.lead.consent_status)],
                    ] as [string, string | null][]).map(([label, value]) => (
                      <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5">{value || "—"}</dd></div>
                    ))}
                  </dl>
                  <div className="border-t p-4">
                    <h4 className="text-sm font-semibold">{t("notes.title")}</h4>
                    <div className="mt-2 space-y-2">
                      {notes.length ? notes.map((item) => (
                        <div key={item.id} className="rounded-lg border bg-muted/30 p-2 text-xs">
                          <p className="whitespace-pre-wrap">{item.body}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">{fmt(item.created_at, i18n.language)}</p>
                        </div>
                      )) : <p className="text-xs text-muted-foreground">{t("notes.empty")}</p>}
                    </div>
                    <Textarea className="mt-3 min-h-16 text-sm" value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("notes.placeholder")} />
                    <Button size="sm" className="mt-2 w-full" disabled={!note.trim()} onClick={() => void addNote()}>{t("notes.add")}</Button>
                  </div>
                </ScrollArea>
              </>
            )}
          </Card>
        </div>
        {/* Mobile: list or chat fills the surface */}
        <div className="lg:hidden">
          {!active && (
            <Card className="mt-3 overflow-hidden rounded-xl shadow-none">
              <div className="space-y-2 border-b p-3">
                <div className="relative"><Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="ps-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("filters.search")} /></div>
              </div>
              <ScrollArea className="max-h-[60vh]">
                {filtered.map((thread) => (
                  <button key={thread.id} type="button" onClick={() => selectConversation(thread.id)} className="flex w-full items-start gap-2 border-b p-3 text-start">
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{thread.lead.student_name || thread.lead.whatsapp_number}</p>{thread.lead.student_name && <p dir="ltr" className="truncate text-start text-[11px] text-muted-foreground">{thread.lead.whatsapp_number}</p>}<p className="truncate text-xs text-muted-foreground">{thread.last_message_preview ?? ""}</p></div>
                    {thread.unread_count > 0 && <Badge className="rounded-full px-1.5 text-[10px]">{thread.unread_count}</Badge>}
                  </button>
                ))}
              </ScrollArea>
            </Card>
          )}
        </div>
        <Dialog open={startOpen} onOpenChange={setStartOpen}>
          <DialogContent dir={rtl ? "rtl" : "ltr"}>
            <DialogHeader><DialogTitle>{t("start.title")}</DialogTitle><DialogDescription>{t("start.description")}</DialogDescription></DialogHeader>
            <div className="space-y-3"><div><Label htmlFor="wa-number">{t("profile.number")}</Label><Input id="wa-number" dir="ltr" value={startNumber} onChange={(event) => setStartNumber(event.target.value)} placeholder="0529402168" /></div><div><Label htmlFor="wa-name">{t("profile.studentName")}</Label><Input id="wa-name" value={startName} onChange={(event) => setStartName(event.target.value)} placeholder={t("start.nameOptional")} /></div></div>
            <DialogFooter><Button disabled={!startNumber.trim() || starting} onClick={() => void startConversation()}><MessageCircle className="me-2 h-4 w-4" />{t("start.create")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }


  return (
    <div dir={rtl ? "rtl" : "ltr"} className={cn("mx-auto flex w-full min-w-0 max-w-[1800px] min-h-0 flex-col overflow-hidden", embedded ? "pb-0" : "pb-20 md:pb-4")}>
      {!embedded && <PageHeader title={t("title")} subtitle={t("subtitle")} actions={<WhatsAppActions receiving={receiving} connectedLabel={t("connected")} statusLabel={statusLabel} refreshLabel={t("actions.refresh")} startLabel={t("start.action")} onRefresh={load} onStart={() => setStartOpen(true)} />} />}
      {embedded && <div className="mb-3 shrink-0 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">{t("title")}</h2><p className="text-sm text-muted-foreground">{t("subtitle")}</p></div><WhatsAppActions receiving={receiving} connectedLabel={t("connected")} statusLabel={statusLabel} refreshLabel={t("actions.refresh")} startLabel={t("start.action")} onRefresh={load} onStart={() => setStartOpen(true)} /></div>}
      <div className={cn("mb-3 rounded-lg border p-3 text-xs", receiving ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5")}>
        <p className="font-medium">{t("number")} · {statusLabel}</p>
        <p className="mt-1 text-muted-foreground">{receiving ? t("status.receivingHelp") : t("status.waitingHelp")}</p>
        {inbound?.lastInboundAt && <p className="mt-1 text-muted-foreground">{t("status.lastInbound", { time: fmt(inbound.lastInboundAt, i18n.language) })}</p>}
        {!!inbound?.unrecognisedCount && <p className="mt-1 text-muted-foreground">{t("status.unrecognised", { count: inbound.unrecognisedCount })}</p>}
      </div>
      <Tabs defaultValue="dashboard" className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        {canManageTemplates && <TabsList className="grid w-full max-w-[470px] shrink-0 grid-cols-2 overflow-hidden"><TabsTrigger value="dashboard">{t("tabs.dashboard")}</TabsTrigger><TabsTrigger value="templates">{t("tabs.templates")}</TabsTrigger></TabsList>}
        <TabsContent value="dashboard" className="m-0 min-w-0 space-y-4"><div className="grid gap-3 sm:grid-cols-3"><Metric icon={Sparkles} label={t("dashboard.newLeads")} value={newLeads} /><Metric icon={UsersRound} label={t("dashboard.unassigned")} value={unassigned} /><Metric icon={Clock3} label={t("dashboard.response")} value={responseAvg === null ? "—" : `${responseAvg} ${t("dashboard.minutes")}`} /></div><Card className="rounded-xl p-5 shadow-none"><h2 className="mb-4 font-semibold">{t("dashboard.byStage")}</h2>{threads.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{STAGES.map((s) => <div key={s} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>{t(`stage.${s}`)}</span><Badge variant="secondary">{threads.filter((x) => x.lead.lead_stage === s).length}</Badge></div>)}</div> : <EmptyState title={t("dashboard.noData")} icon={UsersRound} />}</Card></TabsContent>
        {canManageTemplates && <TabsContent value="templates" className="m-0 min-w-0 space-y-3"><Card className="rounded-xl shadow-none"><div className="flex flex-wrap items-start justify-between gap-3 border-b p-5"><div><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /><h2 className="font-semibold">{t("templates.title")}</h2></div><p className="mt-1 text-sm text-muted-foreground">{t("templates.required")}</p></div><Button variant="outline" disabled={templateSyncing} onClick={() => void syncTemplates()}><RefreshCw className={cn("me-2 h-4 w-4", templateSyncing && "animate-spin")} />{t("templates.sync")}</Button></div>{templates.length ? <div className="divide-y">{templates.map((x) => <div key={x.id} className="grid gap-2 p-4 text-sm sm:grid-cols-5"><strong>{t(`templates.purpose.${x.purpose}`, x.purpose)}</strong><span>{x.provider_name}</span><span>{x.language_code}</span><Badge variant="outline" className="w-fit">{x.approval_status}</Badge><div className="flex flex-col gap-2"><label className="flex items-center gap-2 text-xs"><Switch checked={x.is_active !== false} onCheckedChange={(value) => void toggleTemplateFlag(x.id, { is_active: value })} /><span>{t("templates.active", "Active")}</span></label><label className="flex items-center gap-2 text-xs"><Switch checked={x.available_to_team !== false} onCheckedChange={(value) => void toggleTemplateFlag(x.id, { available_to_team: value })} /><span>{t("templates.availableToTeam", "Available to team")}</span></label></div></div>)}</div> : <EmptyState title={t("templates.noneTitle")} description={t("templates.noneDescription")} icon={ShieldCheck} />}</Card><Card className="rounded-xl p-5 shadow-none"><h2 className="font-semibold">{t("templates.createTitle")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("templates.createHelp")}</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><Select value={templatePurpose} onValueChange={setTemplatePurpose}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TEMPLATE_PURPOSES.map((purpose) => <SelectItem key={purpose} value={purpose}>{t(`templates.purpose.${purpose}`)}</SelectItem>)}</SelectContent></Select><Select value={templateLanguage} onValueChange={(value) => setTemplateLanguage(value as "ar" | "en")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ar">{t("templates.arabic")}</SelectItem><SelectItem value="en">{t("templates.english")}</SelectItem></SelectContent></Select><Select value={templateCategory} onValueChange={(value) => setTemplateCategory(value as "UTILITY" | "MARKETING")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="UTILITY">{t("templates.utility")}</SelectItem><SelectItem value="MARKETING">{t("templates.marketing")}</SelectItem></SelectContent></Select></div><Textarea className="mt-3 min-h-28" value={templateBody} onChange={(event) => setTemplateBody(event.target.value)} placeholder={t("templates.bodyPlaceholder")} /><div className="mt-3 flex justify-end"><Button disabled={templateCreating || templateBody.trim().length < 20} onClick={() => void createTemplate()}><Plus className="me-2 h-4 w-4" />{t("templates.submit")}</Button></div></Card></TabsContent>}
      </Tabs>
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent dir={rtl ? "rtl" : "ltr"}>
          <DialogHeader><DialogTitle>{t("start.title")}</DialogTitle><DialogDescription>{t("start.description")}</DialogDescription></DialogHeader>
          <div className="space-y-3"><div><Label htmlFor="wa-number">{t("profile.number")}</Label><Input id="wa-number" dir="ltr" value={startNumber} onChange={(event) => setStartNumber(event.target.value)} placeholder="0529402168" /></div><div><Label htmlFor="wa-name">{t("profile.studentName")}</Label><Input id="wa-name" value={startName} onChange={(event) => setStartName(event.target.value)} placeholder={t("start.nameOptional")} /></div></div>
          <DialogFooter><Button disabled={!startNumber.trim() || starting} onClick={() => void startConversation()}><MessageCircle className="me-2 h-4 w-4" />{t("start.create")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WhatsAppActions({ receiving, connectedLabel, statusLabel, refreshLabel, startLabel, onRefresh, onStart }: { receiving: boolean; connectedLabel: string; statusLabel: string; refreshLabel: string; startLabel: string; onRefresh: () => void; onStart: () => void }) {
  return <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />{connectedLabel}</Badge><Badge variant="outline" className={cn("gap-1.5", receiving ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-300" : "border-amber-500/40 text-amber-700 dark:text-amber-300")}>{statusLabel}</Badge><Button size="sm" variant="outline" onClick={onStart}><Plus className="me-2 h-4 w-4" />{startLabel}</Button><Button size="icon" variant="outline" onClick={onRefresh} aria-label={refreshLabel}><RefreshCw className="h-4 w-4" /></Button></div>;
}

function Field({ label, value, onBlur, type = "text" }: { label: string; value: string; onBlur: (value: string) => void; type?: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <div><Label className="text-xs">{label}</Label><Input type={type} className="mt-1" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== value && onBlur(draft)} /></div>;
}
function TagEditor({ label, tags, onChange, addLabel }: { label: string; tags: string[]; onChange: (tags: string[]) => void; addLabel: string }) {
  const [draft, setDraft] = useState("");
  const add = () => { const tag = draft.trim(); if (!tag || tags.includes(tag)) return; onChange([...tags, tag]); setDraft(""); };
  return <div><Label className="text-xs">{label}</Label><div className="mt-1 flex gap-2"><Input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} placeholder={addLabel} /><Button type="button" size="icon" variant="outline" onClick={add} aria-label={addLabel}><Tag className="h-4 w-4" /></Button></div>{tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{tags.map((tag) => <Badge key={tag} variant="secondary" className="gap-1">{tag}<button type="button" onClick={() => onChange(tags.filter((item) => item !== tag))} aria-label={`${addLabel}: ${tag}`}><X className="h-3 w-3" /></button></Badge>)}</div>}</div>;
}
function Metric({ icon: Icon, label, value }: { icon: typeof Inbox; label: string; value: string | number }) {
  return <Card className="rounded-xl p-4 shadow-none"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div><div className="rounded-lg bg-muted p-2.5"><Icon className="h-5 w-5" /></div></div></Card>;
}

/** Attachments live in a private bucket, so each bubble asks for its own signed link. */
function MediaBubble({ path, mime, filename, openLabel }: { path: string; mime: string | null; filename: string | null; openLabel: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void whatsAppMediaUrl(path).then((signed) => { if (!cancelled) setUrl(signed); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [path]);
  if (!url) return <div className="mb-1 h-24 w-40 animate-pulse rounded-md bg-muted" />;
  if (mime?.startsWith("image/")) return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={filename ?? ""} className="mb-1 max-h-56 rounded-md object-cover" /></a>;
  if (mime?.startsWith("video/")) return <video src={url} controls className="mb-1 max-h-56 rounded-md" />;
  if (mime?.startsWith("audio/")) return <audio src={url} controls className="mb-1 w-56" />;
  return <a href={url} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-2 rounded-md border p-2 text-xs underline"><FileText className="h-4 w-4" />{filename ?? openLabel}</a>;
}
