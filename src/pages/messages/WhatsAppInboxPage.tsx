import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "@/lib/router-compat";
import { AlarmClock, ArrowLeft, ArrowRight, Bot, CalendarClock, CheckCircle2, Clock3, FileText, Inbox, MessageCircle, Paperclip, Pencil, Plus, RefreshCw, Search, ShieldCheck, Sparkles, Tag, UserRound, UsersRound, X } from "lucide-react";
import PageHeader from "@/components/shell/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/shell/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useAuth } from "@/contexts/AuthContext";
import { useWhatsAppInboxAccess } from "@/hooks/useWhatsAppInboxAccess";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { formatDuration, isWhatsAppSlaOverdue, isWhatsAppSnoozed, normalizeWhatsAppState, serviceWindowRemaining } from "@/lib/whatsappOperational";
import { isDarbBusinessHours } from "@/lib/whatsappBusinessHours";
import { useChatFullscreen } from "@/components/messages/chatFullscreen";
import WhatsAppIdentityPanel from "@/components/messages/WhatsAppIdentityPanel";
import WhatsAppCrmContextPanel from "@/components/messages/WhatsAppCrmContextPanel";
import { requiresApprovedTemplate } from "@/lib/whatsappPolicy";
import { supabase } from "@/integrations/supabase/client";
import {
  addInternalNote, createWhatsAppTemplate, getWhatsAppInboundStatus, listConversationMessages, listConversationNotes, listWhatsAppStaff, listWhatsAppTemplates, listWhatsAppThreads, normalizeWhatsAppNumber,
  markConversationRead, requestWhatsAppAiAssist, resumeWhatsAppConversation, scheduleWhatsAppTemplateFollowUp, sendWhatsAppMedia, sendWhatsAppTemplate, sendWhatsAppText, setWhatsAppConversationAssignment, setWhatsAppTemplateFlags, snoozeWhatsAppConversation, startWhatsAppConversation, syncWhatsAppTemplates, updateConversation, updateLead, whatsAppMediaUrl,
  searchWhatsAppCases, type AiAssistResult, type ConversationState, type LeadStage, type StaffMember, type WhatsAppCaseSearchResult, type WhatsAppInboundStatus, type WhatsAppMessage, type WhatsAppNote, type WhatsAppTemplate, type WhatsAppThread,
} from "@/services/WhatsAppService";

const DISPLAY_STATES: ConversationState[] = ["waiting_for_team", "open", "waiting_for_student", "closed"];
const QUICK_TABS = ["all", "unread", "read", "needsReply"] as const;
type QuickTab = (typeof QUICK_TABS)[number];
const PRIORITIES = ["normal", "high", "urgent"] as const;
const INTENTS = ["medicine", "engineering", "computer_science", "language_course", "visa", "accommodation", "cost", "appointment", "documents", "application_status", "existing_student", "other"] as const;
const LANGUAGES = ["ar", "he", "en", "unknown"] as const;

const QUICK_REPLIES_AR = [
  { id: "hello", label: "ترحيب", text: "أهلاً وسهلاً! شكراً لتواصلك مع درب 🙌 شو حابب تعرف عن الدراسة بألمانيا؟" },
  { id: "major", label: "السؤال عن التخصص", text: "أكيد! شو التخصص أو مجال الدراسة اللي عم تفكّر تدرسه بألمانيا؟" },
  { id: "appointment", label: "اقتراح موعد", text: "أكيد، فينا نرتّبلك استشارة مع فريق درب. أي يوم ووقت بناسبك؟" },
  { id: "apply", label: "إرسال رابط التقديم", text: "بتقدر تعبّي طلبك مع درب من هون: https://darb.agency/apply" },
  { id: "documents", label: "رفع المستندات بشكل آمن", text: "للحفاظ على خصوصية معلوماتك، ارفع المستندات من خلال بوابة درب الآمنة، مش عبر واتساب." },
  { id: "payment", label: "متابعة الدفع", text: "أكيد، بساعدك بخطوات الدفع. شو النقطة اللي بدك توضيح عنها؟" },
];

const APPOINTMENT_TEMPLATE_PRESETS_AR: Record<string, string> = {
  appointment_confirmation: "أهلاً وسهلاً! تم تأكيد موعدك مع فريق درب بخصوص الدراسة بألمانيا. الموعد مثبت عنا، وإذا احتجت أي تعديل، ابعتلنا.",
  appointment_reminder: "أهلاً! تذكير من درب: عندك موعد معنا بكرا بخصوص الدراسة بألمانيا. إذا احتجت تغيّر الموعد، ابعتلنا.",
};
const STAGES: LeadStage[] = ["new", "qualified", "consultation_booked", "documents_pending", "application_in_progress", "won", "lost"];
const CONSENT = ["unknown", "granted", "declined", "withdrawn"] as const;
const TEMPLATE_PURPOSES = ["lead_received", "lead_followup", "inquiry_follow_up", "appointment_invitation", "appointment_confirmation", "consultation_confirmation", "appointment_reminder", "documents_missing", "document_reminder", "profile_incomplete", "document_received", "payment_instruction", "payment_reminder", "payment_confirmed", "application_started", "application_submitted", "application_update", "student_welcome", "enrollment_confirmation", "next_steps", "support_followup", "case_update"] as const;
const fmt = (value: string, lang: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-IL" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const fmtDay = (value: string, lang: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-IL" : "en-GB", { dateStyle: "full" }).format(new Date(value));
const KNOWN_TYPES = ["image", "video", "audio", "document", "sticker", "location", "contacts", "reaction"];

