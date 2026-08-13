import React from "react";
import { CVData } from "./types";
import { getCVLabels } from "./cvLabels";

/** Filter out empty/blank strings so empty bullets never render. */
export const clean = (arr: string[] | undefined): string[] =>
  (arr || []).map((s) => (s || "").trim()).filter(Boolean);

export const isPresent = (s: string | undefined): boolean => !!(s && s.trim());

const uid = () => Math.random().toString(36).slice(2, 9);

export const newId = uid;

/** Format a YYYY-MM (month input) value for display, keeping it compact. */
export function fmtDate(v: string, lang: string): string {
  if (!v) return "";
  // YYYY-MM → "MM/YYYY" (en), "MM.YYYY" (de); ar keeps western digits.
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  if (m) {
    return lang === "de" ? `${m[2]}.${m[1]}` : `${m[2]}/${m[1]}`;
  }
  return v;
}

export function dateRange(from: string, to: string, current: boolean, L: ReturnType<typeof getCVLabels>): string {
  const f = fmtDate(from, "");
  const t = current ? L.present : fmtDate(to, "");
  if (!f && !t) return "";
  if (current && !f) return t;
  return `${f} — ${t}`;
}

/** Render a bullet list (only non-empty entries). */
export function Bullets({ items, className = "" }: { items: string[]; className?: string }) {
  const list = clean(items);
  if (list.length === 0) return null;
  return (
    <ul className={`list-disc list-outside ps-4 mt-1 ${className}`} style={{ marginInlineStart: "1.1em" }}>
      {list.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  );
}

export interface SectionHeadingProps {
  children: React.ReactNode;
  variant?: "standard" | "accent-text" | "sidebar";
}

/** A consistent section heading that uses the accent + heading font tokens. */
export function SectionHeading({ children, variant = "standard" }: SectionHeadingProps) {
  if (variant === "sidebar") {
    return (
      <h2
        className="uppercase tracking-widest text-[10pt] font-bold pb-1 mb-1.5"
        style={{ color: "var(--cv-accent)", borderBottom: "1px solid var(--cv-rule)" }}
      >
        {children}
      </h2>
    );
  }
  return (
    <h2
      className="uppercase tracking-widest text-[10.5pt] font-bold pb-1 mb-2"
      style={{
        color: variant === "accent-text" ? "var(--cv-accent)" : "var(--cv-body-color)",
        borderBottom: "1.5px solid var(--cv-accent)",
        fontFamily: "var(--cv-heading-font)",
      }}
    >
      {children}
    </h2>
  );
}

/** The optional Ort / Datum / Unterschrift block. Never auto-inserts a name. */
export function SignatureBlock({ data, L }: { data: CVData; L: ReturnType<typeof getCVLabels> }) {
  const { signature } = data;
  if (!signature || signature.mode === "none") return null;
  const place = signature.place?.trim();
  const date = signature.date ? fmtDate(signature.date, data.contentLanguage) : "";
  const head = [place, date].filter(Boolean).join(", ") || "";
  return (
    <div
      className="cv-entry break-inside-avoid"
      style={{ marginTop: "var(--cv-spacing-section)" }}
    >
      {head && (
        <p className="text-xs" style={{ color: "var(--cv-muted)" }}>
          {head}
        </p>
      )}
      <div className="flex items-end gap-3" style={{ marginTop: "24px" }}>
        {signature.mode === "image" && signature.image ? (
          <img
            src={signature.image}
            alt={L.signature}
            className="object-contain"
            style={{ maxHeight: "44px", maxWidth: "180px" }}
          />
        ) : (
          <div
            style={{ borderTop: "1px solid var(--cv-body-color)", width: "200px", height: "1px" }}
          />
        )}
      </div>
      <p className="text-[10pt] mt-1" style={{ color: "var(--cv-muted)" }}>
        {L.signature}
      </p>
    </div>
  );
}
