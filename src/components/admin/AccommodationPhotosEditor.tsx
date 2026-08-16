import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Trash2, Upload, ArrowUp, ArrowDown } from "lucide-react";
import { validateUploadFile } from "@/lib/uploadRules";

const db: any = supabase as unknown as any;

interface PhotoRow {
  id: string;
  storage_path: string;
  display_order: number;
  url?: string;
}

interface Props {
  accommodationId: string;
}

/**
 * Admin-only photo management for an accommodation. Renders inside the
 * AdminProgramsPage accommodation edit dialog (only when editing an existing
 * accommodation). Upload, reorder (up/down), delete. RLS enforces admin-only
 * writes; this component offers no UI to non-admins (it lives in AdminProgramsPage).
 */
const AccommodationPhotosEditor: React.FC<Props> = ({ accommodationId }) => {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await db
        .from("accommodation_photos")
        .select("id, storage_path, display_order")
        .eq("accommodation_id", accommodationId)
        .order("display_order");
      if (error) throw error;
      const rows: PhotoRow[] = data ?? [];
      const withUrls = await Promise.all(
        rows.map(async (p) => {
          const { data: signed, error: urlErr } = await supabase.storage
            .from("accommodation-photos")
            .createSignedUrl(p.storage_path, 3600);
          return { ...p, url: urlErr ? undefined : signed?.signedUrl };
        }),
      );
      setPhotos(withUrls);
    } catch {
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [accommodationId]);

  useEffect(() => {
    if (open && accommodationId) fetchPhotos();
  }, [open, accommodationId, fetchPhotos]);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) {
        toast({
          variant: "destructive",
          description: t("admin.programs.photosUploadFailed"),
        });
        continue;
      }
      if (validateUploadFile(file)) {
        toast({
          variant: "destructive",
          description: t("admin.programs.photosUploadFailed"),
        });
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length === 0) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setBusy(true);
    const uploadedPaths: string[] = [];
    try {
      const nextOrder =
        photos.length > 0
          ? Math.max(...photos.map((p) => p.display_order)) + 1
          : 0;
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const path = `${accommodationId}/${crypto.randomUUID()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("accommodation-photos")
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        uploadedPaths.push(path);
        const { error: dbErr } = await db.from("accommodation_photos").insert({
          accommodation_id: accommodationId,
          storage_path: path,
          display_order: nextOrder + i,
        });
        if (dbErr) throw dbErr;
      }
      toast({ description: t("admin.programs.photosUploaded") });
      await fetchPhotos();
    } catch (err: any) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("accommodation-photos").remove(uploadedPaths);
      }
      toast({
        variant: "destructive",
        description: err?.message || t("admin.programs.photosUploadFailed"),
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= photos.length) return;
    const a = photos[idx];
    const b = photos[target];
    setBusy(true);
    try {
      const { error } = await db.rpc("swap_accommodation_photo_order", {
        p_photo_id_a: a.id,
        p_photo_id_b: b.id,
      });
      if (error) throw error;
      toast({ description: t("admin.programs.photosReordered") });
      await fetchPhotos();
    } catch (err: any) {
      toast({
        variant: "destructive",
        description: err?.message || t("admin.programs.photosUploadFailed"),
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (photo: PhotoRow) => {
    setBusy(true);
    try {
      const { error } = await db.from("accommodation_photos").delete().eq("id", photo.id);
      if (error) throw error;
      // Best-effort storage cleanup; if it fails the DB row is already gone
      // so the UI stays correct (harmless orphan, not a broken image).
      await supabase.storage.from("accommodation-photos").remove([photo.storage_path]);
      toast({ description: t("admin.programs.photosDeleted") });
      await fetchPhotos();
    } catch (err: any) {
      toast({
        variant: "destructive",
        description: err?.message || t("admin.programs.photosDeleteFailed"),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold hover:bg-muted/30"
        >
          <span>{t("admin.programs.photosSection")}</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 px-3 pb-3 pt-1">
        <p className="text-xs text-muted-foreground">
          {t("admin.programs.photosHint")}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {t("admin.programs.photosUpload")}
        </Button>

        {loading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">
            {t("admin.programs.photosEmpty")}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p, idx) => (
              <div
                key={p.id}
                className="group relative aspect-square overflow-hidden rounded-md border bg-muted/30"
              >
                {p.url ? (
                  <img
                    src={p.url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Skeleton className="h-full w-full" />
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/50 px-1 py-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-white hover:bg-white/20"
                      disabled={busy || idx === 0}
                      onClick={() => move(idx, -1)}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-white hover:bg-white/20"
                      disabled={busy || idx === photos.length - 1}
                      onClick={() => move(idx, 1)}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-white hover:bg-destructive/40"
                    disabled={busy}
                    onClick={() => remove(p)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default AccommodationPhotosEditor;
