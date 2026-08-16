import React, { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "school-assets";
export const SCHOOL_ASSETS_PUBLIC_URL_PREFIX = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${BUCKET}`;

interface PhotoUploaderProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  folder: string;
  label?: string;
  max?: number;
}

export function photoSrc(url: string): string {
  return url;
}

export function isStorageUrl(url: string): boolean {
  return url.includes("/storage/v1/object/public/");
}

export default function PhotoUploader({
  photos,
  onChange,
  folder,
  label,
  max = 8,
}: PhotoUploaderProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (photos.length >= max) {
      toast({ variant: "destructive", description: `Maximum ${max} photos allowed` });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", description: "Only image files are allowed" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", description: "Image must be smaller than 5MB" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const safeExt = /^[a-zA-Z0-9]+$/.test(ext) ? ext : "jpg";
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange([...photos, data.publicUrl]);
      toast({ description: "Photo uploaded" });
    } catch (err: any) {
      toast({ variant: "destructive", description: err?.message || "Upload failed" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removePhoto = (url: string) => {
    onChange(photos.filter((p) => p !== url));
  };

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs">{label}</Label>}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p} className="relative h-20 w-20 overflow-hidden rounded-md border">
              <img src={p} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(p)}
                aria-label="Remove photo"
                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading || photos.length >= max}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Add photo"}
        </Button>
        {photos.length >= max && (
          <span className="text-xs text-muted-foreground">Max {max} photos</span>
        )}
      </div>
    </div>
  );
}