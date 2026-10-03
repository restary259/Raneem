import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOfficeWorkspaceSelection } from "@/lib/officeWorkspace";
import type { TFunction } from "i18next";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  getOfficeGoogleMediaSummary,
  getOfficeGooglePostsSummary,
  listMyGoogleOffices,
  listOfficeGoogleMedia,
  listOfficeGooglePosts,
} from "@/lib/googleBusinessApi";
import {
  createGooglePostDraft,
  deleteGooglePost,
  publishGooglePost,
  syncGooglePosts,
  updateGooglePostDraft,
} from "@/lib/googleBusinessPosts.functions";
import { useServerFn } from "@tanstack/react-start";
import {
  GBP_POST_LANGUAGES,
  GBP_POST_SUMMARY_MAX,
  validateGbpPostDraft,
  type GbpPostCtaType,
  type GbpPostDraft,
  type GbpPostTopicType,
} from "@/lib/googleBusinessGateway";
import type {
  GoogleBusinessMediaListRow,
  GoogleBusinessPostListRow,
  GooglePostFilter,
  GooglePostKind,
  MyGoogleOfficeRow,
  OfficeGooglePostsSummaryRow,
} from "@/types/googleBusiness";
import { googlePostKind, isGooglePostEditable } from "@/types/googleBusiness";

const PAGE_SIZE = 30;

const STATUS_FILTERS: { key: GooglePostFilter; labelKey: string }[] = [
  { key: "all", labelKey: "googlePosts.filterAll" },
  { key: "published", labelKey: "googlePosts.published" },
  { key: "drafts", labelKey: "googlePosts.draft" },
  { key: "failed", labelKey: "googlePosts.failed" },
];

const CTA_TYPES: GbpPostCtaType[] = [
  "LEARN_MORE",
  "SIGN_UP",
  "BOOK",
  "CALL",
  "ORDER",
  "SHOP",
];

const KIND_LABEL: Record<GooglePostKind, string> = {
  UPDATE: "googlePosts.update",
  EVENT: "googlePosts.event",
  OFFER: "googlePosts.offer",
  CTA: "googlePosts.callToAction",
};

function errorMessage(error: unknown): string | undefined {
  return (error as { message?: string } | null)?.message;
}

