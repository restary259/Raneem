import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, GraduationCap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchMajors } from "@/data/intel/majorIntel";
import type { MajorIntel } from "@/data/intel/types";

export interface MajorValue {
  text: string;
  majorId: string | null;
}

export function majorLabel(m: MajorIntel, lang: string) {
  return lang.startsWith("ar") || lang.startsWith("he") ? m.canonicalAR : m.canonicalEN;
}

/**
 * Preferred-major input backed by the real DARB majors list (the same data as
 * /educational-programs and Major Intelligence). Selecting a suggestion stores
 * its id; free text is kept when nothing matches.
 */
export default function MajorAutocomplete({ value, onChange, dir }: { value: MajorValue; onChange: (v: MajorValue) => void; dir: string }) {
  const { t, i18n } = useTranslation("landing");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const results = useMemo(() => (value.text.trim().length >= 2 && !value.majorId ? searchMajors(value.text, 6) : []), [value.text, value.majorId]);
  const show = open && results.length > 0;

  const pick = (m: MajorIntel) => {
    onChange({ text: majorLabel(m, i18n.language), majorId: m.id });
    setOpen(false);
  };

  return (
    <div className="relative">
      <Input
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={show ? `${listId}-${active}` : undefined}
        value={value.text}
        onChange={(e) => { onChange({ text: e.target.value, majorId: null }); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % results.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + results.length) % results.length); }
          else if (e.key === "Enter") { e.preventDefault(); pick(results[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={t("apply.majorPlaceholder")}
        dir={dir}
        className="h-11"
      />
      {show && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
          {results.map((m, i) => (
            <li
              key={m.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(m); }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-start ${i === active ? "bg-muted" : ""}`}
            >
              <GraduationCap className="mt-0.5 size-4 shrink-0 text-brand-strong" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{majorLabel(m, i18n.language)}</span>
                <span className="block truncate text-xs text-muted-foreground" dir="ltr">{[m.canonicalEN, m.nameDE].filter(Boolean).join(" · ")}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {value.majorId ? (
        <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-brand-strong"><Check className="size-3.5" aria-hidden="true" />{t("apply.majorMatched")}</p>
      ) : value.text.trim().length >= 2 && results.length === 0 ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{t("apply.majorNotMatched")}</p>
      ) : null}
    </div>
  );
}
