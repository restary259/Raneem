import { useEffect, useRef } from "react";
import { ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ExamFlipCardProps = {
  name: string;
  description: string;
  caveat: string;
  officialLabel: string;
  flipLabel: string;
  backLabel: string;
  href: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export default function ExamFlipCard({
  name,
  description,
  caveat,
  officialLabel,
  flipLabel,
  backLabel,
  href,
  open,
  onOpen,
  onClose,
}: ExamFlipCardProps) {
  const frontRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) backRef.current?.focus();
  }, [open]);

  const close = () => {
    onClose();
    window.requestAnimationFrame(() => frontRef.current?.focus());
  };

  return (
    <article className={cn("exam-flip-card min-h-72", open && "is-flipped")}>
      <div className="exam-flip-card-inner">
        <button
          ref={frontRef}
          type="button"
          className="exam-flip-face exam-flip-front"
          aria-expanded={open}
          aria-label={`${name}: ${flipLabel}`}
            tabIndex={open ? -1 : 0}
          onClick={onOpen}
        >
          <span className="exam-wordmark" aria-hidden="true">{name}</span>
          <span className="text-base font-bold text-primary">{name}</span>
          <span className="text-xs font-semibold text-muted-foreground">{flipLabel}</span>
        </button>

        <div className="exam-flip-face exam-flip-back" aria-hidden={!open} onKeyDown={(event) => event.key === "Escape" && close()}>
          <div>
            <p className="text-lg font-bold text-primary">{name}</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
            <p className="mt-3 border-s-2 border-brand ps-3 text-xs leading-5 text-muted-foreground">{caveat}</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild size="sm">
                <a href={href} target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1}>{officialLabel}<ExternalLink /></a>
            </Button>
              <Button ref={backRef} type="button" size="icon-sm" variant="outline" tabIndex={open ? 0 : -1} onClick={close} aria-label={backLabel} title={backLabel}>
              <RotateCcw />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}