/** needs_reply is derived, never stored: an inbound message that has no later outbound reply and the conversation is not closed. */
function threadNeedsReply(thread: WhatsAppThread): boolean {
  if (!thread.last_inbound_at) return false;
  if (normalizeWhatsAppState(thread.state) === "closed") return false;
  const lastIn = new Date(thread.last_inbound_at).getTime();
  const lastOut = thread.last_outbound_at ? new Date(thread.last_outbound_at).getTime() : Number.NaN;
  return Number.isFinite(lastIn) && (!Number.isFinite(lastOut) || lastIn > lastOut);
}

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
  const { user, role } = useAuth();
  const { canAccess: canAccessWhatsAppInbox, loading: whatsappAccessLoading } = useWhatsAppInboxAccess();
  const { toast } = useToast();
  const mobile = useIsMobile();
  const rtl = i18n.language === "ar";
  // Match the case/direct inbox behavior: on mobile an open WhatsApp thread
  // owns the whole viewport and the dashboard bottom navigation stays hidden.
  const Back = rtl ? ArrowRight : ArrowLeft;
  const isAdmin = role === "admin";
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
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [intentFilter, setIntentFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [slaOnly, setSlaOnly] = useState(false);
  const [snoozedOnly, setSnoozedOnly] = useState(false);
  const [now, setNow] = useState(() => Date.now());
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
  const [templateLanguage, setTemplateLanguage] = useState<"ar" | "en" | "he">("ar");
  const [templateCategory, setTemplateCategory] = useState<"UTILITY" | "MARKETING">("UTILITY");
  const [templateBody, setTemplateBody] = useState("");
  const [templateCreating, setTemplateCreating] = useState(false);

  useEffect(() => {
    if (templateLanguage !== "ar" || templateBody.trim()) return;
    const preset = APPOINTMENT_TEMPLATE_PRESETS_AR[templatePurpose];
    if (preset) setTemplateBody(preset);
  }, [templateLanguage, templatePurpose, templateBody]);

  const [startOpen, setStartOpen] = useState(false);
  const [startQuery, setStartQuery] = useState("");
  const [startResults, setStartResults] = useState<WhatsAppCaseSearchResult[]>([]);
  const [searchingCases, setSearchingCases] = useState(false);
  const [starting, setStarting] = useState(false);
  const [adminTeamPreview, setAdminTeamPreview] = useState(false);
  const [inboxTab, setInboxTab] = useState<QuickTab>("all");
  const teamMode = inboxOnly || (isAdmin && adminTeamPreview);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpTemplateId, setFollowUpTemplateId] = useState<string | null>(null);
  const [followUpParameters, setFollowUpParameters] = useState<string[]>([]);
  const [followUpDueAt, setFollowUpDueAt] = useState("");
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [customSnoozeOpen, setCustomSnoozeOpen] = useState(false);
  const [customSnoozeAt, setCustomSnoozeAt] = useState("");
  const [inbound, setInbound] = useState<WhatsAppInboundStatus | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Editable contact name — lets staff give an inbound WhatsApp contact a name
  // instead of only seeing their phone number.
  const [nameDraft, setNameDraft] = useState("");
  const [editingName, setEditingName] = useState(false);

  useChatFullscreen(!!mobile && !!selectedId);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

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

  useEffect(() => {
    if (role === "team_member" && (whatsappAccessLoading || !canAccessWhatsAppInbox)) {
      setLoading(false);
      return;
    }
    void load();
  }, [load, role, whatsappAccessLoading, canAccessWhatsAppInbox]);
  useEffect(() => {
    if (role === "team_member" && (whatsappAccessLoading || !canAccessWhatsAppInbox)) return;
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
    () => templates.filter(
      (item) =>
        item.approval_status === "APPROVED" &&
        item.is_active !== false &&
        (canManageTemplates || item.available_to_team !== false) &&
        (item.category !== "MARKETING" || active?.lead.marketing_consent_status === "granted"),
    ),
    [templates, canManageTemplates, active?.lead.marketing_consent_status],
  );
  // WhatsApp only allows free-form replies for 24h after the contact's last message.
  const windowClosed = !!active && requiresApprovedTemplate(active.last_inbound_at);
  const windowRemaining = active ? serviceWindowRemaining(active.last_inbound_at, now) : null;
  const activeSlaOverdue = !!active && isWhatsAppSlaOverdue(active, now);
  const activeState = active ? normalizeWhatsAppState(active.state) : null;
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

  const searchMatches = (thread: WhatsAppThread, q: string) =>
    !q || `${thread.lead.student_name} ${thread.lead.whatsapp_number} ${thread.last_message_preview ?? ""}`.toLowerCase().includes(q);

  const quickCounts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = threads.filter((thread) => searchMatches(thread, q));
    return {
      all: rows.length,
      unread: rows.filter((thread) => (thread.unread_count ?? 0) > 0).length,
      read: rows.filter((thread) => (thread.unread_count ?? 0) === 0).length,
      needsReply: rows.filter(threadNeedsReply).length,
    };
  }, [threads, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (teamMode) {
      return threads.filter((thread) => {
        if (!searchMatches(thread, q)) return false;
        switch (inboxTab) {
          case "unread": return (thread.unread_count ?? 0) > 0;
          case "read": return (thread.unread_count ?? 0) === 0;
          case "needsReply": return threadNeedsReply(thread);
          default: return true;
        }
      });
    }
    return threads.filter((thread) => {
      const operationalState = normalizeWhatsAppState(thread.state);
      if (!searchMatches(thread, q)) return false;
      if (stateFilter !== "all" && operationalState !== stateFilter) return false;
      if (ownerFilter === "unassigned" && thread.assigned_to) return false;
      if (ownerFilter === "__mine__" && thread.assigned_to !== user?.id) return false;
      if (ownerFilter !== "all" && ownerFilter !== "unassigned" && ownerFilter !== "__mine__" && thread.assigned_to !== ownerFilter) return false;
      if (unreadOnly && thread.unread_count === 0) return false;
      if (priorityFilter !== "all" && thread.priority !== priorityFilter) return false;
      if (intentFilter !== "all" && (thread.intent ?? "other") !== intentFilter) return false;
      if (languageFilter !== "all" && (thread.language_code ?? "unknown") !== languageFilter) return false;
      if (slaOnly && !isWhatsAppSlaOverdue(thread, now)) return false;
      if (snoozedOnly && !isWhatsAppSnoozed("snoozed", thread.snoozed_until, now)) return false;
      return true;
    });
  }, [threads, query, teamMode, inboxTab, stateFilter, ownerFilter, unreadOnly, priorityFilter, intentFilter, languageFilter, slaOnly, snoozedOnly, now, user?.id]);

  const saveConversation = async (patch: Parameters<typeof updateConversation>[1]) => {
    if (!active) return;
    try { await updateConversation(active.id, patch); await load(); }
    catch { toast({ variant: "destructive", description: t("errors.save") }); }
  };

  const snoozeConversation = async (durationMs: number) => {
    if (!active) return;
    try {
      await snoozeWhatsAppConversation(active.id, new Date(Date.now() + durationMs).toISOString());
      await load();
    } catch (error) {
      toast({ variant: "destructive", description: error instanceof Error ? error.message : t("errors.save") });
    }
  };

  const unsnoozeConversation = async () => {
    if (!active) return;
    try {
      await resumeWhatsAppConversation(active.id);
      await load();
    } catch (error) {
      toast({ variant: "destructive", description: error instanceof Error ? error.message : t("errors.save") });
    }
  };

  const applyCustomSnooze = async () => {
    if (!active || !customSnoozeAt) return;
    const due = new Date(customSnoozeAt);
    if (!Number.isFinite(due.getTime()) || due.getTime() <= Date.now()) {
      toast({ variant: "destructive", description: t("snooze.invalidTime") });
      return;
    }
    try {
      await snoozeWhatsAppConversation(active.id, due.toISOString());
      setCustomSnoozeOpen(false);
      setCustomSnoozeAt("");
      await load();
    } catch (error) {
      toast({ variant: "destructive", description: error instanceof Error ? error.message : t("errors.save") });
    }
  };

  const assignConversation = async (assignedTo: string | null) => {
    if (!active) return;
    try {
      await setWhatsAppConversationAssignment(active.id, assignedTo);
      await load();
    } catch (error) {
      toast({ variant: "destructive", description: error instanceof Error ? error.message : t("errors.save") });
    }
  };

  const scheduleFollowUp = async () => {
    if (!active || !followUpTemplateId || !followUpDueAt || followUpSaving) return;
    const due = new Date(followUpDueAt);
    if (!Number.isFinite(due.getTime()) || due.getTime() <= Date.now()) {
      toast({ variant: "destructive", description: t("snooze.invalidTime") });
      return;
    }
    setFollowUpSaving(true);
    try {
      await scheduleWhatsAppTemplateFollowUp(active.id, due.toISOString(), followUpTemplateId, followUpParameters);
      setFollowUpOpen(false);
      setFollowUpTemplateId(null);
      setFollowUpParameters([]);
      setFollowUpDueAt("");
      toast({ description: t("snooze.scheduled") });
    } catch (error) {
      toast({ variant: "destructive", description: error instanceof Error ? error.message : t("errors.save") });
    } finally {
      setFollowUpSaving(false);
    }
  };
  const saveLead = async (patch: Parameters<typeof updateLead>[1]) => {
    if (!active) return;
    try { await updateLead(active.lead.id, patch); await load(); toast({ description: t("profile.saved") }); }
    catch { toast({ variant: "destructive", description: t("errors.save") }); }
  };
  useEffect(() => {
    setNameDraft(active?.lead.student_name ?? "");
    setEditingName(false);
  }, [selectedId, active?.lead.student_name]);
  const startEditingName = () => {
    setNameDraft(active?.lead.student_name ?? "");
    setEditingName(true);
  };
  const saveName = async () => {
    if (!active) { setEditingName(false); return; }
    const value = (nameDraft ?? "").trim().slice(0, 200);
    try {
      setEditingName(false);
      if (value && value !== (active.lead.student_name ?? "")) {
        await saveLead({ student_name: value });
      } else {
        setNameDraft(active.lead.student_name ?? "");
      }
    } catch {
      setNameDraft(active.lead.student_name ?? "");
    }
  };
  const addNote = async () => {
    if (!active || !user || !note.trim()) return;
    try { await addInternalNote(active.id, user.id, note); setNote(""); setNotes(await listConversationNotes(active.id)); }
    catch { toast({ variant: "destructive", description: t("errors.save") }); }
  };
  const generate = async (mode: "welcome" | "qualification" | "summary") => {
    if (!active) return;
    setAiLoading(true);
    try {
      const aiLanguage = active.language_code === "he" ? "he" : active.language_code === "en" ? "en" : rtl ? "ar" : "en";
      setAiResult(await requestWhatsAppAiAssist({ mode, lead: active.lead, messages, instruction: aiInstruction, language: aiLanguage }));
    }
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

  const clearStartDialog = () => { setStartOpen(false); setStartQuery(""); setStartResults([]); setSearchingCases(false); };

  const openNewConversation = async (raw: string, name = "", target?: { case_id?: string; lead_id?: string; profile_id?: string }) => {
    if (starting) return;
    const normalized = normalizeWhatsAppNumber(raw) ?? raw;
    // Never create a duplicate: an existing thread for this number is opened instead.
    const existing = threads.find((thread) => thread.lead.whatsapp_number && normalizeWhatsAppNumber(thread.lead.whatsapp_number) === normalized);
    if (existing) {
      selectConversation(existing.id);
      clearStartDialog();
      toast({ description: t("start.existing") });
      return;
    }
    setStarting(true);
    try {
      const result = await startWhatsAppConversation(normalized, name, target);
      await load();
      selectConversation(result.conversation.id);
      clearStartDialog();
      toast({ description: result.created ? t("start.created") : t("start.existing") });
    } catch (e) { toast({ variant: "destructive", description: e instanceof Error ? e.message : t("errors.start") }); }
    finally { setStarting(false); }
  };

  const startSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleStartQuery = (value: string) => {
    setStartQuery(value);
    if (startSearchTimer.current) clearTimeout(startSearchTimer.current);
    const q = value.trim();
    if (q.length < 2) { setStartResults([]); setSearchingCases(false); return; }
    setSearchingCases(true);
    startSearchTimer.current = setTimeout(() => {
      void searchWhatsAppCases(q)
        .then((rows) => { setStartResults(rows); setSearchingCases(false); })
        .catch(() => { setStartResults([]); setSearchingCases(false); });
    }, 250);
  };
  const normalizedStartNumber = normalizeWhatsAppNumber(startQuery.trim());

  const newLeads = threads.filter((x) => x.lead.lead_stage === "new").length;
  const unassigned = threads.filter((x) => !x.assigned_to).length;
  const slaOverdue = threads.filter((x) => isWhatsAppSlaOverdue(x, now)).length;
  const snoozed = threads.filter((x) => isWhatsAppSnoozed("snoozed", x.snoozed_until, now)).length;
  const waitingForTeam = threads.filter((x) => normalizeWhatsAppState(x.state) === "waiting_for_team").length;
  const intentSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const thread of threads) {
      const intent = thread.intent ?? "other";
      counts.set(intent, (counts.get(intent) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [threads]);
  const campaignSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const thread of threads) {
      const campaign = thread.campaign_key?.trim();
      if (!campaign) continue;
      counts.set(campaign, (counts.get(campaign) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [threads]);
  const responseSamples = threads.filter((x) => x.first_response_at).map((x) => (new Date(x.first_response_at!).getTime() - new Date(x.created_at).getTime()) / 60000).filter((x) => x >= 0);
  const responseAvg = responseSamples.length ? Math.round(responseSamples.reduce((a, b) => a + b, 0) / responseSamples.length) : null;

  const receiving = (inbound?.inboundCount ?? 0) > 0;
  const businessHoursOpen = isDarbBusinessHours(new Date(now));
  const statusLabel = receiving ? t("status.receiving") : t("status.waiting");

  if (role === "team_member" && whatsappAccessLoading) {
    return <LoadingState variant="cards" rows={4} label={t("title")} />;
  }

  if (role === "team_member" && !canAccessWhatsAppInbox) {
    return (
      <div dir={rtl ? "rtl" : "ltr"} className="flex min-h-[320px] items-center justify-center p-6">
        <Card className="w-full max-w-md rounded-xl border-dashed p-6 text-center shadow-none">
          <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-3 text-base font-semibold">{t("access.title", "WhatsApp inbox unavailable")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("access.description", "Your administrator has not enabled the shared WhatsApp inbox for your account. Use the WhatsApp button inside a case profile to contact that case directly.")}
          </p>
        </Card>
      </div>
    );
  }

  if (loading) return <LoadingState variant="cards" rows={4} label={t("title")} />;
  if (error) return <ErrorState title={t("errors.load")} description={error} onRetry={load} retryLabel={t("actions.retry")} />;

  const conversationOnlyView = (
    <Card className={cn("min-h-0 h-full max-h-full w-full overflow-hidden rounded-xl shadow-none", mobile && "max-md:fixed max-md:inset-0 max-md:z-50 max-md:h-[100dvh] max-md:rounded-none max-md:border-0")}>
      <div className="flex h-full min-h-0 flex-col">
        {!active ? (
          <EmptyState title={t("empty.select")} description={t("empty.description")} icon={MessageCircle} className="flex-1" />
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b bg-card p-2 md:p-3">
              <Button size="icon" variant="ghost" onClick={closeConversation} aria-label={t("actions.back")}>
                <Back className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                {editingName ? (
                  <Input
                    autoFocus
                    dir="auto"
                    className="h-7 max-w-[200px] bg-background text-sm font-semibold"
                    value={nameDraft}
                    placeholder={active.lead.whatsapp_number}
                    maxLength={200}
                    onChange={(event) => setNameDraft(event.target.value)}
                    onBlur={() => void saveName()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void saveName();
                      if (event.key === "Escape") { setNameDraft(active.lead.student_name ?? ""); setEditingName(false); }
                    }}
                    aria-label={t("profile.editName")}
                  />
                ) : (
                  <button type="button" onClick={startEditingName} className="flex min-w-0 max-w-full items-center gap-1.5 text-start" aria-label={active.lead.student_name ? t("profile.editName") : t("profile.enterName")}>
                    <p className="truncate text-sm font-semibold">{active.lead.student_name || active.lead.whatsapp_number}</p>
                    <Pencil className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </button>
                )}
                <p dir="ltr" className="text-start text-xs text-muted-foreground">{active.lead.whatsapp_number}</p>
              </div>
              {!teamMode && (
                  <Badge variant={active.lead.marketing_consent_status === "withdrawn" ? "destructive" : active.lead.marketing_consent_status === "granted" ? "secondary" : "outline"} className="hidden shrink-0 text-[10px] md:inline-flex">
                    {t(`consent.${active.lead.marketing_consent_status ?? "unknown"}`, active.lead.marketing_consent_status ?? "unknown")}
                  </Badge>
                )}
                {!teamMode && (
                  <div className="hidden items-center gap-1.5 sm:flex">
                    <Badge variant={active.priority === "urgent" ? "destructive" : "outline"} className="text-[10px] uppercase">{t(`priority.${active.priority ?? "normal"}`, active.priority ?? "normal")}</Badge>
                    {activeState === "snoozed" && isWhatsAppSnoozed(active.state, active.snoozed_until, now) && <Badge variant="outline" className="gap-1 text-[10px]"><AlarmClock className="h-3 w-3" />{formatDuration(new Date(active.snoozed_until!).getTime() - now)}</Badge>}
                    {activeSlaOverdue && <Badge variant="destructive" className="gap-1 text-[10px]"><Clock3 className="h-3 w-3" />{t("sla.overdue")}</Badge>}
                  </div>
                )}
              <Select value={activeState ?? "open"} onValueChange={(v) => saveConversation({ state: v })}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>{DISPLAY_STATES.map((s) => <SelectItem key={s} value={s}>{t(`state.${s}`, s)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <WhatsAppIdentityPanel lead={active.lead} onChanged={() => void load()} />
            <div className="lg:hidden"><WhatsAppCrmContextPanel lead={active.lead} compact /></div>
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
              <Conversation className="flex min-h-0 min-w-0 flex-1">
                <ConversationContent className="min-h-0 min-w-0 flex-1 gap-3">
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
                          {m.media_url ? <MediaBubble path={m.media_url} mime={m.media_mime_type} filename={m.media_filename} openLabel={t("conversation.openFile", "Open file")} /> : m.message_type !== "text" && <p className="mb-1 text-xs font-medium opacity-80">{typeLabel}</p>}
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
            </div>
            <div className="shrink-0 space-y-2 border-t p-3">
              <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs", windowClosed ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5")}>
                <div className="flex items-center gap-2"><Clock3 className="h-3.5 w-3.5" /><span className="font-medium">{windowClosed ? t("conversation.windowClosed") : t("conversation.windowOpen")}</span></div>
                <span className="text-muted-foreground">{windowClosed ? t("conversation.templateRequired") : t("conversation.remaining", { time: formatDuration(windowRemaining) })}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!teamMode && (
                  <>
                    <Select value={active.assigned_to ?? "unassigned"} onValueChange={(value) => void assignConversation(value === "unassigned" ? null : value)}>
                      <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">{t("filters.unassigned")}</SelectItem>
                        {staff.filter((member) => role === "admin" || member.id === user?.id).map((member) => <SelectItem key={member.id} value={member.id}>{member.id === user?.id ? t("filters.mine") : member.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={active.priority ?? "normal"} onValueChange={(value) => void saveConversation({ priority: value })}><SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{t(`priority.${priority}`, priority)}</SelectItem>)}</SelectContent></Select>
                    {activeState === "snoozed" ? <Button size="sm" variant="outline" onClick={() => void unsnoozeConversation()}><AlarmClock className="me-1.5 h-3.5 w-3.5" />{t("snooze.unsnooze")}</Button> : <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline"><AlarmClock className="me-1.5 h-3.5 w-3.5" />{t("snooze.action")}</Button></DropdownMenuTrigger><DropdownMenuContent align={rtl ? "start" : "end"}><DropdownMenuItem onSelect={() => void snoozeConversation(60 * 60 * 1000)}>{t("snooze.hour")}</DropdownMenuItem><DropdownMenuItem onSelect={() => void snoozeConversation(24 * 60 * 60 * 1000)}>{t("snooze.tomorrow")}</DropdownMenuItem><DropdownMenuItem onSelect={() => void snoozeConversation(3 * 24 * 60 * 60 * 1000)}>{t("snooze.threeDays")}</DropdownMenuItem><DropdownMenuItem onSelect={() => setCustomSnoozeOpen(true)}>{t("snooze.custom")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
                    <Button size="sm" variant="outline" onClick={() => setFollowUpOpen(true)}><CalendarClock className="me-1.5 h-3.5 w-3.5" />{t("snooze.schedule")}</Button>
                  </>
                )}
                <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="ghost"><MessageCircle className="me-1.5 h-3.5 w-3.5" />{t("quickActions.title")}</Button></DropdownMenuTrigger><DropdownMenuContent align={rtl ? "start" : "end"} className="w-64">{QUICK_REPLIES_AR.map((item) => <DropdownMenuItem key={item.id} onSelect={() => setComposer(item.text)}>{item.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
              </div>
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

  const advisorName = active?.lead.assigned_advisor ? staff.find((member) => member.id === active.lead.assigned_advisor)?.full_name ?? null : null;

  const adminTeamToggle = (
    <div className="flex items-center rounded-md bg-muted p-0.5 text-xs" role="group" aria-label={t("tabs.viewToggle", "View")}>
      <button type="button" aria-pressed={!teamMode} onClick={() => setAdminTeamPreview(false)} className={cn("rounded px-2.5 py-1 font-medium", !teamMode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{t("tabs.admin", "Admin")}</button>
      <button type="button" aria-pressed={teamMode} onClick={() => setAdminTeamPreview(true)} className={cn("rounded px-2.5 py-1 font-medium", teamMode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{t("tabs.team", "Team view")}</button>
    </div>
  );

  const quickTabs = (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
      {QUICK_TABS.map((key) => (
        <button key={key} type="button" aria-pressed={inboxTab === key} onClick={() => setInboxTab(key)} className={cn("flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors", inboxTab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {t(`quick.${key}`, key)} <span className="ms-1 opacity-60">{quickCounts[key]}</span>
        </button>
      ))}
    </div>
  );

  const inboxWorkspace = (simplified: boolean) => (
    <>
      {/* The student panel only appears once a conversation is open, so the
          inbox never shows two identical "choose a conversation" panels. */}
      <div className={cn("grid min-h-0 flex-1 gap-3", active ? "lg:grid-cols-[300px_minmax(0,1fr)_320px]" : "lg:grid-cols-[320px_minmax(0,1fr)]")}>

        {/* Conversations */}
        <Card className={cn("min-h-0 flex-col overflow-hidden rounded-xl shadow-none", "hidden lg:flex")}>
          <div className="shrink-0 space-y-2 border-b p-3">
            <div className="relative"><Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="ps-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("filters.search")} /></div>
            {simplified ? quickTabs : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={stateFilter} onValueChange={setStateFilter}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("filters.all")}</SelectItem>{DISPLAY_STATES.map((s) => <SelectItem key={s} value={s}>{t(`state.${s}`, s)}</SelectItem>)}</SelectContent></Select>
                  <Select value={ownerFilter} onValueChange={setOwnerFilter}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("filters.allOwners")}</SelectItem><SelectItem value="__mine__">{t("filters.mine")}</SelectItem><SelectItem value="unassigned">{t("filters.unassigned")}</SelectItem>{staff.map((member) => <SelectItem key={member.id} value={member.id}>{member.full_name}</SelectItem>)}</SelectContent></Select>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("filters.allPriorities")}</SelectItem>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{t(`priority.${p}`, p)}</SelectItem>)}</SelectContent></Select>
                  <Select value={intentFilter} onValueChange={setIntentFilter}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("filters.allIntents")}</SelectItem>{INTENTS.map((intent) => <SelectItem key={intent} value={intent}>{t(`intent.${intent}`, intent)}</SelectItem>)}</SelectContent></Select>
                  <Select value={languageFilter} onValueChange={setLanguageFilter}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("filters.allLanguages")}</SelectItem>{LANGUAGES.map((language) => <SelectItem key={language} value={language}>{t(`language.${language}`, language)}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Switch checked={unreadOnly} onCheckedChange={setUnreadOnly} aria-label={t("filters.unread")} />{t("filters.unread")}</label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Switch checked={slaOnly} onCheckedChange={setSlaOnly} aria-label={t("filters.sla")} />{t("filters.sla")}</label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Switch checked={snoozedOnly} onCheckedChange={setSnoozedOnly} aria-label={t("filters.snoozed")} />{t("filters.snoozed")}</label>
                </div>
              </>
            )}
          </div>
          {/* The viewport child must be a block so long previews truncate
              instead of stretching the row past the panel. */}
          <ScrollArea className="min-h-0 flex-1 [&>[data-radix-scroll-area-viewport]>div]:!block">
            {filtered.length ? filtered.map((thread) => (
              <button key={thread.id} type="button" onClick={() => selectConversation(thread.id)} className={cn("flex w-full items-start gap-2 border-b p-3 text-start transition-colors hover:bg-muted/50", thread.id === selectedId && "bg-muted")}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-medium">{thread.lead.student_name || thread.lead.whatsapp_number}</p>{(thread.last_inbound_at ?? thread.last_outbound_at) && <span className="shrink-0 text-[10px] text-muted-foreground">{fmt((thread.last_inbound_at ?? thread.last_outbound_at)!, i18n.language)}</span>}</div>
                  {thread.lead.student_name && <p dir="ltr" className="truncate text-start text-[11px] text-muted-foreground">{thread.lead.whatsapp_number}</p>}
                  <p className="truncate text-xs text-muted-foreground">{thread.last_message_preview ?? t("empty.description")}</p>
                  {!simplified && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <Badge variant="outline" className="text-[9px]">{t(`state.${normalizeWhatsAppState(thread.state)}`, normalizeWhatsAppState(thread.state))}</Badge>
                      {thread.priority !== "normal" && <Badge variant={thread.priority === "urgent" ? "destructive" : "outline"} className="text-[9px]">{t(`priority.${thread.priority}`, thread.priority)}</Badge>}
                      {thread.intent && <Badge variant="secondary" className="text-[9px]">{t(`intent.${thread.intent}`, thread.intent)}</Badge>}
                      {isWhatsAppSlaOverdue(thread, now) && <Badge variant="destructive" className="text-[9px]">{t("sla.overdue")}</Badge>}
                    </div>
                  )}
                </div>
                {thread.unread_count > 0 && <Badge className="shrink-0 rounded-full px-1.5 text-[10px]">{thread.unread_count}</Badge>}
              </button>
            )) : <EmptyState title={t("empty.title")} description={t("empty.description")} icon={MessageCircle} className="p-6" />}
          </ScrollArea>
        </Card>
        {/* Chat — desktop only when browsing the inbox; mobile uses the dedicated
            conversation-only view after a thread is selected. */}
        <div className={cn(
          "min-h-0 min-w-0",
          active ? "block" : "hidden lg:block",
        )}>
          {conversationOnlyView}
        </div>
        {/* Lead — quiet for the team (name, stage, CRM context, notes);
            full contact + operational metadata for admins. */}
        <Card className={cn("min-h-0 flex-col overflow-hidden rounded-xl shadow-none", active ? "hidden lg:flex" : "hidden")}>
          {!active ? null : (
            <>
              <div className="shrink-0 border-b p-4">
                <div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-muted-foreground" /><h3 className="font-semibold">{t("profile.title")}</h3></div>
                <div className="mt-2 flex items-center gap-1.5">
                  {editingName ? (
                    <Input
                      autoFocus
                      dir="auto"
                      className="h-8 text-sm font-medium"
                      value={nameDraft}
                      placeholder={active.lead.whatsapp_number}
                      maxLength={200}
                      onChange={(event) => setNameDraft(event.target.value)}
                      onBlur={() => void saveName()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void saveName();
                        if (event.key === "Escape") { setNameDraft(active.lead.student_name ?? ""); setEditingName(false); }
                      }}
                      aria-label={t("profile.editName")}
                    />
                  ) : (
                    <button type="button" onClick={startEditingName} className="flex min-w-0 items-center gap-1.5 text-start" aria-label={t("profile.editName")}>
                      <p className="truncate text-sm font-medium">{active.lead.student_name || "—"}</p>
                      <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  )}
                </div>
                <p dir="ltr" className="text-start text-xs text-muted-foreground">{active.lead.whatsapp_number}</p>
                <Badge variant="secondary" className="mt-2">{t(`stage.${active.lead.lead_stage}`, active.lead.lead_stage)}</Badge>
              </div>
              <WhatsAppCrmContextPanel lead={active.lead} />
              <ScrollArea className="min-h-0 flex-1">
                {!simplified && (
                  <>
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
                      <h4 className="text-sm font-semibold">{t("conversation.metadata")}</h4>
                      <div className="mt-3 grid gap-3">
                        <Select value={active.assigned_to ?? "unassigned"} onValueChange={(value) => void assignConversation(value === "unassigned" ? null : value)}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">{t("filters.unassigned")}</SelectItem>
                            {staff.filter((member) => role === "admin" || member.id === user?.id).map((member) => <SelectItem key={member.id} value={member.id}>{member.id === user?.id ? t("filters.mine") : member.full_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={active.intent ?? "other"} onValueChange={(value) => void saveConversation({ intent: value })}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{INTENTS.map((intent) => <SelectItem key={intent} value={intent}>{t(`intent.${intent}`, intent)}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={active.language_code ?? "unknown"} onValueChange={(value) => void saveConversation({ language_code: value })}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{LANGUAGES.map((language) => <SelectItem key={language} value={language}>{t(`language.${language}`, language)}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input
                          className="h-9 text-xs"
                          value={active.campaign_key ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            if (value.length <= 80) void saveConversation({ campaign_key: value || null });
                          }}
                          placeholder={t("conversation.campaignPlaceholder")}
                        />
                        {/* Consent is a recorded decision, not a read-only badge:
                            campaigns refuse to send without it. */}
                        <div className="rounded-lg border bg-muted/20 p-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">{t("conversation.marketingConsent")}</span>
                            <Select value={active.lead.marketing_consent_status ?? "unknown"} onValueChange={(value) => void saveConsent(value)}>
                              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{CONSENT.map((status) => <SelectItem key={status} value={status}>{t(`consent.${status}`, status)}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          {active.lead.marketing_consent_updated_at && (
                            <p className="mt-1.5 text-[11px] text-muted-foreground">
                              {t("consentAudit.recorded", "Recorded {{time}}", { time: fmt(active.lead.marketing_consent_updated_at, i18n.language) })}
                              {consentActorName ? ` · ${consentActorName}` : ""}
                            </p>
                          )}
                        </div>
                        <TagEditor
                          label={t("profile.tags", "Tags")}
                          tags={active.lead.tags ?? []}
                          onChange={(tags) => void saveLead({ tags })}
                          addLabel={t("profile.addTag", "Add a tag")}
                        />
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div className="rounded-lg border bg-muted/20 p-2"><span className="block">{t("conversation.sourceChannel")}</span><span className="mt-1 block font-medium text-foreground">{active.source_channel ?? "whatsapp"}</span></div>
                          <div className="rounded-lg border bg-muted/20 p-2"><span className="block">{t("conversation.lastCustomerMessage")}</span><span className="mt-1 block font-medium text-foreground">{active.last_customer_message_at ? fmt(active.last_customer_message_at, i18n.language) : "—"}</span></div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
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
      {/* Mobile follows the internal Messages pattern:
          list first, then a full-surface conversation after selection. */}
      <div className="flex min-h-0 flex-1 lg:hidden">
        {!active && (
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl shadow-none">
            <div className="shrink-0 space-y-2 border-b p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="ps-8"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("filters.search")}
                />
              </div>
              {simplified && quickTabs}
            </div>
            <ScrollArea className="min-h-0 flex-1 [&>[data-radix-scroll-area-viewport]>div]:!block">
              {filtered.length ? filtered.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => selectConversation(thread.id)}
                  className="flex w-full items-start gap-2 border-b p-3 text-start transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {thread.lead.student_name || thread.lead.whatsapp_number}
                    </p>
                    {thread.lead.student_name && (
                      <p dir="ltr" className="truncate text-start text-[11px] text-muted-foreground">
                        {thread.lead.whatsapp_number}
                      </p>
                    )}
                    <p className="truncate text-xs text-muted-foreground">
                      {thread.last_message_preview ?? ""}
                    </p>
                    {!simplified && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[9px]">{t(`state.${normalizeWhatsAppState(thread.state)}`, normalizeWhatsAppState(thread.state))}</Badge>
                        {thread.priority !== "normal" && <Badge variant={thread.priority === "urgent" ? "destructive" : "outline"} className="text-[9px]">{t(`priority.${thread.priority}`, thread.priority)}</Badge>}
                        {isWhatsAppSlaOverdue(thread, now) && <Badge variant="destructive" className="text-[9px]">{t("sla.overdue")}</Badge>}
                      </div>
                    )}
                  </div>
                  {thread.unread_count > 0 && (
                    <Badge className="shrink-0 rounded-full px-1.5 text-[10px]">
                      {thread.unread_count}
                    </Badge>
                  )}
                </button>
              )) : (
                <EmptyState
                  title={t("empty.title")}
                  description={t("empty.description")}
                  icon={MessageCircle}
                  className="p-6"
                />
              )}
            </ScrollArea>
          </Card>
        )}
      </div>
    </>
  );

  const startDialog = (
    <Dialog open={startOpen} onOpenChange={setStartOpen}>
      <DialogContent dir={rtl ? "rtl" : "ltr"}>
        <DialogHeader><DialogTitle>{t("start.title")}</DialogTitle><DialogDescription>{t("start.description")}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input dir="ltr" className="ps-8" value={startQuery} onChange={(event) => handleStartQuery(event.target.value)} placeholder={t("start.searchPlaceholder")} />
          </div>
          {normalizedStartNumber && (
            <button type="button" onClick={() => void openNewConversation(normalizedStartNumber, "")} className="flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-start text-sm transition-colors hover:bg-muted/50">
              <span className="flex min-w-0 items-center gap-2"><MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate font-medium">{t("start.byNumber")}</span></span>
              <span dir="ltr" className="shrink-0 text-xs text-muted-foreground">+{normalizedStartNumber}</span>
            </button>
          )}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("start.searchCases")}</p>
            {searchingCases ? <p className="text-xs text-muted-foreground">{t("start.searching")}</p> : startResults.length ? (startResults.map((result) => (
              <button key={result.id} type="button" onClick={() => void openNewConversation(result.phone_number ?? "", result.full_name, { case_id: result.id })} className="flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-start text-sm transition-colors hover:bg-muted/50">
                <span className="flex min-w-0 items-center gap-2"><UserRound className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0"><span className="block truncate font-medium">{result.full_name}</span><Badge variant="outline" className="mt-1 text-[9px]">{result.status} · {result.case_reference}</Badge></span></span>
                {result.phone_number && <span dir="ltr" className="shrink-0 text-xs text-muted-foreground">{result.phone_number}</span>}
              </button>
            ))) : (startQuery.trim().length >= 2 && <p className="text-xs text-muted-foreground">{t("start.noResults")}</p>)}
          </div>
        </div>
        <DialogFooter><Button disabled={!normalizedStartNumber || starting} onClick={() => void openNewConversation(normalizedStartNumber!, "")}><MessageCircle className="me-2 h-4 w-4" />{t("start.create")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (teamMode) {
    return (
      <div dir={rtl ? "rtl" : "ltr"} className="mx-auto flex h-full w-full min-w-0 max-w-[1800px] min-h-0 flex-col overflow-hidden pb-0">
        <div className="mb-3 shrink-0 flex flex-wrap items-center justify-between gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", receiving ? "bg-emerald-500" : "bg-red-500")} title={receiving ? t("connection.connected") : t("connection.disconnected")} aria-label={receiving ? t("connection.connected") : t("connection.disconnected")} />
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && adminTeamToggle}
            <Button size="sm" variant="outline" onClick={() => setStartOpen(true)}><Plus className="me-2 h-4 w-4" />{t("start.action")}</Button>
            <Button size="icon" variant="outline" onClick={load} aria-label={t("actions.refresh")}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
        <Tabs defaultValue="inbox" className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <TabsList className="flex w-full max-w-[420px] shrink-0 justify-start gap-1 overflow-x-auto">
            <TabsTrigger value="inbox" className="shrink-0">{t("tabs.inbox")}</TabsTrigger>
            <TabsTrigger value="health" className="shrink-0">{t("tabs.health", "Delivery health")}</TabsTrigger>
          </TabsList>
          <TabsContent value="inbox" className="m-0 flex min-h-0 min-w-0 flex-1 flex-col">{inboxWorkspace(true)}</TabsContent>
          <TabsContent value="health" className="m-0 min-w-0"><WhatsAppHealthPanel isAdmin={isAdmin} /></TabsContent>
        </Tabs>
        {startDialog}
      </div>
    );
  }


  return (
    <div dir={rtl ? "rtl" : "ltr"} className={cn("mx-auto flex w-full min-w-0 max-w-[1800px] min-h-0 flex-col overflow-hidden", embedded ? "pb-0" : "pb-20 md:pb-4")}>
      {!embedded && <PageHeader title={t("title")} subtitle={t("subtitle")} actions={<><div className="flex items-center gap-2">{isAdmin && adminTeamToggle}<WhatsAppActions receiving={receiving} connectedLabel={t("connected")} statusLabel={statusLabel} refreshLabel={t("actions.refresh")} startLabel={t("start.action")} onRefresh={load} onStart={() => setStartOpen(true)} /></div></>} />}
      {embedded && <div className="mb-3 shrink-0 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">{t("title")}</h2><p className="text-sm text-muted-foreground">{t("subtitle")}</p></div><div className="flex items-center gap-2">{isAdmin && adminTeamToggle}<WhatsAppActions receiving={receiving} connectedLabel={t("connected")} statusLabel={statusLabel} refreshLabel={t("actions.refresh")} startLabel={t("start.action")} onRefresh={load} onStart={() => setStartOpen(true)} /></div></div>}
      <div className={cn("mb-3 rounded-lg border p-3 text-xs", receiving ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5")}>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{t("number")} · {statusLabel}</p>
          <Badge variant={businessHoursOpen ? "outline" : "secondary"}>{businessHoursOpen ? t("status.businessHoursOpen") : t("status.businessHoursClosed")}</Badge>
        </div>
        <p className="mt-1 text-muted-foreground">{receiving ? t("status.receivingHelp") : t("status.waitingHelp")}</p>
        {inbound?.lastInboundAt && <p className="mt-1 text-muted-foreground">{t("status.lastInbound", { time: fmt(inbound.lastInboundAt, i18n.language) })}</p>}
        {!!inbound?.unrecognisedCount && <p className="mt-1 text-muted-foreground">{t("status.unrecognised", { count: inbound.unrecognisedCount })}</p>}
      </div>
      <Tabs defaultValue="inbox" className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <TabsList className={cn("flex w-full max-w-[640px] shrink-0 justify-start gap-1 overflow-x-auto")}><TabsTrigger value="inbox" className="shrink-0">{t("tabs.inbox")}</TabsTrigger><TabsTrigger value="dashboard" className="shrink-0">{t("tabs.dashboard")}</TabsTrigger><TabsTrigger value="health" className="shrink-0">{t("tabs.health", "Delivery health")}</TabsTrigger>{canManageTemplates && <TabsTrigger value="templates" className="shrink-0">{t("tabs.templates")}</TabsTrigger>}</TabsList>
        <TabsContent value="inbox" className="m-0 flex min-h-0 min-w-0 flex-1 flex-col">{inboxWorkspace(false)}</TabsContent>
        <TabsContent value="dashboard" className="m-0 min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric icon={Sparkles} label={t("dashboard.newLeads")} value={newLeads} />
            <Metric icon={UsersRound} label={t("dashboard.unassigned")} value={unassigned} />
            <Metric icon={Clock3} label={t("dashboard.response")} value={responseAvg === null ? "—" : `${responseAvg} ${t("dashboard.minutes")}`} />
            <Metric icon={AlarmClock} label={t("dashboard.waitingForTeam")} value={waitingForTeam} />
            <Metric icon={CheckCircle2} label={t("dashboard.slaOverdue")} value={slaOverdue} />
          </div>
          <div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
            <Card className="rounded-xl p-5 shadow-none">
              <h2 className="mb-4 font-semibold">{t("dashboard.intentDistribution", "Intent distribution")}</h2>
              {intentSummary.length ? <div className="space-y-2">{intentSummary.map(([intent, count]) => <div key={intent} className="flex items-center justify-between rounded-lg border p-2.5 text-sm"><span>{t(`intent.${intent}`, intent)}</span><Badge variant="secondary">{count}</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">{t("dashboard.noData")}</p>}
            </Card>
            <Card className="rounded-xl p-5 shadow-none">
              <h2 className="mb-4 font-semibold">{t("dashboard.campaigns", "Campaigns")}</h2>
              {campaignSummary.length ? <div className="space-y-2">{campaignSummary.map(([campaign, count]) => <div key={campaign} className="flex items-center justify-between rounded-lg border p-2.5 text-sm"><span className="truncate">{campaign}</span><Badge variant="secondary">{count}</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">{t("dashboard.noCampaignData", "No campaign data yet.")}</p>}
            </Card>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
            <Card className="rounded-xl p-5 shadow-none">
              <h2 className="mb-4 font-semibold">{t("dashboard.byStage")}</h2>
              {threads.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{STAGES.map((s) => <div key={s} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>{t(`stage.${s}`)}</span><Badge variant="secondary">{threads.filter((x) => x.lead.lead_stage === s).length}</Badge></div>)}</div> : <EmptyState title={t("dashboard.noData")} icon={UsersRound} />}
            </Card>
            <Card className="rounded-xl p-5 shadow-none">
              <div className="flex items-center justify-between gap-2">
                <div><h2 className="font-semibold">{t("dashboard.operationalTitle")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("dashboard.operationalHelp")}</p></div>
                <AlarmClock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between"><span>{t("dashboard.snoozed")}</span><Badge variant="secondary">{snoozed}</Badge></div>
                <div className="flex items-center justify-between"><span>{t("dashboard.slaOverdue")}</span><Badge variant={slaOverdue ? "destructive" : "secondary"}>{slaOverdue}</Badge></div>
                <div className="flex items-center justify-between"><span>{t("dashboard.waitingForTeam")}</span><Badge variant="secondary">{waitingForTeam}</Badge></div>
              </div>
            </Card>
          </div>
        </TabsContent>
        {canManageTemplates && <TabsContent value="templates" className="m-0 min-w-0 space-y-3"><Card className="rounded-xl shadow-none"><div className="flex flex-wrap items-start justify-between gap-3 border-b p-5"><div><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /><h2 className="font-semibold">{t("templates.title")}</h2></div><p className="mt-1 text-sm text-muted-foreground">{t("templates.required")}</p></div><Button variant="outline" disabled={templateSyncing} onClick={() => void syncTemplates()}><RefreshCw className={cn("me-2 h-4 w-4", templateSyncing && "animate-spin")} />{t("templates.sync")}</Button></div>{templates.length ? <div className="divide-y">{templates.map((x) => <div key={x.id} className="grid gap-2 p-4 text-sm sm:grid-cols-5"><strong>{t(`templates.purpose.${x.purpose}`, x.purpose)}</strong><span>{x.provider_name}</span><span>{x.language_code}</span><Badge variant="outline" className="w-fit">{x.approval_status}</Badge><div className="flex flex-col gap-2"><label className="flex items-center gap-2 text-xs"><Switch checked={x.is_active !== false} onCheckedChange={(value) => void toggleTemplateFlag(x.id, { is_active: value })} /><span>{t("templates.active", "Active")}</span></label><label className="flex items-center gap-2 text-xs"><Switch checked={x.available_to_team !== false} onCheckedChange={(value) => void toggleTemplateFlag(x.id, { available_to_team: value })} /><span>{t("templates.availableToTeam", "Available to team")}</span></label></div></div>)}</div> : <EmptyState title={t("templates.noneTitle")} description={t("templates.noneDescription")} icon={ShieldCheck} />}</Card><Card className="rounded-xl p-5 shadow-none"><h2 className="font-semibold">{t("templates.createTitle")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("templates.createHelp")}</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><Select value={templatePurpose} onValueChange={setTemplatePurpose}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TEMPLATE_PURPOSES.map((purpose) => <SelectItem key={purpose} value={purpose}>{t(`templates.purpose.${purpose}`)}</SelectItem>)}</SelectContent></Select><Select value={templateLanguage} onValueChange={(value) => setTemplateLanguage(value as "ar" | "en" | "he")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ar">{t("templates.arabic")}</SelectItem><SelectItem value="he">{t("templates.hebrew")}</SelectItem><SelectItem value="en">{t("templates.english")}</SelectItem></SelectContent></Select><Select value={templateCategory} onValueChange={(value) => setTemplateCategory(value as "UTILITY" | "MARKETING")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="UTILITY">{t("templates.utility")}</SelectItem><SelectItem value="MARKETING">{t("templates.marketing")}</SelectItem></SelectContent></Select></div><Textarea className="mt-3 min-h-28" value={templateBody} onChange={(event) => setTemplateBody(event.target.value)} placeholder={t("templates.bodyPlaceholder")} /><div className="mt-3 flex justify-end"><Button disabled={templateCreating || templateBody.trim().length < 20} onClick={() => void createTemplate()}><Plus className="me-2 h-4 w-4" />{t("templates.submit")}</Button></div></Card></TabsContent>}
        <TabsContent value="health" className="m-0 min-w-0">
          <WhatsAppHealthPanel isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
      <Dialog open={customSnoozeOpen} onOpenChange={setCustomSnoozeOpen}>
        <DialogContent dir={rtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("snooze.custom")}</DialogTitle>
            <DialogDescription>{t("snooze.customHelp")}</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="wa-custom-snooze">{t("snooze.when")}</Label>
            <Input id="wa-custom-snooze" type="datetime-local" className="mt-1" value={customSnoozeAt} onChange={(event) => setCustomSnoozeAt(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomSnoozeOpen(false)}>{t("actions.cancel", "Cancel")}</Button>
            <Button disabled={!customSnoozeAt} onClick={() => void applyCustomSnooze()}><AlarmClock className="me-2 h-4 w-4" />{t("snooze.action")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={followUpOpen} onOpenChange={setFollowUpOpen}>
        <DialogContent dir={rtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("snooze.schedule")}</DialogTitle>
            <DialogDescription>{t("snooze.scheduleHelp")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("conversation.chooseTemplate")}</Label>
              <Select value={followUpTemplateId ?? undefined} onValueChange={(value) => { setFollowUpTemplateId(value); setFollowUpParameters([]); }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t("conversation.chooseTemplate")} /></SelectTrigger>
                <SelectContent>{sendableTemplates.filter((item) => item.category === "UTILITY").map((item) => <SelectItem key={item.id} value={item.id}>{t(`templates.purpose.${item.purpose}`, item.purpose)} · {item.language_code}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="wa-follow-up-time">{t("snooze.when")}</Label>
              <Input id="wa-follow-up-time" type="datetime-local" className="mt-1" value={followUpDueAt} onChange={(event) => setFollowUpDueAt(event.target.value)} />
            </div>
            {followUpTemplateId && (() => {
              const item = templates.find((template) => template.id === followUpTemplateId);
              const body = Array.isArray(item?.components) ? item.components.find((part) => part && typeof part === "object" && String((part as Record<string, unknown>).type ?? "").toUpperCase() === "BODY") as Record<string, unknown> | undefined : undefined;
              const textBody = String(body?.text ?? "");
              const count = [...textBody.matchAll(/{{\s*(\d+)\s*}}/g)].length;
              return <div className="rounded-md border bg-muted/30 p-3 text-xs"><p className="whitespace-pre-wrap">{textBody}</p>{Array.from({ length: count }, (_, index) => <Input key={index} className="mt-2" value={followUpParameters[index] ?? ""} onChange={(event) => setFollowUpParameters((current) => { const next = [...current]; next[index] = event.target.value; return next; })} placeholder={t("conversation.templateField", { number: index + 1 })} />)}</div>;
            })()}
          </div>
          <DialogFooter><Button disabled={!followUpTemplateId || !followUpDueAt || followUpSaving} onClick={() => void scheduleFollowUp()}><CalendarClock className="me-2 h-4 w-4" />{t("snooze.schedule")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {startDialog}
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
