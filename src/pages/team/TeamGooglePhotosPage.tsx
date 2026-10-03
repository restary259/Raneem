import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useOfficeWorkspaceSelection } from "@/lib/officeWorkspace";
import { useOfficeWorkspaceContext } from "@/components/office/OfficeWorkspaceLayout";
import type { TFunction } from "i18next";
import {
  AlertTriangle,
  Check,
  Clock3,
  ImagePlus,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  getOfficeGoogleMediaSummary,
  listMyGoogleOffices,
  listOfficeGoogleMedia,
} from "@/lib/googleBusinessApi";
import {
  deleteGoogleMedia,
  syncGoogleMedia,
  uploadGoogleMedia,
} from "@/lib/googleBusinessMedia.functions";
import { useServerFn } from "@tanstack/react-start";
import {
  DARB_MEDIA_CATEGORIES,
  validateMediaDimensions,
  validateMediaFile,
  type DarbMediaCategory,
} from "@/lib/googleBusinessGateway";
import type {
  GoogleBusinessMediaListRow,
  MyGoogleOfficeRow,
  OfficeGoogleMediaSummaryRow,
} from "@/types/googleBusiness";

const PAGE_SIZE = 60;

const CATEGORY_FILTERS: { key: string; labelKey: string }[] = [
  { key: "all", labelKey: "googleMedia.filterAll" },
  { key: "cover", labelKey: "googleMedia.cover" },
  { key: "logo", labelKey: "googleMedia.logo" },
  { key: "exterior", labelKey: "googleMedia.exterior" },
  { key: "interior", labelKey: "googleMedia.interior" },
  { key: "team", labelKey: "googleMedia.team" },
  { key: "other", labelKey: "googleMedia.other" },
];

type UploadItem = {
  id: string;
  name: string;
  previewUrl: string;
  dataBase64: string;
  mime: string;
  darbCategory: DarbMediaCategory;
  state: "validating" | "ready" | "uploading" | "published" | "failed";
  error?: string;
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

/** Reads a File into base64 without a data: prefix. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read_failed"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(
        result.includes(",") ? result.slice(result.indexOf(",") + 1) : result,
      );
    };
    reader.readAsDataURL(file);
  });
}

/** Decodes dimensions so a broken/undersized image is rejected before upload. */
function readDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode_failed"));
    };
    img.src = url;
  });
}

/**
 * The Google Business Photos center (Phase 7).
 *
 * Visual-first grid with server-side category filtering, thumbnail-first
 * rendering and a lightbox. Business photos can be uploaded/deleted; customer
 * photos are view-only and never offer an edit/delete action.
 */
