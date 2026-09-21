import { useState } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

type CityImageProps = {
  src: string;
  alt: string;
  city: string;
  className?: string;
  imageClassName?: string;
  eager?: boolean;
};

const CityImage = ({ src, alt, city, className, imageClassName, eager = false }: CityImageProps) => {
  const [failed, setFailed] = useState(false);

  return (
    <div className={cn("relative overflow-hidden bg-primary", className)}>
      {!failed ? (
        <img
          src={src}
          alt={alt}
          width={1536}
          height={1024}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          decoding="async"
          className={cn("size-full object-cover", imageClassName)}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="grid size-full place-items-center bg-primary p-6 text-center text-primary-foreground">
          <div>
            <MapPin className="mx-auto size-7 text-brand" aria-hidden="true" />
            <p className="mt-3 text-xl font-bold">{city}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CityImage;