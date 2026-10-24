import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const SEEN_KEY = "darb.journey.celebration.seen";

/**
 * Shown once per session when the visitor actually reaches the end of the
 * journey overview. It deliberately reinforces the destination the visitor is
 * working toward without claiming any admission, visa, or acceptance outcome.
 */
const JourneyCelebration = () => {
  const { t } = useTranslation("landing");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // Private-mode browsers can throw on storage access; fall back to showing
      // the dialog at most once per page load instead of on every scroll.
    }
    if (seen) return;

    let armed = false;
    const arm = () => {
      armed = true;
    };
    // Require a real downward scroll first so the dialog never interrupts a
    // visitor who landed on a short viewport without moving.
    window.addEventListener("scroll", arm, { once: true, passive: true });
    window.addEventListener("wheel", arm, { once: true, passive: true });
    window.addEventListener("touchmove", arm, { once: true, passive: true });

    const onScroll = () => {
      if (!armed || open) return;
      const atEnd =
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 120;
      if (!atEnd) return;
      try {
        window.sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        // Non-fatal: the dialog simply stays eligible for this page load.
      }
      setOpen(true);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", arm);
      window.removeEventListener("wheel", arm);
      window.removeEventListener("touchmove", arm);
      window.removeEventListener("scroll", onScroll);
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="darb-celebration max-w-md overflow-hidden text-center">
        <div aria-hidden="true" className="darb-celebration-burst">
          {Array.from({ length: 8 }, (_, i) => (
            <span
              key={i}
              className={`darb-celebration-spark darb-celebration-spark-${i + 1}`}
            />
          ))}
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">
          {t("homepage.celebration.eyebrow")}
        </p>
        <DialogTitle className="mt-2 text-2xl font-bold leading-tight text-primary">
          {t("homepage.celebration.title")}
        </DialogTitle>
        <DialogDescription className="mt-3 text-sm leading-7 text-muted-foreground">
          {t("homepage.celebration.body")}
        </DialogDescription>
        <p className="mt-4 rounded-xl bg-muted px-4 py-3 text-xs leading-5 text-muted-foreground">
          {t("homepage.celebration.reassurance")}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            asChild
            variant="cta"
            className="bg-brand! text-brand-foreground! hover:bg-brand/90!"
          >
            <Link to="/apply">{t("homepage.celebration.cta")}</Link>
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("homepage.celebration.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JourneyCelebration;
