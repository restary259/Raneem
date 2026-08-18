import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import SegmentedTabs from "@/components/shell/SegmentedTabs";
import { PageHeader, EmptyState, LoadingState, ErrorState } from "@/components/shell";
import { errorMessage } from "@/lib/errorMessage";
import { resolveProfileNames } from "@/lib/resolveProfileNames";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  FileText,
  FileSignature,
  FileCheck,
  Archive,
  ArchiveRestore,
  Eye,
  Pencil,
  FileDown,
  Sprout,
} from "lucide-react";
import { DOC_CATEGORIES, type DocKind, type DocStatus } from "@/lib/documentBlocks";

/** Library row — documents_library joined to its latest document_versions. */
interface LibraryDoc {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: string;
  doc_kind: string;
  language: string;
  status: string;
  current_version: string;
  effective_date: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  versions: { version: string; created_at: string; pdf_path: string | null }[];
}

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-emerald-500/15 text-emerald-600",
  archived: "bg-muted/60 text-muted-foreground line-through",
};

const KIND_TONE: Record<string, string> = {
  guide: "bg-blue-500/15 text-blue-600",
  contract: "bg-amber-500/15 text-amber-600",
  form: "bg-slate-500/15 text-slate-600",
};

type CategoryTab = "all" | (typeof DOC_CATEGORIES)[number] | "archived";

const TABS: CategoryTab[] = ["all", ...DOC_CATEGORIES, "archived"];

interface NewDocForm {
  title: string;
  subtitle: string;
  description: string;
  category: string;
  doc_kind: DocKind;
  language: string;
  effective_date: string;
}

const EMPTY_FORM: NewDocForm = {
  title: "",
  subtitle: "",
  description: "",
  category: "operations",
  doc_kind: "guide",
  language: "ar",
  effective_date: "",
};

