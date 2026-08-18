import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Save,
  Eye,
  UploadCloud,
  Plus,
  Trash2,
  GripVertical,
  History,
  Copy,
  Layers,
  FileText,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Table as TableIcon,
  AlertTriangle,
  GitBranch,
  PenLine,
  ScrollText,
  Loader2,
} from "lucide-react";
import {
  type DocBlock,
  type DocLanguage,
  type DocStatus,
  type VariableMap,
  BLOCK_TYPES,
  VARIABLE_KEYS,
  emptyBlock,
  nextVersion,
  resolveText,
} from "@/lib/documentBlocks";
import { useDebouncedDocumentSave } from "@/hooks/useDebouncedDocumentSave";
import { errorMessage } from "@/lib/errorMessage";
import { resolveProfileNames } from "@/lib/resolveProfileNames";
import { useDocumentVariables } from "@/hooks/useDocumentVariables";
import DocumentPreview from "@/components/documents/DocumentPreview";
import { generateDocumentPdf } from "@/utils/documentPdf";

interface DocMeta {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  category: string;
  doc_kind: string;
  language: DocLanguage;
  status: DocStatus;
  current_version: string;
  effective_date: string | null;
}

interface VersionRow {
  id: string;
  version: string;
  content: DocBlock[];
  change_note: string | null;
  pdf_path: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
}

const PALETTE_ICONS: Record<DocBlock["type"], React.ComponentType<{ className?: string }>> = {
  cover: FileText,
  heading: Heading1,
  paragraph: PenLine,
  list: List,
  table: TableIcon,
  callout: AlertTriangle,
  flow: GitBranch,
  signature: ScrollText,
  disclaimer: ScrollText,
  pagebreak: Layers,
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-emerald-500/15 text-emerald-600",
  archived: "bg-muted/60 text-muted-foreground",
};

// JSON parse of document_versions.content (jsonb) → DocBlock[].
const parseContent = (raw: unknown): DocBlock[] => {
  if (!Array.isArray(raw)) return [];
  return raw as DocBlock[];
};

