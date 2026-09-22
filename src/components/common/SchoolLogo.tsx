import { useMemo, useState } from "react";
import { ALPHA_AKTIV_LOGO_SRC } from "@/assets/alphaAktivLogo";
import { cn } from "@/lib/utils";

const SCHOOL_LOGOS: Array<{ matches: string[]; src: string }> = [
  { matches: ["alpha aktiv", "alpha-aktiv"], src: ALPHA_AKTIV_LOGO_SRC },
  { matches: ["goacademy", "go academy", "go-academy"], src: "/lovable-uploads/schools/go-academy/school/logo.png" },
  { matches: ["kapito"], src: "/lovable-uploads/schools/kapito/kapito-logo.svg" },
  { matches: ["perfekt deutsch", "perfekt-deutsch"], src: "/lovable-uploads/schools/perfekt-deutsch/perfekt-deutsch-logo.svg" },
];

type SchoolLogoProps = {
  name: string;
  slug?: string | null;
  className?: string;
  imageClassName?: string;
};

function initials(name: string) {
  return name
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? "")
    .join("") || "D";
}

export default function SchoolLogo({ name, slug, className, imageClassName }: SchoolLogoProps) {
  const [failed, setFailed] = useState(false);
  const source = useMemo(() => {
    const identity = `${name} ${slug ?? ""}`.toLocaleLowerCase();
    return SCHOOL_LOGOS.find((entry) => entry.matches.some((match) => identity.includes(match)))?.src;
  }, [name, slug]);

  return (
    <span
      className={cn(
        "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background p-2 shadow-sm",
        className,
      )}
      aria-hidden="true"
    >
      {source && !failed ? (
        <img
          src={source}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn("max-h-full max-w-full object-contain", imageClassName)}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-center text-sm font-extrabold leading-none text-primary">{initials(name)}</span>
      )}
    </span>
  );
}