const slugify = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\u0590-\u05FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `doc-${Math.random().toString(36).slice(2, 8)}`;

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const AdminDocumentsPage = () => {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const navigate = useNavigate();

  const [docs, setDocs] = useState<LibraryDoc[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<CategoryTab>("all");
  const [query, setQuery] = useState("");

  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState<NewDocForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<LibraryDoc | null>(null);
  const [archiving, setArchiving] = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("documents_library")
        .select(
          "id, slug, title, subtitle, description, category, doc_kind, language, status, current_version, effective_date, created_by, updated_by, created_at, updated_at, versions:document_versions(version, created_at, pdf_path)",
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as LibraryDoc[];
      setDocs(rows);
      const ids = Array.from(
        new Set(rows.map((r) => [r.created_by, r.updated_by]).flat().filter(Boolean) as string[]),
      );
      setAuthors(await resolveProfileNames(ids));
    } catch (err: unknown) {
      const msg = errorMessage(err);
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  // Real-time refresh on any library/version change. The two subscriptions are
  // collapsed through a single trailing debounce (300ms) so a burst of version
  // writes — e.g. another admin tab's debounced autosave — produces ONE
  // refetch, not N. The channel is recreated only when `fetchDocs` changes.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        if (!cancelled) void fetchDocs();
      }, 300);
    };
    const channel = supabase
      .channel("documents_library_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "documents_library" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "document_versions" }, schedule)
      .subscribe();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [fetchDocs]);

  const filtered = docs.filter((d) => {
    if (tab === "archived") {
      if (d.status !== "archived") return false;
    } else if (tab !== "all" && d.category !== tab) return false;
    if (d.status === "archived" && tab !== "archived") return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      d.title.toLowerCase().includes(q) ||
      (d.description ?? "").toLowerCase().includes(q) ||
      (d.subtitle ?? "").toLowerCase().includes(q)
    );
  });

  const createDocument = async () => {
    if (!form.title.trim()) {
      toast({ variant: "destructive", description: t("admin.documents.form.titleRequired", "A title is required") });
      return;
    }
    setCreating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      const slug = slugify(form.title);
      const payload = {
        slug,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        description: form.description.trim() || null,
        category: form.category,
        doc_kind: form.doc_kind,
        language: form.language,
        status: "draft" as DocStatus,
        current_version: "1.0",
        effective_date: form.effective_date || null,
        created_by: uid ?? null,
        updated_by: uid ?? null,
      };
      const { data: inserted, error: insErr } = await supabase
        .from("documents_library")
        .insert(payload)
        .select("id")
        .single();
      if (insErr) throw insErr;
      const { error: vErr } = await supabase.from("document_versions").insert({
        document_id: inserted.id,
        version: "1.0",
        content: [],
        change_note: "Initial version",
        created_by: uid ?? null,
      });
      if (vErr) throw vErr;
      setNewOpen(false);
      setForm(EMPTY_FORM);
      await fetchDocs();
      toast({ description: t("admin.documents.created", "Document created") });
    } catch (err: unknown) {
      const msg = errorMessage(err);
      toast({ variant: "destructive", description: msg });
    } finally {
      setCreating(false);
    }
  };

  const archiveOrRestore = async (d: LibraryDoc) => {
    const next = d.status === "archived" ? "draft" : "archived";
    setArchiving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      const { error } = await supabase
        .from("documents_library")
        .update({ status: next, updated_by: uid ?? null })
        .eq("id", d.id);
      if (error) throw error;
      setArchiveTarget(null);
      await fetchDocs();
      toast({
        description:
          next === "archived"
            ? t("admin.documents.archived", "Document archived")
            : t("admin.documents.restored", "Document restored"),
      });
    } catch (err: unknown) {
      const msg = errorMessage(err);
      toast({ variant: "destructive", description: msg });
    } finally {
      setArchiving(false);
    }
  };

  const seedStarter = async () => {
    setSeeding(true);
    try {
      const { AGENT_GUIDE_SEED } = await import("@/content/documents/agentOperationsGuide");
      const { PARTNER_GUIDE_SEED } = await import("@/content/documents/partnerOperationsGuide");
      const { AMBASSADOR_GUIDE_SEED } = await import("@/content/documents/ambassadorGuide");
      const { STUDENT_AGREEMENT_SEED } = await import("@/content/documents/studentServiceAgreement");
      const payload = [
        ...AGENT_GUIDE_SEED,
        ...PARTNER_GUIDE_SEED,
        ...AMBASSADOR_GUIDE_SEED,
        ...STUDENT_AGREEMENT_SEED,
      ].map((d) => ({
        slug: d.slug,
        title: d.title,
        subtitle: d.subtitle,
        description: d.description,
        category: d.category,
        doc_kind: d.doc_kind,
        language: d.language,
        status: "draft",
        current_version: "1.0",
        content: d.content,
        change_note: "Initial version",
      }));
      const { error } = await supabase.rpc("seed_starter_documents", { p_docs: payload });
      if (error) throw error;
      await fetchDocs();
      toast({ description: t("admin.documents.seeded", "Starter documents seeded") });
    } catch (err: unknown) {
      const msg = errorMessage(err);
      toast({ variant: "destructive", description: msg });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("admin.documents.title", "DARB Documents")}
        subtitle={t("admin.documents.subtitle", "Official contracts, guides and forms")}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={seedStarter} disabled={seeding}>
              <Sprout className="me-2 h-4 w-4" />
              {seeding
                ? t("common.saving", "Working...")
                : t("admin.documents.seedStarter", "Seed starter documents")}
            </Button>
            <Button size="sm" onClick={() => { setForm(EMPTY_FORM); setNewOpen(true); }}>
              <Plus className="me-2 h-4 w-4" />
              {t("admin.documents.newDocument", "New Document")}
            </Button>
          </>
        }
      >
        <Tabs value={tab} onValueChange={(v) => setTab(v as CategoryTab)}>
          <SegmentedTabs
            items={TABS.map((value) => ({
              value,
              label: t(`admin.documents.categories.${value}`, value),
            }))}
          />
        </Tabs>
        <div className="relative mt-3 max-w-md">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("admin.documents.search", "Search documents...")}
            className="ps-9"
          />
        </div>
      </PageHeader>

      {loading ? (
        <LoadingState rows={6} />
      ) : loadError ? (
        <ErrorState
          title={t("admin.documents.loadError", "Failed to load documents")}
          description={loadError}
          onRetry={fetchDocs}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={query || tab !== "all" ? t("admin.documents.emptyFiltered", "No documents match your filters") : t("admin.documents.empty", "No documents yet")}
          description={t("admin.documents.emptyDesc", "Create your first document or seed the starter guides.")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => {
            const latest = d.versions?.[0];
            const author = d.created_by ? authors[d.created_by] : null;
            const KindIcon = d.doc_kind === "contract" ? FileSignature : d.doc_kind === "form" ? FileCheck : FileText;
            return (
              <div
                key={d.id}
                className="flex flex-col rounded-lg border bg-card p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{d.title}</h3>
                    {d.subtitle && <p className="truncate text-xs text-muted-foreground">{d.subtitle}</p>}
                  </div>
                  <KindIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                </div>

                {d.description && (
                  <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{d.description}</p>
                )}

                <div className="mb-3 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className={KIND_TONE[d.doc_kind] ?? ""}>
                    {t(`admin.documents.kind.${d.doc_kind}`, d.doc_kind)}
                  </Badge>
                  <Badge variant="outline">{t(`admin.documents.categories.${d.category}`, d.category)}</Badge>
                  <span className="text-xs text-muted-foreground">v{d.current_version}</span>
                  <Badge variant="secondary" className={STATUS_TONE[d.status] ?? ""}>
                    {t(`admin.documents.status.${d.status}`, d.status)}
                  </Badge>
                </div>

                <div className="mt-auto space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>{t("admin.documents.updated", "Updated")}: {formatDate(d.updated_at)}</span>
                    {latest?.pdf_path && (
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                        {t("admin.documents.editor.versions.pdfStored", "PDF stored")}
                      </Badge>
                    )}
                  </div>
                  <div>
                    {t("admin.documents.createdBy", "Created by")}: {author ?? t("admin.documents.noAuthor", "System")}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/documents/${d.id}/edit`)}>
                    <Eye className="me-1 h-3.5 w-3.5" />
                    {t("admin.documents.actions.preview", "Preview")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/documents/${d.id}/edit`)}>
                    <Pencil className="me-1 h-3.5 w-3.5" />
                    {t("admin.documents.actions.edit", "Edit")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/admin/documents/${d.id}/edit`)}
                    title={t("admin.documents.actions.generatePdf", "Generate PDF")}
                  >
                    <FileDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setArchiveTarget(d)}
                    className="ms-auto"
                    title={
                      d.status === "archived"
                        ? t("admin.documents.actions.restore", "Restore")
                        : t("admin.documents.actions.archive", "Archive")
                    }
                  >
                    {d.status === "archived" ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Document modal */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.documents.form.newTitle", "New document")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("admin.documents.form.title", "Title")}</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t("admin.documents.form.titlePlaceholder", "Document title")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin.documents.form.subtitle", "Subtitle")}</Label>
              <Input
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                placeholder={t("admin.documents.form.subtitlePlaceholder", "Optional subtitle")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin.documents.form.description", "Description")}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t("admin.documents.form.descriptionPlaceholder", "Short description")}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("admin.documents.form.category", "Category")}</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{t(`admin.documents.categories.${c}`, c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.documents.form.type", "Type")}</Label>
                <Select
                  value={form.doc_kind}
                  onValueChange={(v) => setForm({ ...form, doc_kind: v as DocKind })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guide">{t("admin.documents.kind.guide", "Guide")}</SelectItem>
                    <SelectItem value="contract">{t("admin.documents.kind.contract", "Contract")}</SelectItem>
                    <SelectItem value="form">{t("admin.documents.kind.form", "Form")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("admin.documents.form.language", "Language")}</Label>
                <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">العربية</SelectItem>
                    <SelectItem value="he">עברית</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.documents.form.effectiveDate", "Effective date (optional)")}</Label>
                <Input
                  type="date"
                  value={form.effective_date}
                  onChange={(e) => setForm({ ...form, effective_date: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)} disabled={creating}>
              {t("admin.documents.form.cancel", "Cancel")}
            </Button>
            <Button onClick={createDocument} disabled={creating}>
              {creating ? t("admin.documents.form.creating", "Creating...") : t("admin.documents.form.submit", "Create document")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive confirmation */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(o) => !o && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveTarget?.status === "published"
                ? t("admin.documents.archiveConfirmTitle", "Archive this document?")
                : t("admin.documents.archiveConfirmTitle", "Archive this document?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.status === "published"
                ? t("admin.documents.archiveConfirmPublishedBody", "This document is published. Archiving hides it from the active list. Continue?")
                : t("admin.documents.archiveConfirmBody", "The document will be hidden from the active list. You can restore it later from the Archived tab.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>{t("admin.documents.form.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (archiveTarget) archiveOrRestore(archiveTarget);
              }}
              disabled={archiving}
            >
              {t("admin.documents.actions.archive", "Archive")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDocumentsPage;