export default function TeamGooglePhotosPage() {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();

  const [offices, setOffices] = useState<MyGoogleOfficeRow[]>([]);
  // Office context from the canonical office route (or legacy ?office=slug).
  const { officeId: workspaceOfficeId } = useOfficeWorkspaceSelection();
  // On the canonical office route the layout already resolved/authorized the
  // office; inherit it and hide the redundant selector there.
  const workspaceContext = useOfficeWorkspaceContext();
  const inOfficeWorkspace = workspaceContext !== null;
  const effectiveOfficeId = workspaceContext?.officeId ?? workspaceOfficeId;
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [summary, setSummary] = useState<OfficeGoogleMediaSummaryRow | null>(
    null,
  );
  const [media, setMedia] = useState<GoogleBusinessMediaListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [category, setCategory] = useState("all");
  const [origin, setOrigin] = useState<"all" | "BUSINESS" | "CUSTOMER">("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [lightbox, setLightbox] = useState<GoogleBusinessMediaListRow | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] =
    useState<GoogleBusinessMediaListRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const runSync = useServerFn(syncGoogleMedia);
  const runUpload = useServerFn(uploadGoogleMedia);
  const runDelete = useServerFn(deleteGoogleMedia);

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
        (effectiveOfficeId &&
        list.some((o) => o.office_id === effectiveOfficeId)
          ? effectiveOfficeId
          : (list[0]?.office_id ?? null)),
    );
  }, [toast, effectiveOfficeId]);

  useEffect(() => {
    loadOffices();
  }, [loadOffices]);

  // Follow the URL's office when it changes (e.g. navigating between offices).
  useEffect(() => {
    if (
      effectiveOfficeId &&
      offices.some((o) => o.office_id === effectiveOfficeId)
    ) {
      setOfficeId(effectiveOfficeId);
    }
  }, [effectiveOfficeId, offices]);

  const load = useCallback(async () => {
    if (!officeId) return;
    setLoading(true);
    try {
      const [summaryRes, listRes] = await Promise.all([
        getOfficeGoogleMediaSummary(officeId),
        listOfficeGoogleMedia({
          officeId,
          category: category as never,
          origin,
          limit: PAGE_SIZE,
          offset,
        }),
      ]);
      if (summaryRes.error) throw summaryRes.error;
      if (listRes.error) throw listRes.error;
      setSummary((summaryRes.data || [])[0] || null);
      const rows = listRes.data || [];
      setMedia(rows);
      setTotal(rows[0]?.total_count ?? 0);
    } catch (error) {
      toast({ variant: "destructive", description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [officeId, category, origin, offset, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setOffset(0);
  }, [officeId, category, origin]);

  const handleSync = useCallback(async () => {
    if (!officeId) return;
    setBusy(true);
    try {
      const result = await runSync({ data: { officeId } });
      if (!result.ok) throw new Error(result.errorMessage || result.status);
      toast({ description: t("googleMedia.syncDone") });
      await load();
    } catch (error) {
      toast({ variant: "destructive", description: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }, [officeId, runSync, load, t, toast]);

  const onPickFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const next: UploadItem[] = [];
      for (const file of Array.from(files).slice(0, 10)) {
        const id = crypto.randomUUID();
        const previewUrl = URL.createObjectURL(file);
        const sizeCheck = validateMediaFile(file);
        if (sizeCheck) {
          next.push({
            id,
            name: file.name,
            previewUrl,
            dataBase64: "",
            mime: file.type,
            darbCategory: "other",
            state: "failed",
            error: t(`googleMedia.error.${sizeCheck}`),
          });
          continue;
        }
        let dims: { width: number; height: number };
        try {
          dims = await readDimensions(file);
        } catch {
          next.push({
            id,
            name: file.name,
            previewUrl,
            dataBase64: "",
            mime: file.type,
            darbCategory: "other",
            state: "failed",
            error: t("googleMedia.error.bad_dimensions"),
          });
          continue;
        }
        const dimCheck = validateMediaDimensions(dims.width, dims.height);
        if (dimCheck) {
          next.push({
            id,
            name: file.name,
            previewUrl,
            dataBase64: "",
            mime: file.type,
            darbCategory: "other",
            state: "failed",
            error: t(`googleMedia.error.${dimCheck}`),
          });
          continue;
        }
        const dataBase64 = await fileToBase64(file);
        next.push({
          id,
          name: file.name,
          previewUrl,
          dataBase64,
          mime: file.type,
          darbCategory: "other",
          state: "ready",
        });
      }
      setUploads((prev) => [...prev, ...next]);
      setUploadOpen(true);
    },
    [t],
  );

  const setUploadCategory = useCallback(
    (id: string, value: DarbMediaCategory) => {
      setUploads((prev) =>
        prev.map((u) => (u.id === id ? { ...u, darbCategory: value } : u)),
      );
    },
    [],
  );

  const removeUpload = useCallback((id: string) => {
    setUploads((prev) => {
      const target = prev.find((u) => u.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((u) => u.id !== id);
    });
  }, []);

  const doUpload = useCallback(async () => {
    if (!officeId) return;
    const pending = uploads.filter((u) => u.state === "ready");
    if (!pending.length) return;
    setBusy(true);
    try {
      for (const item of pending) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === item.id ? { ...u, state: "uploading" } : u,
          ),
        );
        // A per-item operation id makes a retry idempotent server-side.
        const operationId = `${officeId}:${item.id}`;
        try {
          const result = await runUpload({
            data: {
              officeId,
              dataBase64: item.dataBase64,
              declaredMime: item.mime,
              darbCategory: item.darbCategory,
              uploadOperationId: operationId,
            },
          });
          if (!result.ok) throw new Error(result.errorMessage || result.status);
          setUploads((prev) =>
            prev.map((u) =>
              u.id === item.id ? { ...u, state: "published" } : u,
            ),
          );
        } catch (error) {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === item.id
                ? { ...u, state: "failed", error: errorMessage(error) }
                : u,
            ),
          );
        }
      }
      toast({ description: t("googleMedia.uploadComplete") });
      await load();
    } finally {
      setBusy(false);
    }
  }, [officeId, uploads, runUpload, load, t, toast]);

  const doDelete = useCallback(async () => {
    if (!officeId || !confirmDelete) return;
    setBusy(true);
    try {
      const result = await runDelete({
        data: { officeId, mediaId: confirmDelete.id },
      });
      if (!result.ok) throw new Error(result.errorMessage || result.status);
      toast({ description: t("googleMedia.deleted") });
      setConfirmDelete(null);
      setLightbox(null);
      await load();
    } catch (error) {
      toast({ variant: "destructive", description: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }, [officeId, confirmDelete, runDelete, load, t, toast]);

  const counts = useMemo(
    () => ({
      all: (summary?.business_count ?? 0) + (summary?.customer_count ?? 0),
      cover: summary?.cover_count ?? 0,
      logo: summary?.logo_count ?? 0,
      exterior: summary?.exterior_count ?? 0,
      interior: summary?.interior_count ?? 0,
      team: summary?.team_count ?? 0,
      other: summary?.other_count ?? 0,
    }),
    [summary],
  );

  const publishedCount = uploads.filter((u) => u.state === "published").length;
  const failedCount = uploads.filter((u) => u.state === "failed").length;
  const uploadingCount = uploads.filter((u) => u.state === "uploading").length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 pt-4 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          {!inOfficeWorkspace && offices.length > 1 ? (
            <Select
              value={officeId ?? ""}
              onValueChange={(v) => setOfficeId(v)}
            >
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
              {workspaceContext?.context.office.name ??
                offices[0]?.office_name ??
                t("googleMedia.title")}
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
            {t("googleMedia.refresh")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || !officeId}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="me-2 size-4" />
            {t("googleMedia.upload")}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              onPickFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {CATEGORY_FILTERS.map((f) => (
          <Button
            key={f.key}
            type="button"
            size="sm"
            variant={category === f.key ? "default" : "outline"}
            onClick={() => setCategory(f.key)}
          >
            {t(f.labelKey)}
            <span className="ms-1.5 text-xs opacity-70">
              {counts[f.key as keyof typeof counts] ?? 0}
            </span>
          </Button>
        ))}
        <div className="ms-auto flex items-center gap-2">
          <Select
            value={origin}
            onValueChange={(v) => setOrigin(v as typeof origin)}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("googleMedia.originAll")}</SelectItem>
              <SelectItem value="BUSINESS">
                {t("googleMedia.originBusiness")}
              </SelectItem>
              <SelectItem value="CUSTOMER">
                {t("googleMedia.originCustomer")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("googleMedia.count", { count: total })}
        {summary?.media_last_successful_sync_at
          ? ` · ${t("googleMedia.lastSynced", {
              time: relativeTime(summary.media_last_successful_sync_at, t),
            })}`
          : ""}
      </p>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      ) : media.length === 0 ? (
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="space-y-2 py-10 text-center">
            <ImagePlus className="mx-auto size-8 text-muted-foreground" />
            <p className="text-sm font-medium">{t("googleMedia.emptyTitle")}</p>
            <p className="text-sm text-muted-foreground">
              {t("googleMedia.emptyDesc")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setLightbox(item)}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {item.google_thumbnail_url || item.google_full_url ? (
                <img
                  src={item.google_thumbnail_url ?? item.google_full_url ?? ""}
                  alt={item.description ?? ""}
                  loading="lazy"
                  className="size-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <span className="flex size-full items-center justify-center text-muted-foreground">
                  <ImagePlus className="size-6" />
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2">
                <Badge variant="secondary" className="text-[10px]">
                  {t(`googleMedia.${item.darb_category ?? "other"}`)}
                </Badge>
                {item.media_origin === "CUSTOMER" ? (
                  <Badge variant="outline" className="text-[10px]">
                    {t("googleMedia.customerMedia")}
                  </Badge>
                ) : null}
              </span>
            </button>
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
            {t("googleMedia.prev")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            {t("googleMedia.next")}
          </Button>
        </div>
      ) : null}

      {/* Upload dialog */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          if (!open && !busy) {
            uploads.forEach((u) => URL.revokeObjectURL(u.previewUrl));
            setUploads([]);
            setUploadOpen(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("googleMedia.uploadTitle")}</DialogTitle>
            <DialogDescription>
              {t("googleMedia.uploadDesc", { count: uploads.length })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {uploads.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-border p-2"
              >
                <img
                  src={item.previewUrl}
                  alt=""
                  className="size-16 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  {item.state === "failed" ? (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="size-3" />
                      {item.error ?? t("googleMedia.failed")}
                    </p>
                  ) : item.state === "published" ? (
                    <p className="flex items-center gap-1 text-xs text-emerald-600">
                      <Check className="size-3" />
                      {t("googleMedia.published")}
                    </p>
                  ) : item.state === "uploading" ? (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      {t("googleMedia.uploading")}
                    </p>
                  ) : (
                    <Select
                      value={item.darbCategory}
                      onValueChange={(v) =>
                        setUploadCategory(item.id, v as DarbMediaCategory)
                      }
                    >
                      <SelectTrigger className="h-8 w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DARB_MEDIA_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {t(`googleMedia.${c}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={busy || item.state === "published"}
                  onClick={() => removeUpload(item.id)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <div className="me-auto flex items-center gap-2 text-xs text-muted-foreground">
              {publishedCount > 0 ? (
                <span className="flex items-center gap-1">
                  <Check className="size-3 text-emerald-600" />
                  {t("googleMedia.publishedCount", { count: publishedCount })}
                </span>
              ) : null}
              {uploadingCount > 0 ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" />
                  {t("googleMedia.processing")}
                </span>
              ) : null}
              {failedCount > 0 ? (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertTriangle className="size-3" />
                  {t("googleMedia.failedCount", { count: failedCount })}
                </span>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                uploads.forEach((u) => URL.revokeObjectURL(u.previewUrl));
                setUploads([]);
                setUploadOpen(false);
              }}
            >
              {t("googleMedia.close")}
            </Button>
            <Button
              type="button"
              disabled={busy || !uploads.some((u) => u.state === "ready")}
              onClick={doUpload}
            >
              {busy ? (
                <Loader2 className="me-2 size-4 animate-spin" />
              ) : (
                <ImagePlus className="me-2 size-4" />
              )}
              {t("googleMedia.uploadCount", {
                count: uploads.filter((u) => u.state === "ready").length,
              })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog
        open={Boolean(lightbox)}
        onOpenChange={(open) => !open && setLightbox(null)}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-3xl">
          {lightbox ? (
            <div>
              <div className="relative bg-black/90">
                <img
                  src={
                    lightbox.google_full_url ?? lightbox.google_source_url ?? ""
                  }
                  alt={lightbox.description ?? ""}
                  className="mx-auto max-h-[70vh] w-auto object-contain"
                />
              </div>
              <div className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {t(`googleMedia.${lightbox.darb_category ?? "other"}`)}
                  </Badge>
                  {lightbox.media_origin === "CUSTOMER" ? (
                    <Badge variant="outline">
                      {t("googleMedia.customerMedia")}
                    </Badge>
                  ) : null}
                  {lightbox.media_state !== "PUBLISHED" ? (
                    <Badge variant="outline">
                      {t(`googleMedia.state.${lightbox.media_state}`)}
                    </Badge>
                  ) : null}
                </div>
                {lightbox.attribution ? (
                  <p className="text-sm text-muted-foreground">
                    {lightbox.attribution}
                  </p>
                ) : null}
                {lightbox.width && lightbox.height ? (
                  <p className="text-xs text-muted-foreground">
                    {lightbox.width} × {lightbox.height}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {t("googleMedia.uploadedOn", {
                    date: new Date(lightbox.created_at).toLocaleDateString(),
                  })}
                </p>
                {lightbox.media_origin === "BUSINESS" ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={() => setConfirmDelete(lightbox)}
                  >
                    <Trash2 className="me-2 size-4" />
                    {t("googleMedia.delete")}
                  </Button>
                ) : (
                  <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                    {t("googleMedia.customerReadOnly")}
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              {t("googleMedia.deleteConfirmTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("googleMedia.deleteConfirmDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmDelete(null)}
            >
              {t("googleMedia.cancel")}
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
              {t("googleMedia.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
