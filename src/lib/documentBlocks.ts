/**
 * DARB Document Center — block content model.
 *
 * Documents are stored as an ordered array of typed blocks (jsonb) rather than
 * free HTML, so the PDF renderer keeps full control of pagination, RTL
 * alignment and brand styling. Every renderer (screen preview + jsPDF) consumes
 * this exact shape, so what you see in the editor is what prints.
 */

export type DocLanguage = "ar" | "he" | "en" | "de";
export type DocKind = "guide" | "contract" | "form";
export type DocStatus = "draft" | "published" | "archived";

export const DOC_CATEGORIES = [
  "contracts",
  "partners",
  "students",
  "agents",
  "ambassadors",
  "operations",
] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number];

export type CalloutTone = "info" | "warning" | "legal";

export interface CoverBlock {
  id: string;
  type: "cover";
  title: string;
  subtitle?: string;
  note?: string;
}
export interface HeadingBlock {
  id: string;
  type: "heading";
  text: string;
  /** 1 = numbered top-level section, 2 = sub-heading. */
  level: 1 | 2;
}
export interface ParagraphBlock {
  id: string;
  type: "paragraph";
  text: string;
}
export interface ListBlock {
  id: string;
  type: "list";
  ordered?: boolean;
  items: string[];
}
export interface TableBlock {
  id: string;
  type: "table";
  headers: string[];
  rows: string[][];
}
export interface CalloutBlock {
  id: string;
  type: "callout";
  tone: CalloutTone;
  title?: string;
  text: string;
}
export interface FlowBlock {
  id: string;
  type: "flow";
  title?: string;
  steps: string[];
}
export interface SignatureBlock {
  id: string;
  type: "signature";
  parties: string[];
}
export interface DisclaimerBlock {
  id: string;
  type: "disclaimer";
  text: string;
}
export interface PageBreakBlock {
  id: string;
  type: "pagebreak";
}

export type DocBlock =
  | CoverBlock
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | TableBlock
  | CalloutBlock
  | FlowBlock
  | SignatureBlock
  | DisclaimerBlock
  | PageBreakBlock;

export const BLOCK_TYPES: DocBlock["type"][] = [
  "cover",
  "heading",
  "paragraph",
  "list",
  "table",
  "callout",
  "flow",
  "signature",
  "disclaimer",
  "pagebreak",
];

