import { useState } from "react";
import { ImageOff, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import ImageWithSkeleton from "@/components/ui/image-with-skeleton";

interface CatalogImageProps {
  src: string | null | undefined;
  alt: string;
  /** Tailwind aspect ratio class, e.g. "aspect-[4/3]". */
  aspect?: string;
  className?: string;
  /** Placeholder icon shown when there is no photo or it fails to load. */
  icon?: LucideIcon;
  fit?: "cover" | "contain";
}

/**
 * The single image primitive for the catalog. Fixed aspect ratio (no layout
 * shift), lazy-loaded, and a graceful token-styled placeholder when the photo
 * is missing or fails to load.
 */
export function CatalogImage({
  src,
  alt,
  aspect = "aspect-[4/3]",
  className,
  icon: Icon = ImageOff,
  fit = "cover",
}: CatalogImageProps) {
  const [failed, setFailed] = useState(false);
  const usable = src && src.trim() && !failed;

  return (
    <div className={cn("relative w-full overflow-hidden bg-muted", aspect, className)}>
      {usable ? (
        <ImageWithSkeleton
          src={src as string}
          alt={alt}
          onError={() => setFailed(true)}
          className={cn(
            "h-full w-full transition-transform duration-500",
            fit === "cover" ? "object-cover" : "object-contain",
          )}
          skeletonClassName="h-full w-full rounded-none"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground/40">
          <Icon className="h-10 w-10" />
        </div>
      )}
    </div>
  );
}

export default CatalogImage;
