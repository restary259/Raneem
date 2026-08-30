import { useEffect } from "react";

/**
 * The CV font families (Inter, Source Sans 3, IBM Plex Sans, Source Serif 4,
 * Merriweather, IBM Plex Mono) are used ONLY by the Lebenslauf builder/preview.
 * They used to sit in the global <head> stylesheet, so every visitor paid for
 * them on first paint. This injects them once, on demand, when the builder
 * mounts — the font stacks in `cvDesign.ts` are unchanged.
 */
const CV_FONTS_ID = "darb-cv-fonts";
const CV_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Source+Sans+3:wght@400;500;700&family=IBM+Plex+Sans:wght@400;500;700&family=Source+Serif+4:wght@400;500;700&family=Merriweather:wght@400;700&family=IBM+Plex+Mono:wght@400;500;700&display=swap";

export function useCvFonts(): void {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(CV_FONTS_ID)) return;
    const link = document.createElement("link");
    link.id = CV_FONTS_ID;
    link.rel = "stylesheet";
    link.href = CV_FONTS_HREF;
    document.head.appendChild(link);
    // Left in place intentionally: re-entering the builder should not refetch.
  }, []);
}