export interface DocumentRecord {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: string;
  doc_kind: DocKind;
  language: DocLanguage;
  status: DocStatus;
  current_version: string;
  effective_date: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersionRecord {
  id: string;
  document_id: string;
  version: string;
  content: DocBlock[];
  change_note: string | null;
  pdf_path: string | null;
  published_at: string | null;
  created_at: string;
}

let seq = 0;
export const newBlockId = (): string =>
  `b_${Date.now().toString(36)}_${(seq++).toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export function emptyBlock(type: DocBlock["type"]): DocBlock {
  const id = newBlockId();
  switch (type) {
    case "cover":
      return { id, type, title: "", subtitle: "", note: "" };
    case "heading":
      return { id, type, text: "", level: 1 };
    case "paragraph":
      return { id, type, text: "" };
    case "list":
      return { id, type, ordered: false, items: [""] };
    case "table":
      return { id, type, headers: ["", ""], rows: [["", ""]] };
    case "callout":
      return { id, type, tone: "info", title: "", text: "" };
    case "flow":
      return { id, type, title: "", steps: ["", ""] };
    case "signature":
      return { id, type, parties: ["", ""] };
    case "disclaimer":
      return { id, type, text: "" };
    case "pagebreak":
      return { id, type };
  }
}

/* ------------------------------------------------------------------ */
/* Variables                                                           */
/* ------------------------------------------------------------------ */

export const VARIABLE_KEYS = [
  "recipient_name",
  "agent_name",
  "student_name",
  "partner_name",
  "date",
  "version",
  "effective_date",
  "agent_recruitment_amount",
  "agent_self_referral_amount",
  "partner_amount",
  "ambassador_amount",
  "lock_days",
] as const;
export type VariableKey = (typeof VARIABLE_KEYS)[number];

export type VariableMap = Partial<Record<string, string>>;

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Every `{{token}}` present in the document, deduplicated. */
export function collectVariables(blocks: DocBlock[]): string[] {
  const found = new Set<string>();
  for (const text of blockTexts(blocks)) {
    for (const m of text.matchAll(TOKEN_RE)) found.add(m[1]);
  }
  return [...found];
}

/** Tokens that have no value yet — these block PDF generation. */
export function unresolvedVariables(blocks: DocBlock[], vars: VariableMap): string[] {
  return collectVariables(blocks).filter((k) => {
    const v = vars[k];
    return v === undefined || v === null || String(v).trim() === "";
  });
}

/** Replaces every known token; unknown tokens are left intact so they stay visible. */
export function resolveText(text: string, vars: VariableMap): string {
  return text.replace(TOKEN_RE, (full, key: string) => {
    const value = vars[key];
    return value === undefined || value === null || String(value).trim() === "" ? full : String(value);
  });
}

export function isUnresolvedToken(fragment: string): boolean {
  return /^\{\{\s*[a-zA-Z0-9_]+\s*\}\}$/.test(fragment);
}

/** Splits a string into plain fragments and `{{token}}` fragments for highlighting. */
export function splitTokens(text: string): string[] {
  return text.split(/(\{\{\s*[a-zA-Z0-9_]+\s*\}\})/g).filter((p) => p !== "");
}

export function resolveBlocks(blocks: DocBlock[], vars: VariableMap): DocBlock[] {
  const r = (s: string) => resolveText(s, vars);
  return blocks.map((b) => {
    switch (b.type) {
      case "cover":
        return { ...b, title: r(b.title), subtitle: b.subtitle ? r(b.subtitle) : b.subtitle, note: b.note ? r(b.note) : b.note };
      case "heading":
        return { ...b, text: r(b.text) };
      case "paragraph":
      case "disclaimer":
        return { ...b, text: r(b.text) };
      case "list":
        return { ...b, items: b.items.map(r) };
      case "table":
        return { ...b, headers: b.headers.map(r), rows: b.rows.map((row) => row.map(r)) };
      case "callout":
        return { ...b, title: b.title ? r(b.title) : b.title, text: r(b.text) };
      case "flow":
        return { ...b, title: b.title ? r(b.title) : b.title, steps: b.steps.map(r) };
      case "signature":
        return { ...b, parties: b.parties.map(r) };
      default:
        return b;
    }
  });
}

function blockTexts(blocks: DocBlock[]): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "cover":
        out.push(b.title, b.subtitle ?? "", b.note ?? "");
        break;
      case "heading":
      case "paragraph":
      case "disclaimer":
        out.push(b.text);
        break;
      case "list":
        out.push(...b.items);
        break;
      case "table":
        out.push(...b.headers, ...b.rows.flat());
        break;
      case "callout":
        out.push(b.title ?? "", b.text);
        break;
      case "flow":
        out.push(b.title ?? "", ...b.steps);
        break;
      case "signature":
        out.push(...b.parties);
        break;
      default:
        break;
    }
  }
  return out.filter(Boolean);
}

/** RTL is a property of the document language, never guessed per string. */
export const isRtlLanguage = (lang: DocLanguage): boolean => lang === "ar" || lang === "he";

/** Money is always rendered with Western digits, per project convention. */
export const formatIls = (amount: number): string =>
  `₪${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)}`;

/** Next version string: 1.0 → 1.1, 1.9 → 1.10. */
export function nextVersion(current: string): string {
  const parts = String(current || "1.0").split(".");
  const major = parseInt(parts[0], 10) || 1;
  const minor = parseInt(parts[1], 10) || 0;
  return `${major}.${minor + 1}`;
}
