import { Fragment, useMemo } from "react";
import {
  type DocBlock,
  type DocLanguage,
  type VariableMap,
  resolveText,
  splitTokens,
  isUnresolvedToken,
  isRtlLanguage,
} from "@/lib/documentBlocks";

interface DocumentPreviewProps {
  blocks: DocBlock[];
  variables?: VariableMap;
  language?: DocLanguage;
  /** Sheet id used by the print stylesheet to target this sheet only. */
  sheetId?: string;
}

const PAGE_W = 794; // A4 width in px at 96dpi.

/** Highlights `{{unresolved}}` tokens in amber inside a resolved string. */
function ResolvedText({ text, variables }: { text: string; variables: VariableMap }) {
  const fragments = useMemo(() => splitTokens(text), [text]);
  return (
    <>
      {fragments.map((frag, i) => {
        if (isUnresolvedFrag(frag, variables)) {
          return (
            <span key={i} className="rounded bg-amber-500/15 px-0.5 text-amber-700">
              {frag}
            </span>
          );
        }
        return <Fragment key={i}>{resolveText(frag, variables)}</Fragment>;
      })}
    </>
  );
}

/** True if `frag` is a `{{token}}` AND the token has no resolved value. */
function isUnresolvedFrag(frag: string, variables: VariableMap): boolean {
  if (!isUnresolvedToken(frag)) return false;
  const key = frag.replace(/^\{\{\s*|\s*\}\}$/g, "");
  const v = variables[key];
  return v === undefined || v === null || String(v).trim() === "";
}

const CALLOUT_STYLE: Record<string, { wrap: string; title: string }> = {
  info: { wrap: "border-blue-300 bg-blue-50 text-blue-900", title: "text-blue-700" },
  warning: { wrap: "border-amber-300 bg-amber-50 text-amber-900", title: "text-amber-700" },
  legal: { wrap: "border-orange-400 bg-orange-50 text-orange-900", title: "text-orange-700" },
};

/** A4 sheet renderer for a DocBlock[] array. Used by the editor preview modal + print. */
export default function DocumentPreview({
  blocks,
  variables = {},
  language = "ar",
  sheetId,
}: DocumentPreviewProps) {
  const rtl = isRtlLanguage(language);
  // L1 headings are auto-numbered across the document.
  let l1 = 0;

  return (
    <div
      id={sheetId}
      dir={rtl ? "rtl" : "ltr"}
      className="mx-auto bg-white text-slate-900 shadow-lg"
      style={{ width: PAGE_W, maxWidth: "100%", padding: "60px 72px", minHeight: 1123 }}
    >
      {blocks.map((b) => {
        switch (b.type) {
          case "cover":
            return (
              <div key={b.id} className="flex min-h-[860px] flex-col items-center justify-center text-center">
                <img
                  src="/lovable-uploads/darb-chat-logo.png"
                  alt="DARB"
                  className="mb-8 h-16 w-16 object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                <div className="mb-4 h-1 w-24 rounded bg-[hsl(var(--brand))]" />
                <h1 className="text-3xl font-bold">{b.title || "Untitled"}</h1>
                {b.subtitle && <p className="mt-2 text-base text-slate-600">{b.subtitle}</p>}
                {b.note && <p className="mt-6 text-xs text-slate-500">{b.note}</p>}
              </div>
            );
          case "heading": {
            if (b.level === 1) l1 += 1;
            const num = b.level === 1 ? `${l1}.` : "";
            return (
              <h2
                key={b.id}
                className={`mt-6 font-bold ${b.level === 1 ? "border-b pb-1 text-xl" : "ms-4 text-lg"}`}
                style={b.level === 1 ? { borderColor: "hsl(var(--brand))" } : undefined}
              >
                {num && <span className="me-2 text-[hsl(var(--brand))]">{num}</span>}
                <ResolvedText text={b.text} variables={variables} />
              </h2>
            );
          }
          case "paragraph":
            return (
              <p key={b.id} className="mt-3 text-sm leading-relaxed">
                <ResolvedText text={b.text} variables={variables} />
              </p>
            );
          case "list":
            return b.ordered ? (
              <ol key={b.id} className="mt-3 list-decimal space-y-1 ps-6 text-sm">
                {b.items.filter(Boolean).map((it, k) => (
                  <li key={k}><ResolvedText text={it} variables={variables} /></li>
                ))}
              </ol>
            ) : (
              <ul key={b.id} className="mt-3 list-disc space-y-1 ps-6 text-sm">
                {b.items.filter(Boolean).map((it, k) => (
                  <li key={k}><ResolvedText text={it} variables={variables} /></li>
                ))}
              </ul>
            );
          case "table":
            return (
              <div key={b.id} className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr style={{ background: "hsl(var(--brand))" }} className="text-white">
                      {b.headers.map((h, k) => (
                        <th key={k} className="border border-slate-300 px-2 py-1 text-start font-semibold">
                          <ResolvedText text={h} variables={variables} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 1 ? "bg-slate-50" : ""}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="border border-slate-300 px-2 py-1">
                            <ResolvedText text={cell} variables={variables} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "callout": {
            const style = CALLOUT_STYLE[b.tone] ?? CALLOUT_STYLE.info;
            return (
              <div key={b.id} className={`mt-3 rounded border-s-4 p-3 ${style.wrap}`}>
                {b.title && (
                  <p className={`mb-1 font-semibold ${style.title}`}>
                    {b.tone === "legal" ? "⚖ " : ""}{b.title}
                  </p>
                )}
                <p className="text-sm"><ResolvedText text={b.text} variables={variables} /></p>
                {b.tone === "legal" && !b.title && (
                  <p className={`text-xs font-semibold ${style.title}`}>
                    ⚖ {language === "ar" ? "بحاجة إلى مراجعة قانونية" : "LEGAL REVIEW REQUIRED"}
                  </p>
                )}
              </div>
            );
          }
          case "flow": {
            return (
              <div key={b.id} className="mt-3">
                {b.title && <p className="mb-2 font-semibold text-sm"><ResolvedText text={b.title} variables={variables} /></p>}
                <ol className="space-y-2">
                  {b.steps.filter(Boolean).map((step, k) => (
                    <li key={k} className="flex items-center gap-3">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: "hsl(var(--brand))" }}
                      >
                        {k + 1}
                      </span>
                      <span className="flex-1 rounded border bg-slate-50 px-3 py-1.5 text-sm">
                        <ResolvedText text={step} variables={variables} />
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          }
          case "signature":
            return (
              <div key={b.id} className="mt-6 grid grid-cols-2 gap-6">
                {b.parties.map((p, k) => (
                  <div key={k} className="space-y-1 text-sm">
                    <p className="font-medium"><ResolvedText text={p} variables={variables} /></p>
                    <div className="mt-8 border-b border-slate-400" />
                    <p className="text-xs text-slate-500">{language === "ar" ? "التوقيع" : "Signature"}</p>
                    <div className="mt-4 flex justify-between text-xs text-slate-500">
                      <span>{language === "ar" ? "التاريخ" : "Date"}</span>
                      <span className="border-b border-dotted border-slate-300 px-8">&nbsp;</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          case "disclaimer":
            return (
              <p key={b.id} className="mt-4 border-y py-2 text-xs italic text-slate-500">
                <ResolvedText text={b.text} variables={variables} />
              </p>
            );
          case "pagebreak":
            return <div key={b.id} className="my-6 border-t border-dashed border-slate-300" />;
          default:
            return null;
        }
      })}
    </div>
  );
}