const AdminDocumentEditorPage = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const navigate = useNavigate();

  const [meta, setMeta] = useState<DocMeta | null>(null);
  const [version, setVersion] = useState<VersionRow | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [blocks, setBlocks] = useState<DocBlock[]>([]);
  const [titleDraft, setTitleDraft] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mobileTab, setMobileTab] = useState("edit");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocBlock | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [newVersionNote, setNewVersionNote] = useState("");
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<VersionRow | null>(null);

  const { variables } = useDocumentVariables(
    meta ? { current_version: meta.current_version, effective_date: meta.effective_date } : null,
  );

  const save = useDebouncedDocumentSave(blocks, {
    documentId: meta?.id ?? "",
    versionId: version?.id ?? "",
    version: version?.version ?? "",
    title: titleDraft,
  });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      // Fetch the library row and its versions in parallel — they only depend
      // on `id`, not on each other. Author names follow once version rows are
      // in hand (they hold the `created_by` ids).
      const [docRes, versRes] = await Promise.all([
        supabase
          .from("documents_library")
          .select("id, slug, title, subtitle, category, doc_kind, language, status, current_version, effective_date")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("document_versions")
          .select("id, version, content, change_note, pdf_path, published_at, created_by, created_at")
          .eq("document_id", id)
          .order("created_at", { ascending: false }),
      ]);
      if (docRes.error) throw docRes.error;
      if (versRes.error) throw versRes.error;
      if (!docRes.data) {
        setLoadError(t("admin.documents.editor.notFound", "Document not found"));
        setLoading(false);
        return;
      }
      const m: DocMeta = docRes.data as DocMeta;
      setMeta(m);
      setTitleDraft(m.title);

      const rows = (versRes.data ?? []) as unknown as VersionRow[];
      setVersions(rows);
      const current = rows.find((r) => r.version === m.current_version) ?? rows[0] ?? null;
      setVersion(current);
      const parsed = parseContent(current?.content);
      setBlocks(parsed);
      save.reset(parsed);

      setAuthors(await resolveProfileNames(rows.map((r) => r.created_by).filter(Boolean) as string[]));
    } catch (err: unknown) {
      const msg = errorMessage(err);
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  // When the selected block is deleted elsewhere, clear selection.
  useEffect(() => {
    if (selectedId && !blocks.some((b) => b.id === selectedId)) setSelectedId(null);
  }, [blocks, selectedId]);

  const selected = useMemo(
    () => blocks.find((b) => b.id === selectedId) ?? null,
    [blocks, selectedId],
  );

  const insertBlock = (type: DocBlock["type"]) => {
    const block = emptyBlock(type);
    const idx = selectedId ? blocks.findIndex((b) => b.id === selectedId) : -1;
    const next = [...blocks];
    if (idx >= 0) next.splice(idx + 1, 0, block);
    else next.push(block);
    setBlocks(next);
    setSelectedId(block.id);
    setMobileTab("inspector");
  };

  const updateBlock = useCallback((bid: string, patch: Partial<DocBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === bid ? ({ ...b, ...patch } as DocBlock) : b)));
  }, []);

  const removeBlock = (bid: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== bid));
    if (selectedId === bid) setSelectedId(null);
    setDeleteTarget(null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setBlocks((prev) => {
      const oldIdx = prev.findIndex((b) => b.id === active.id);
      const newIdx = prev.findIndex((b) => b.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const flushSave = async () => {
    try {
      await save.flush();
      toast({ description: t("admin.documents.editor.saved", "Draft saved") });
    } catch (err: unknown) {
      const msg = errorMessage(err);
      toast({ variant: "destructive", description: msg });
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      await save.flush();
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      const { error } = await supabase
        .from("documents_library")
        .update({ status: "published", updated_by: uid ?? null })
        .eq("id", meta!.id);
      if (error) throw error;
      await supabase
        .from("document_versions")
        .update({ published_at: new Date().toISOString() })
        .eq("id", version!.id);
      setMeta((m) => (m ? { ...m, status: "published" } : m));
      setPublishOpen(false);
      toast({ description: t("admin.documents.editor.published", "Document published") });
      await load();
    } catch (err: unknown) {
      const msg = errorMessage(err);
      toast({ variant: "destructive", description: msg });
    } finally {
      setPublishing(false);
    }
  };

  const generatePdf = async () => {
    if (!meta || !version) return;
    setGenerating(true);
    try {
      await save.flush();
      const doc = await generateDocumentPdf(
        { title: meta.title, slug: meta.slug, language: meta.language },
        { version: version.version, content: blocks },
        variables,
      );
      // Upload to the private darb-documents bucket.
      const blob = doc.output("blob");
      const path = `${meta.slug}/v${version.version}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("darb-documents")
        .upload(path, blob, { upsert: true, contentType: "application/pdf" });
      if (upErr) throw upErr;
      await supabase
        .from("document_versions")
        .update({ pdf_path: path })
        .eq("id", version.id);
      toast({ description: t("admin.documents.preview.generated", "PDF generated") });
      await load();
    } catch (err: unknown) {
      const msg = errorMessage(err);
      toast({ variant: "destructive", description: msg });
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = async (v: VersionRow) => {
    if (!v.pdf_path) return;
    try {
      const { data, error } = await supabase.storage
        .from("darb-documents")
        .createSignedUrl(v.pdf_path, 3600);
      if (error) throw error;
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = `${meta?.slug ?? "darb"}-v${v.version}.pdf`;
      a.click();
    } catch (err: unknown) {
      const msg = errorMessage(err);
      toast({ variant: "destructive", description: msg });
    }
  };

  const createVersion = async () => {
    if (!meta || !version) return;
    setCreatingVersion(true);
    try {
      await save.flush();
      const ver = nextVersion(version.version);
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      const { data: inserted, error } = await supabase
        .from("document_versions")
        .insert({
          document_id: meta.id,
          version: ver,
          content: blocks as unknown,
          change_note: newVersionNote.trim() || null,
          created_by: uid ?? null,
        })
        .select("id, version, content, change_note, pdf_path, published_at, created_by, created_at")
        .single();
      if (error) throw error;
      setNewVersionNote("");
      setNewVersionOpen(false);
      toast({ description: t("admin.documents.editor.versions.restored", "Version created") });
      await load();
      // The current_version sync trigger sets the new version as active.
      void inserted;
    } catch (err: unknown) {
      const msg = errorMessage(err);
      toast({ variant: "destructive", description: msg });
    } finally {
      setCreatingVersion(false);
    }
  };

  const restoreVersion = async (v: VersionRow) => {
    if (!version) return;
    const parsed = parseContent(v.content);
    setBlocks(parsed);
    save.reset(parsed);
    setRestoreTarget(null);
    toast({ description: t("admin.documents.editor.versions.restoredDesc", "The content is now in the editor — save to keep it") });
  };

  const copyToken = async (key: string) => {
    const token = `{{${key}}}`;
    try {
      await navigator.clipboard.writeText(token);
      toast({ description: t("admin.documents.editor.copiedToken", { token, defaultValue: `Copied ${token}` }) });
    } catch {
      toast({ description: token });
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !meta || !version) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <p className="text-sm font-medium">{loadError ?? t("admin.documents.editor.notFound", "Document not found")}</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/admin/documents")}>
          <ArrowLeft className="me-2 h-4 w-4" />
          {t("admin.documents.editor.back", "Back to documents")}
        </Button>
      </div>
    );
  }

  const palette = (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {t("admin.documents.editor.paletteHint", "Click a block to insert it after the selected block (or at the end)")}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {BLOCK_TYPES.map((type) => {
          const Icon = PALETTE_ICONS[type] ?? FileText;
          return (
            <Button
              key={type}
              variant="outline"
              size="sm"
              className="justify-start"
              onClick={() => insertBlock(type)}
            >
              <Icon className="me-2 h-4 w-4" />
              {t(`admin.documents.editor.block.${type}`, type)}
            </Button>
          );
        })}
      </div>
    </div>
  );

  const inspectorContent = selected ? (
    <BlockInspector block={selected} update={(patch) => updateBlock(selected.id, patch)} t={t} />
  ) : (
    <p className="text-xs text-muted-foreground">
      {t("admin.documents.editor.noSelectionHint", "Select a block to edit its fields, or insert one from the palette")}
    </p>
  );

  const variablesPanel = (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {t("admin.documents.editor.variablesHint", "Click a token to copy {{token}} to the clipboard")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {VARIABLE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => copyToken(key)}
            className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs hover:bg-muted"
            title={t("admin.documents.editor.copyToken", "Copy")}
          >
            {`{{${key}}}`}
          </button>
        ))}
      </div>
      <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
        {t("admin.documents.preview.unresolvedTokens", "Unresolved tokens are highlighted in amber")}
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/documents")}>
          <ArrowLeft className="me-2 h-4 w-4" />
          {t("admin.documents.editor.back", "Back to documents")}
        </Button>
        <Input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          className="h-8 max-w-xs flex-1 text-sm font-semibold"
        />
        <Badge variant="secondary" className="ms-1">v{version.version}</Badge>
        <Badge variant="secondary" className={STATUS_TONE[meta.status] ?? ""}>
          {t(`admin.documents.status.${meta.status}`, meta.status)}
        </Badge>
        <div className="ms-auto flex items-center gap-2">
          {save.dirty && (
            <span className="text-xs text-amber-600">
              {save.saving
                ? t("admin.documents.editor.saving", "Saving...")
                : t("admin.documents.editor.unsaved", "Unsaved changes")}
            </span>
          )}
          {save.error && <span className="text-xs text-destructive">⚠</span>}
          <Button variant="outline" size="sm" onClick={flushSave} disabled={save.saving}>
            <Save className="me-2 h-4 w-4" />
            {t("admin.documents.editor.saveDraft", "Save draft")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="me-2 h-4 w-4" />
            {t("admin.documents.editor.preview", "Preview")}
          </Button>
          <Button size="sm" onClick={() => setPublishOpen(true)} disabled={meta.status === "published"}>
            <UploadCloud className="me-2 h-4 w-4" />
            {t("admin.documents.editor.publish", "Publish")}
          </Button>
        </div>
      </div>

      {/* Desktop 3-pane / mobile tabs */}
      <div className="hidden flex-1 md:block">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={22} minSize={18}>
            <div className="h-full overflow-y-auto border-e p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("admin.documents.editor.palette", "Block palette")}
              </h3>
              {palette}
            </div>
          </ResizablePanel>
          <ResizablePanel defaultSize={56} minSize={30}>
            <div className="h-full overflow-y-auto p-3">
              <BlockList
                blocks={blocks}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDelete={(b) => setDeleteTarget(b)}
                onDragEnd={onDragEnd}
                variables={variables}
                t={t}
              />
            </div>
          </ResizablePanel>
          <ResizablePanel defaultSize={22} minSize={18}>
            <div className="h-full space-y-4 overflow-y-auto border-s p-3">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("admin.documents.editor.inspector", "Inspector")}
                </h3>
                {inspectorContent}
              </div>
              <div className="border-t pt-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("admin.documents.editor.variables", "Variables")}
                </h3>
                {variablesPanel}
              </div>
              <div className="border-t pt-3">
                <Sheet open={versionsOpen} onOpenChange={setVersionsOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      <History className="me-2 h-4 w-4" />
                      {t("admin.documents.editor.tabs.versions", "Versions")} ({versions.length})
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="overflow-y-auto sm:max-w-md">
                    <SheetHeader>
                      <SheetTitle>{t("admin.documents.editor.versions.title", "Versions")}</SheetTitle>
                    </SheetHeader>
                    <VersionsPanel
                      versions={versions}
                      authors={authors}
                      currentVersion={version.version}
                      onRestore={(v) => setRestoreTarget(v)}
                      onDownload={downloadPdf}
                      onNewVersion={() => setNewVersionOpen(true)}
                      t={t}
                    />
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <div className="flex-1 md:hidden">
        <Tabs value={mobileTab} onValueChange={setMobileTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="palette">{t("admin.documents.editor.tabs.palette", "Palette")}</TabsTrigger>
            <TabsTrigger value="edit">{t("admin.documents.editor.tabs.edit", "Edit")}</TabsTrigger>
            <TabsTrigger value="inspector">{t("admin.documents.editor.tabs.inspector", "Inspector")}</TabsTrigger>
          </TabsList>
          <TabsContent value="palette" className="m-3">
            {palette}
          </TabsContent>
          <TabsContent value="edit" className="m-3">
            <BlockList
              blocks={blocks}
              selectedId={selectedId}
              onSelect={(sid) => { setSelectedId(sid); setMobileTab("inspector"); }}
              onDelete={(b) => setDeleteTarget(b)}
              onDragEnd={onDragEnd}
              variables={variables}
              t={t}
            />
          </TabsContent>
          <TabsContent value="inspector" className="m-3 space-y-4">
            {inspectorContent}
            {variablesPanel}
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.documents.editor.deleteBlock", "Delete block")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.documents.editor.deleteBlockConfirm", "Delete this block? This cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.documents.form.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (deleteTarget) removeBlock(deleteTarget.id); }}
            >
              {t("admin.documents.editor.deleteBlock", "Delete block")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Publish confirm */}
      <AlertDialog open={publishOpen} onOpenChange={setPublishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.documents.editor.publishConfirmTitle", "Publish this document?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.documents.editor.publishConfirmBody", "The document becomes visible to its audience. You can still edit it afterwards.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishing}>{t("admin.documents.form.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); publish(); }}
              disabled={publishing}
            >
              {publishing ? t("admin.documents.editor.saving", "Saving...") : t("admin.documents.editor.publish", "Publish")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore version confirm */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.documents.editor.versions.restoreConfirmTitle", "Load this version into the editor?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.documents.editor.versions.restoreConfirmBody", "This loads the version's content into the active version. Save to persist it.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.documents.form.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (restoreTarget) restoreVersion(restoreTarget); }}
            >
              {t("admin.documents.editor.versions.restore", "Load into editor")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New version dialog */}
      <Dialog open={newVersionOpen} onOpenChange={setNewVersionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.documents.editor.versions.newVersion", "New version")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("admin.documents.editor.versions.newVersionPrompt", "Create a new version from the current content")} — v{nextVersion(version.version)}
          </p>
          <div className="space-y-1.5">
            <Label>{t("admin.documents.editor.versions.changeNote", "Change note")}</Label>
            <Textarea
              value={newVersionNote}
              onChange={(e) => setNewVersionNote(e.target.value)}
              placeholder={t("admin.documents.editor.versions.changeNotePlaceholder", "What changed in this version?")}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewVersionOpen(false)} disabled={creatingVersion}>
              {t("admin.documents.form.cancel", "Cancel")}
            </Button>
            <Button onClick={createVersion} disabled={creatingVersion}>
              {creatingVersion ? t("admin.documents.editor.versions.creating", "Creating...") : t("admin.documents.editor.versions.create", "Create version")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview modal */}
      <PreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        blocks={blocks}
        variables={variables}
        language={meta.language}
        title={titleDraft || meta.title}
        version={version.version}
        onGeneratePdf={generatePdf}
        generating={generating}
        t={t}
      />
    </div>
  );
};

/* ── Block list (sortable) ─────────────────────────────────────────── */

interface BlockListProps {
  blocks: DocBlock[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (b: DocBlock) => void;
  onDragEnd: (e: DragEndEvent) => void;
  variables: VariableMap;
  t: (key: string, fallback?: string) => string;
}

const BlockList = ({ blocks, selectedId, onSelect, onDelete, onDragEnd, variables, t }: BlockListProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  if (blocks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        {t("admin.documents.editor.noSelectionHint", "Select a block to edit its fields, or insert one from the palette")}
      </div>
    );
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {blocks.map((b) => (
            <SortableBlock
              key={b.id}
              block={b}
              selected={b.id === selectedId}
              onSelect={() => onSelect(b.id)}
              onDelete={() => onDelete(b)}
              variables={variables}
              t={t}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

interface SortableBlockProps {
  block: DocBlock;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  variables: VariableMap;
  t: (key: string, fallback?: string) => string;
}

const SortableBlock = ({ block, selected, onSelect, onDelete, variables, t }: SortableBlockProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const Icon = PALETTE_ICONS[block.type] ?? FileText;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.7 : 1,
  } as React.CSSProperties;

  const preview = blockPreview(block, variables);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 rounded-lg border p-2 ${selected ? "border-[hsl(var(--brand))] ring-1 ring-[hsl(var(--brand))]" : ""}`}
    >
      <button
        type="button"
        className="mt-0.5 cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button type="button" className="flex-1 text-start" onClick={onSelect}>
        <div className="mb-1 flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t(`admin.documents.editor.block.${block.type}`, block.type)}
          </span>
        </div>
        {preview}
      </button>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

function blockPreview(block: DocBlock, variables: VariableMap): React.ReactNode {
  const r = (s: string) => resolveText(s, variables);
  const line = (s: string, className = "line-clamp-2 text-sm") => (
    <p className={className}>{s || <span className="text-muted-foreground/50">—</span>}</p>
  );
  switch (block.type) {
    case "cover":
      return (
        <div className="text-sm">
          <p className="font-semibold">{block.title || "—"}</p>
          {block.subtitle && <p className="text-xs text-muted-foreground">{block.subtitle}</p>}
          {block.note && <p className="text-xs text-muted-foreground">{block.note}</p>}
        </div>
      );
    case "heading":
      return line(block.level === 1 ? r(block.text) : r(block.text), block.level === 1 ? "text-sm font-semibold" : "ms-3 text-sm");
    case "paragraph":
      return line(r(block.text));
    case "list":
      return (
        <ul className="ms-4 list-disc text-sm">
          {(block.items.filter(Boolean).slice(0, 2).map(r)).map((it, i) => (
            <li key={i} className="line-clamp-1">{it}</li>
          ))}
          {block.items.length > 2 && <li className="text-xs text-muted-foreground">…</li>}
        </ul>
      );
    case "table":
      return (
        <p className="text-xs text-muted-foreground">
          {block.headers.filter(Boolean).join(" · ") || "—"} ({block.rows.length} rows)
        </p>
      );
    case "callout": {
      const tone = block.tone;
      const wrap = tone === "legal" ? "border-orange-400 bg-orange-50" : tone === "warning" ? "border-amber-300 bg-amber-50" : "border-blue-300 bg-blue-50";
      return (
        <div className={`rounded border-s-2 p-2 text-sm ${wrap}`}>
          {block.title && <p className="font-medium">{block.title}</p>}
          <p className="line-clamp-2">{r(block.text)}</p>
        </div>
      );
    }
    case "flow":
      return (
        <p className="text-xs text-muted-foreground">
          {block.title ? `${block.title}: ` : ""}{block.steps.filter(Boolean).length} steps
        </p>
      );
    case "signature":
      return <p className="text-xs text-muted-foreground">{block.parties.filter(Boolean).map(r).join(" · ") || "—"}</p>;
    case "disclaimer":
      return line(r(block.text), "text-xs italic text-muted-foreground");
    case "pagebreak":
      return <div className="my-1 border-t border-dashed border-slate-300" />;
    default:
      return null;
  }
}

/* ── Inspector ─────────────────────────────────────────────────────── */

interface InspectorProps {
  block: DocBlock;
  update: (patch: Partial<DocBlock>) => void;
  t: (key: string, fallback?: string) => string;
}

const BlockInspector = ({ block, update, t }: InspectorProps) => {
  switch (block.type) {
    case "cover":
      return (
        <div className="space-y-2">
          <Field label={t("admin.documents.editor.field.title", "Title")}>
            <Input value={block.title} onChange={(e) => update({ title: e.target.value })} />
          </Field>
          <Field label={t("admin.documents.editor.field.subtitle", "Subtitle")}>
            <Input value={block.subtitle ?? ""} onChange={(e) => update({ subtitle: e.target.value })} />
          </Field>
          <Field label={t("admin.documents.editor.field.note", "Note")}>
            <Textarea value={block.note ?? ""} onChange={(e) => update({ note: e.target.value })} rows={2} />
          </Field>
        </div>
      );
    case "heading":
      return (
        <div className="space-y-2">
          <Field label={t("admin.documents.editor.field.text", "Text")}>
            <Input value={block.text} onChange={(e) => update({ text: e.target.value })} />
          </Field>
          <Field label={t("admin.documents.editor.field.level", "Level")}>
            <Select value={String(block.level)} onValueChange={(v) => update({ level: Number(v) as 1 | 2 })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{t("admin.documents.editor.field.level1", "Section (H1)")}</SelectItem>
                <SelectItem value="2">{t("admin.documents.editor.field.level2", "Sub-heading (H2)")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      );
    case "paragraph":
      return (
        <Field label={t("admin.documents.editor.field.text", "Text")}>
          <Textarea value={block.text} onChange={(e) => update({ text: e.target.value })} rows={6} />
        </Field>
      );
    case "list":
      return (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.ordered ?? false}
              onChange={(e) => update({ ordered: e.target.checked })}
              className="h-4 w-4"
            />
            {t("admin.documents.editor.field.ordered", "Ordered")}
          </label>
          <Field label={t("admin.documents.editor.field.items", "Items")}>
            <StringListEditor items={block.items} onChange={(items) => update({ items })} t={t} />
          </Field>
        </div>
      );
    case "table":
      return (
        <div className="space-y-2">
          <Field label={t("admin.documents.editor.field.headers", "Headers")}>
            <StringListEditor items={block.headers} onChange={(headers) => update({ headers })} t={t} />
          </Field>
          <div className="space-y-1">
            <Label className="text-xs">{t("admin.documents.editor.field.rows", "Rows")}</Label>
            {block.rows.map((row, ri) => (
              <div key={ri} className="flex items-start gap-1">
                <div className="flex flex-1 flex-wrap gap-1">
                  {row.map((cell, ci) => (
                    <Input
                      key={ci}
                      value={cell}
                      onChange={(e) => {
                        const next = block.rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? e.target.value : c)) : r));
                        update({ rows: next });
                      }}
                      className="h-8 min-w-[80px] flex-1 text-xs"
                    />
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => update({ rows: block.rows.filter((_, i) => i !== ri) })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => update({ rows: [...block.rows, block.headers.map(() => "")] })}>
                <Plus className="me-1 h-3 w-3" />
                {t("admin.documents.editor.field.addRow", "Add row")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => update({ headers: [...block.headers, ""], rows: block.rows.map((r) => [...r, ""]) })}>
                <Plus className="me-1 h-3 w-3" />
                {t("admin.documents.editor.field.addColumn", "Add column")}
              </Button>
            </div>
          </div>
        </div>
      );
    case "callout":
      return (
        <div className="space-y-2">
          <Field label={t("admin.documents.editor.field.tone", "Tone")}>
            <Select value={block.tone} onValueChange={(v) => update({ tone: v as "info" | "warning" | "legal" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">{t("admin.documents.editor.field.toneInfo", "Info")}</SelectItem>
                <SelectItem value="warning">{t("admin.documents.editor.field.toneWarning", "Warning")}</SelectItem>
                <SelectItem value="legal">{t("admin.documents.editor.field.toneLegal", "Legal review")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("admin.documents.editor.field.title", "Title")}>
            <Input value={block.title ?? ""} onChange={(e) => update({ title: e.target.value })} />
          </Field>
          <Field label={t("admin.documents.editor.field.text", "Text")}>
            <Textarea value={block.text} onChange={(e) => update({ text: e.target.value })} rows={4} />
          </Field>
        </div>
      );
    case "flow":
      return (
        <div className="space-y-2">
          <Field label={t("admin.documents.editor.field.title", "Title")}>
            <Input value={block.title ?? ""} onChange={(e) => update({ title: e.target.value })} />
          </Field>
          <Field label={t("admin.documents.editor.field.steps", "Steps")}>
            <StringListEditor items={block.steps} onChange={(steps) => update({ steps })} t={t} />
          </Field>
        </div>
      );
    case "signature":
      return (
        <Field label={t("admin.documents.editor.field.parties", "Parties")}>
          <StringListEditor items={block.parties} onChange={(parties) => update({ parties })} t={t} />
        </Field>
      );
    case "disclaimer":
      return (
        <Field label={t("admin.documents.editor.field.text", "Text")}>
          <Textarea value={block.text} onChange={(e) => update({ text: e.target.value })} rows={4} />
        </Field>
      );
    case "pagebreak":
      return <p className="text-xs text-muted-foreground">{t("admin.documents.editor.field.noFields", "A page break has no editable fields")}</p>;
    default:
      return null;
  }
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
);

const StringListEditor = ({ items, onChange, t }: { items: string[]; onChange: (items: string[]) => void; t: (k: string, fb?: string) => string }) => (
  <div className="space-y-1">
    {items.map((it, i) => (
      <div key={i} className="flex items-center gap-1">
        <Input
          value={it}
          onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
          className="h-8 text-xs"
        />
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onChange(items.filter((_, j) => j !== i))}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    ))}
    <Button variant="outline" size="sm" onClick={() => onChange([...items, ""])}>
      <Plus className="me-1 h-3 w-3" />
      {t("admin.documents.editor.field.addItem", "Add item")}
    </Button>
  </div>
);

/* ── Versions panel ────────────────────────────────────────────────── */

interface VersionsPanelProps {
  versions: VersionRow[];
  authors: Record<string, string>;
  currentVersion: string;
  onRestore: (v: VersionRow) => void;
  onDownload: (v: VersionRow) => void;
  onNewVersion: () => void;
  t: (key: string, fallback?: string) => string;
}

const VersionsPanel = ({ versions, authors, currentVersion, onRestore, onDownload, onNewVersion, t }: VersionsPanelProps) => (
  <div className="space-y-3 p-3">
    <Button size="sm" onClick={onNewVersion} className="w-full">
      <Plus className="me-2 h-4 w-4" />
      {t("admin.documents.editor.versions.newVersion", "New version")}
    </Button>
    {versions.map((v) => (
      <div key={v.id} className="rounded-lg border p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-semibold">v{v.version}</span>
          {v.version === currentVersion && (
            <Badge variant="secondary" className="bg-[hsl(var(--brand))]/15 text-[hsl(var(--brand))]">
              {t("admin.documents.editor.versions.current", "Current")}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {new Date(v.created_at).toLocaleDateString()} ·{" "}
          {v.created_by ? (authors[v.created_by] ?? t("admin.documents.editor.versions.unknown", "Unknown")) : t("admin.documents.noAuthor", "System")}
        </p>
        {v.change_note && <p className="mt-1 text-xs">{v.change_note}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {v.pdf_path ? (
            <>
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                {t("admin.documents.editor.versions.pdfStored", "PDF stored")}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => onDownload(v)}>
                <FileText className="me-1 h-3 w-3" />
                {t("admin.documents.actions.downloadPdf", "Download PDF")}
              </Button>
            </>
          ) : (
            <Badge variant="secondary" className="bg-muted text-muted-foreground">
              {t("admin.documents.editor.versions.noPdf", "No PDF")}
            </Badge>
          )}
          {v.version !== currentVersion && (
            <Button variant="outline" size="sm" onClick={() => onRestore(v)}>
              <Copy className="me-1 h-3 w-3" />
              {t("admin.documents.editor.versions.restore", "Load into editor")}
            </Button>
          )}
        </div>
      </div>
    ))}
  </div>
);

/* ── Preview modal ────────────────────────────────────────────────── */

interface PreviewModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  blocks: DocBlock[];
  variables: VariableMap;
  language: DocLanguage;
  title: string;
  version: string;
  onGeneratePdf: () => void;
  generating: boolean;
  t: (key: string, fallback?: string) => string;
}

const PreviewModal = ({ open, onOpenChange, blocks, variables, language, title, version, onGeneratePdf, generating, t }: PreviewModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-[90vw] overflow-y-auto sm:max-w-[900px]">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0">
          <DialogTitle>{title} — v{version}</DialogTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onGeneratePdf} disabled={generating}>
              {generating ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <FileText className="me-2 h-4 w-4" />}
              {generating ? t("admin.documents.preview.generating", "Generating...") : t("admin.documents.preview.generatePdf", "Generate PDF")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Eye className="me-2 h-4 w-4" />
              {t("admin.documents.preview.print", "Print")}
            </Button>
          </div>
        </DialogHeader>
        <div className="overflow-x-auto">
          <DocumentPreview blocks={blocks} variables={variables} language={language} sheetId="darb-doc-preview" />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminDocumentEditorPage;