function relativeTime(value: string | null, t: TFunction<"dashboard">): string {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("notifications.justNow");
  if (mins < 60) return t("notifications.minutesAgo", { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("notifications.hoursAgo", { count: hrs });
  const days = Math.floor(hrs / 24);
  if (days < 30) return t("notifications.daysAgo", { count: days });
  return new Date(value).toLocaleDateString();
}

/** Converts an ISO timestamp to a value a datetime-local input understands. */
function toLocalInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyDraft(): GbpPostDraft {
  return {
    topic_type: "STANDARD",
    language_code: "en",
    summary: "",
    cta_type: null,
    cta_url: null,
    event_title: null,
    event_start: null,
    event_end: null,
    offer_coupon_code: null,
    offer_url: null,
    offer_terms: null,
    media_ids: [],
  };
}

/**
 * The Google Posts center (Phase 7).
 *
 * A DARB post is always drafted locally before it is published. Publishing is a
 * preview-then-confirm flow, and a Google rejection retains the draft (marked
 * FAILED) rather than losing the operator's work.
 */
export default function TeamGooglePostsPage() {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();

  const [offices, setOffices] = useState<MyGoogleOfficeRow[]>([]);
  // Office context from the canonical office route (or legacy ?office=slug).
  const { officeId: workspaceOfficeId } = useOfficeWorkspaceSelection();
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [summary, setSummary] = useState<OfficeGooglePostsSummaryRow | null>(
    null,
  );
  const [posts, setPosts] = useState<GoogleBusinessPostListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<GooglePostFilter>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [composer, setComposer] = useState<{
    open: boolean;
    post: GoogleBusinessPostListRow | null;
  }>({ open: false, post: null });
  const [confirmDelete, setConfirmDelete] =
    useState<GoogleBusinessPostListRow | null>(null);

  const runSync = useServerFn(syncGooglePosts);
  const runDelete = useServerFn(deleteGooglePost);

  const loadOffices = useCallback(async () => {
    const { data, error } = await listMyGoogleOffices();
    if (error) {
      toast({ variant: "destructive", description: error.message });
      return;
    }
    const list = data || [];
    setOffices(list);
    setOfficeId(
      (current) =>
        current ??
        (workspaceOfficeId && list.some((o) => o.office_id === workspaceOfficeId)
          ? workspaceOfficeId
          : (list[0]?.office_id ?? null)),
    );
  }, [toast, workspaceOfficeId]);

  useEffect(() => {
    loadOffices();
  }, [loadOffices]);

  // Follow the URL's office when it changes (e.g. navigating between offices).
  useEffect(() => {
    if (
      workspaceOfficeId &&
      offices.some((o) => o.office_id === workspaceOfficeId)
    ) {
      setOfficeId(workspaceOfficeId);
    }
  }, [workspaceOfficeId, offices]);

  const load = useCallback(async () => {
    if (!officeId) return;
    setLoading(true);
    try {
      const [summaryRes, listRes] = await Promise.all([
        getOfficeGooglePostsSummary(officeId),
        listOfficeGooglePosts({
          officeId,
          status: filter,
          limit: PAGE_SIZE,
          offset,
        }),
      ]);
      if (summaryRes.error) throw summaryRes.error;
      if (listRes.error) throw listRes.error;
      setSummary((summaryRes.data || [])[0] || null);
      const rows = listRes.data || [];
      setPosts(rows);
      setTotal(rows[0]?.total_count ?? 0);
    } catch (error) {
      toast({ variant: "destructive", description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [officeId, filter, offset, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setOffset(0);
  }, [officeId, filter]);

  const handleSync = useCallback(async () => {
    if (!officeId) return;
    setBusy(true);
    try {
      const result = await runSync({ data: { officeId } });
      if (!result.ok) throw new Error(result.errorMessage || result.status);
      toast({ description: t("googlePosts.syncDone") });
      await load();
    } catch (error) {
      toast({ variant: "destructive", description: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }, [officeId, runSync, load, t, toast]);

  const doDelete = useCallback(async () => {
    if (!officeId || !confirmDelete) return;
    setBusy(true);
    try {
      const result = await runDelete({
        data: { officeId, postId: confirmDelete.id },
      });
      if (!result.ok) throw new Error(result.errorMessage || result.status);
      toast({ description: t("googlePosts.deleted") });
      setConfirmDelete(null);
      await load();
    } catch (error) {
      toast({ variant: "destructive", description: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }, [officeId, confirmDelete, runDelete, load, t, toast]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 pt-4 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          {offices.length > 1 ? (
            <Select value={officeId ?? ""} onValueChange={setOfficeId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {offices.map((o) => (
                  <SelectItem key={o.office_id} value={o.office_id}>
                    {o.office_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <h1 className="truncate text-2xl font-semibold">
              {offices[0]?.office_name ?? t("googlePosts.title")}
            </h1>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || !officeId}
            onClick={handleSync}
          >
            <RefreshCw
              className={busy ? "me-2 size-4 animate-spin" : "me-2 size-4"}
            />
            {t("googlePosts.refresh")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || !officeId}
            onClick={() => setComposer({ open: true, post: null })}
          >
            <Plus className="me-2 size-4" />
            {t("googlePosts.create")}
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.key}
            type="button"
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
          >
            {t(f.labelKey)}
          </Button>
        ))}
        {summary?.posts_last_successful_sync_at ? (
          <span className="ms-auto text-xs text-muted-foreground">
            {t("googlePosts.lastSynced", {
              time: relativeTime(summary.posts_last_successful_sync_at, t),
            })}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="space-y-2 py-10 text-center">
            <Megaphone className="mx-auto size-8 text-muted-foreground" />
            <p className="text-sm font-medium">{t("googlePosts.emptyTitle")}</p>
            <p className="text-sm text-muted-foreground">
              {t("googlePosts.emptyDesc")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              t={t}
              onEdit={() => setComposer({ open: true, post })}
              onDelete={() => setConfirmDelete(post)}
            />
          ))}
        </div>
      )}

      {total > PAGE_SIZE ? (
        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            {t("googlePosts.prev")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            {t("googlePosts.next")}
          </Button>
        </div>
      ) : null}

      {officeId ? (
        <PostComposer
          key={`${officeId}:${composer.post?.id ?? "new"}:${composer.open}`}
          officeId={officeId}
          officeName={
            offices.find((o) => o.office_id === officeId)?.office_name ?? ""
          }
          open={composer.open}
          editing={composer.post}
          onClose={() => setComposer({ open: false, post: null })}
          onSaved={load}
        />
      ) : null}

      <Dialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              {t("googlePosts.deleteConfirmTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("googlePosts.deleteConfirmDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmDelete(null)}
            >
              {t("googlePosts.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={doDelete}
            >
              {busy ? (
                <Clock3 className="me-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="me-2 size-4" />
              )}
              {t("googlePosts.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PostCard({
  post,
  t,
  onEdit,
  onDelete,
}: {
  post: GoogleBusinessPostListRow;
  t: TFunction<"dashboard">;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const kind = googlePostKind(post);
  const editable = isGooglePostEditable(post.status);
  const image = post.media_urls?.[0];
  return (
    <Card className="min-w-0 overflow-hidden rounded-2xl border-border shadow-sm">
      {image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          className="h-40 w-full object-cover"
        />
      ) : null}
      <CardContent className="min-w-0 space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{t(KIND_LABEL[kind])}</Badge>
          <Badge
            variant={
              post.status === "PUBLISHED"
                ? "default"
                : post.status === "FAILED"
                  ? "destructive"
                  : "outline"
            }
          >
            {t(`googlePosts.status.${post.status}`)}
          </Badge>
          <span className="text-xs text-muted-foreground uppercase">
            {post.language_code}
          </span>
        </div>
        {post.event_title ? (
          <p className="truncate text-sm font-semibold">{post.event_title}</p>
        ) : null}
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {post.summary}
        </p>
        {post.cta_type ? (
          <p className="flex items-center gap-1 text-xs font-medium text-primary">
            {t(`googlePosts.ctaType.${post.cta_type}`)}
            <ExternalLink className="size-3" />
          </p>
        ) : null}
        {post.status === "FAILED" && post.last_error_message ? (
          <p className="flex items-start gap-1 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
            {post.last_error_message}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {post.status === "PUBLISHED" && post.published_at
            ? t("googlePosts.publishedOn", {
                date: new Date(post.published_at).toLocaleDateString(),
              })
            : t("googlePosts.updatedOn", {
                date: new Date(post.updated_at).toLocaleDateString(),
              })}
        </p>
        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!editable}
            onClick={onEdit}
          >
            <Pencil className="me-2 size-3.5" />
            {t("googlePosts.edit")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={post.status === "DELETED"}
            onClick={onDelete}
          >
            <Trash2 className="me-2 size-3.5" />
            {t("googlePosts.delete")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type ComposerStep = "edit" | "preview";

function PostComposer({
  officeId,
  officeName,
  open,
  editing,
  onClose,
  onSaved,
}: {
  officeId: string;
  officeName: string;
  open: boolean;
  editing: GoogleBusinessPostListRow | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();

  const runCreate = useServerFn(createGooglePostDraft);
  const runUpdate = useServerFn(updateGooglePostDraft);
  const runPublish = useServerFn(publishGooglePost);

  const [step, setStep] = useState<ComposerStep>("edit");
  const [draft, setDraft] = useState<GbpPostDraft>(() =>
    editing
      ? {
          topic_type: editing.topic_type as GbpPostTopicType,
          language_code: editing.language_code,
          summary: editing.summary ?? "",
          cta_type: (editing.cta_type ?? null) as GbpPostCtaType | null,
          cta_url: editing.cta_url,
          event_title: editing.event_title,
          event_start: editing.event_start,
          event_end: editing.event_end,
          offer_coupon_code: editing.offer_coupon_code,
          offer_url: editing.offer_url,
          offer_terms: editing.offer_terms,
          media_ids: editing.media_ids ?? [],
        }
      : emptyDraft(),
  );
  const [postId, setPostId] = useState<string | null>(editing?.id ?? null);
  const [version, setVersion] = useState<number | null>(
    editing?.version ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<GoogleBusinessMediaListRow[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const validation = useMemo(() => validateGbpPostDraft(draft), [draft]);
  const kind: GooglePostKind =
    draft.topic_type === "EVENT"
      ? "EVENT"
      : draft.topic_type === "OFFER"
        ? "OFFER"
        : draft.cta_type
          ? "CTA"
          : "UPDATE";

  const loadPhotos = useCallback(async () => {
    setPhotosLoading(true);
    try {
      const [summaryRes, listRes] = await Promise.all([
        getOfficeGoogleMediaSummary(officeId),
        listOfficeGoogleMedia({ officeId, origin: "BUSINESS", limit: 100 }),
      ]);
      void summaryRes;
      if (!listRes.error) setPhotos(listRes.data || []);
    } finally {
      setPhotosLoading(false);
    }
  }, [officeId]);

  useEffect(() => {
    if (open) loadPhotos();
  }, [open, loadPhotos]);

  const set = useCallback(
    <K extends keyof GbpPostDraft>(key: K, value: GbpPostDraft[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  /** Persist the draft locally (never touches Google). */
  const saveDraft = useCallback(async (): Promise<string | null> => {
    if (validation) {
      toast({
        variant: "destructive",
        description: t(`googlePosts.validation.${validation}`),
      });
      return null;
    }
    setBusy(true);
    try {
      if (postId) {
        const result = await runUpdate({
          data: { officeId, postId, post: draft, expectedVersion: version },
        });
        if (!result.ok) throw new Error(result.errorMessage || result.status);
        setVersion(result.version);
        toast({ description: t("googlePosts.draftSaved") });
      } else {
        const result = await runCreate({ data: { officeId, post: draft } });
        if (!result.ok) throw new Error(result.errorMessage || result.status);
        setPostId(result.postId);
        setVersion(result.version);
        toast({ description: t("googlePosts.draftSaved") });
      }
      await onSaved();
      return postId;
    } catch (error) {
      toast({ variant: "destructive", description: errorMessage(error) });
      return null;
    } finally {
      setBusy(false);
    }
  }, [
    validation,
    postId,
    officeId,
    draft,
    version,
    runUpdate,
    runCreate,
    onSaved,
    t,
    toast,
  ]);

  /** Preview: ensure the draft exists, then show the Google-style preview. */
  const goPreview = useCallback(async () => {
    if (validation) {
      toast({
        variant: "destructive",
        description: t(`googlePosts.validation.${validation}`),
      });
      return;
    }
    setBusy(true);
    try {
      if (postId) {
        const result = await runUpdate({
          data: { officeId, postId, post: draft, expectedVersion: version },
        });
        if (!result.ok) throw new Error(result.errorMessage || result.status);
        setVersion(result.version);
      } else {
        const result = await runCreate({ data: { officeId, post: draft } });
        if (!result.ok) throw new Error(result.errorMessage || result.status);
        setPostId(result.postId);
        setVersion(result.version);
      }
      await onSaved();
      setStep("preview");
    } catch (error) {
      toast({ variant: "destructive", description: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }, [
    validation,
    postId,
    officeId,
    draft,
    version,
    runUpdate,
    runCreate,
    onSaved,
    t,
    toast,
  ]);

  const doPublish = useCallback(async () => {
    if (!postId) return;
    setBusy(true);
    try {
      const idempotencyKey = `${officeId}:${postId}:${version ?? 0}`;
      const result = await runPublish({
        data: { officeId, postId, idempotencyKey },
      });
      if (!result.ok) throw new Error(result.errorMessage || result.status);
      toast({ description: t("googlePosts.publishedToast") });
      setConfirmPublish(false);
      await onSaved();
      onClose();
    } catch (error) {
      // The draft is retained and marked FAILED — never destroyed.
      toast({ variant: "destructive", description: errorMessage(error) });
      await onSaved();
    } finally {
      setBusy(false);
    }
  }, [postId, officeId, version, runPublish, onSaved, onClose, t, toast]);

  const selectedPhoto = photos.find((p) => p.id === draft.media_ids[0]) ?? null;
  const previewImage =
    selectedPhoto?.google_thumbnail_url ??
    selectedPhoto?.google_full_url ??
    null;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t("googlePosts.editTitle")
                : t("googlePosts.createTitle")}
            </DialogTitle>
            <DialogDescription>{officeName}</DialogDescription>
          </DialogHeader>

          {step === "edit" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("googlePosts.postType")}</Label>
                <div className="flex flex-wrap gap-2">
                  {(
                    ["UPDATE", "EVENT", "OFFER", "CTA"] as GooglePostKind[]
                  ).map((k) => (
                    <Button
                      key={k}
                      type="button"
                      size="sm"
                      variant={kind === k ? "default" : "outline"}
                      onClick={() => {
                        if (k === "EVENT") set("topic_type", "EVENT");
                        else if (k === "OFFER") set("topic_type", "OFFER");
                        else if (k === "CTA") {
                          set("topic_type", "STANDARD");
                          if (!draft.cta_type) set("cta_type", "LEARN_MORE");
                        } else {
                          set("topic_type", "STANDARD");
                          set("cta_type", null);
                          set("cta_url", null);
                        }
                      }}
                    >
                      {t(KIND_LABEL[k])}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("googlePosts.productUnavailable")}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="post-language">
                    {t("googlePosts.language")}
                  </Label>
                  <Select
                    value={draft.language_code}
                    onValueChange={(v) => set("language_code", v)}
                  >
                    <SelectTrigger id="post-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GBP_POST_LANGUAGES.map((l) => (
                        <SelectItem key={l} value={l}>
                          {t(`googlePosts.languageName.${l}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {draft.topic_type === "EVENT" ? (
                <div className="space-y-3 rounded-xl border border-border p-3">
                  <div className="space-y-2">
                    <Label htmlFor="event-title">
                      {t("googlePosts.eventTitle")}
                    </Label>
                    <Input
                      id="event-title"
                      value={draft.event_title ?? ""}
                      onChange={(e) => set("event_title", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="event-start">
                        {t("googlePosts.eventStart")}
                      </Label>
                      <Input
                        id="event-start"
                        type="datetime-local"
                        value={toLocalInput(draft.event_start)}
                        onChange={(e) =>
                          set(
                            "event_start",
                            e.target.value
                              ? new Date(e.target.value).toISOString()
                              : null,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="event-end">
                        {t("googlePosts.eventEnd")}
                      </Label>
                      <Input
                        id="event-end"
                        type="datetime-local"
                        value={toLocalInput(draft.event_end)}
                        onChange={(e) =>
                          set(
                            "event_end",
                            e.target.value
                              ? new Date(e.target.value).toISOString()
                              : null,
                          )
                        }
                      />
                    </div>
                  </div>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="size-3" />
                    {t("googlePosts.timezoneHint")}
                  </p>
                </div>
              ) : null}

              {draft.topic_type === "OFFER" ? (
                <div className="space-y-3 rounded-xl border border-border p-3">
                  <div className="space-y-2">
                    <Label htmlFor="offer-coupon">
                      {t("googlePosts.offerCoupon")}
                    </Label>
                    <Input
                      id="offer-coupon"
                      value={draft.offer_coupon_code ?? ""}
                      onChange={(e) => set("offer_coupon_code", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="offer-url">
                      {t("googlePosts.offerUrl")}
                    </Label>
                    <Input
                      id="offer-url"
                      type="url"
                      placeholder="https://"
                      value={draft.offer_url ?? ""}
                      onChange={(e) => set("offer_url", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="offer-terms">
                      {t("googlePosts.offerTerms")}
                    </Label>
                    <Input
                      id="offer-terms"
                      value={draft.offer_terms ?? ""}
                      onChange={(e) => set("offer_terms", e.target.value)}
                    />
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="post-content">{t("googlePosts.content")}</Label>
                <Textarea
                  id="post-content"
                  rows={5}
                  value={draft.summary}
                  maxLength={GBP_POST_SUMMARY_MAX}
                  onChange={(e) => set("summary", e.target.value)}
                />
                <p className="text-end text-xs text-muted-foreground">
                  {draft.summary.length}/{GBP_POST_SUMMARY_MAX}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t("googlePosts.media")}</Label>
                {photosLoading ? (
                  <div className="flex gap-2">
                    <Skeleton className="size-16 rounded-lg" />
                    <Skeleton className="size-16 rounded-lg" />
                    <Skeleton className="size-16 rounded-lg" />
                  </div>
                ) : photos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("googlePosts.noMedia")}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {photos.slice(0, 12).map((photo) => {
                      const selected = draft.media_ids[0] === photo.id;
                      return (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() =>
                            set("media_ids", selected ? [] : [photo.id])
                          }
                          className={`relative size-16 overflow-hidden rounded-lg border-2 ${
                            selected ? "border-primary" : "border-transparent"
                          }`}
                        >
                          <img
                            src={
                              photo.google_thumbnail_url ??
                              photo.google_full_url ??
                              ""
                            }
                            alt=""
                            loading="lazy"
                            className="size-full object-cover"
                          />
                          {selected ? (
                            <span className="absolute inset-0 flex items-center justify-center bg-primary/30">
                              <Check className="size-5 text-white" />
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="post-cta">{t("googlePosts.cta")}</Label>
                  <Select
                    value={draft.cta_type ?? "none"}
                    onValueChange={(v) =>
                      set(
                        "cta_type",
                        v === "none" ? null : (v as GbpPostCtaType),
                      )
                    }
                  >
                    <SelectTrigger id="post-cta">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {t("googlePosts.ctaNone")}
                      </SelectItem>
                      {CTA_TYPES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {t(`googlePosts.ctaType.${c}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {draft.cta_type && draft.cta_type !== "CALL" ? (
                  <div className="space-y-2">
                    <Label htmlFor="post-url">{t("googlePosts.url")}</Label>
                    <Input
                      id="post-url"
                      type="url"
                      placeholder="https://"
                      value={draft.cta_url ?? ""}
                      onChange={(e) => set("cta_url", e.target.value)}
                    />
                  </div>
                ) : null}
              </div>

              {validation ? (
                <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  {t(`googlePosts.validation.${validation}`)}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <Badge variant="outline">{t("googlePosts.preview")}</Badge>
              <div className="overflow-hidden rounded-2xl border border-border">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt=""
                    className="h-48 w-full object-cover"
                  />
                ) : null}
                <div className="space-y-2 p-4">
                  <p className="font-semibold">{officeName}</p>
                  {draft.event_title ? (
                    <p className="text-sm font-medium">{draft.event_title}</p>
                  ) : null}
                  <p className="whitespace-pre-wrap text-sm">{draft.summary}</p>
                  {draft.cta_type ? (
                    <span className="inline-block rounded-md border border-primary px-3 py-1 text-xs font-medium text-primary">
                      {t(`googlePosts.ctaType.${draft.cta_type}`)}
                    </span>
                  ) : null}
                  {draft.cta_url ? (
                    <p dir="ltr" className="text-xs text-muted-foreground">
                      {draft.cta_url}
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("googlePosts.previewDisclaimer")}
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            {step === "edit" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={onClose}
                >
                  <X className="me-2 size-4" />
                  {t("googlePosts.cancel")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={saveDraft}
                >
                  {busy ? (
                    <Loader2 className="me-2 size-4 animate-spin" />
                  ) : (
                    <Tag className="me-2 size-4" />
                  )}
                  {t("googlePosts.saveDraft")}
                </Button>
                <Button
                  type="button"
                  disabled={busy || Boolean(validation)}
                  onClick={goPreview}
                >
                  {busy ? (
                    <Loader2 className="me-2 size-4 animate-spin" />
                  ) : null}
                  {t("googlePosts.preview")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setStep("edit")}
                >
                  {t("googlePosts.backToEdit")}
                </Button>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmPublish(true)}
                >
                  <Megaphone className="me-2 size-4" />
                  {t("googlePosts.publish")}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmPublish}
        onOpenChange={(o) => !o && setConfirmPublish(false)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("googlePosts.publishConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("googlePosts.publishConfirmDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmPublish(false)}
            >
              {t("googlePosts.cancel")}
            </Button>
            <Button type="button" disabled={busy} onClick={doPublish}>
              {busy ? (
                <Loader2 className="me-2 size-4 animate-spin" />
              ) : (
                <Megaphone className="me-2 size-4" />
              )}
              {t("googlePosts.publishConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
