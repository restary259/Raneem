/** Shared, pure helpers for the internal chat surfaces. */

export interface ChatAttachment {
  name: string;
  path: string;
  mime: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  authorId: string | null;
  authorName: string | null;
  authorRole: string | null;
  body: string;
  createdAt: string;
  visibility?: "internal" | "shared";
  attachments: ChatAttachment[];
  kind: "text" | "request";
  requestStatus?: string | null;
  editedAt?: string | null;
  mentions?: string[];
}

/** Someone who can be @mentioned in a thread. */
export interface MentionablePerson {
  id: string;
  name: string;
  role?: string | null;
}

export const EDIT_WINDOW_MS = 15 * 60 * 1000;

/** Mirrors the server rule: own, plain, attachment-free message within 15 minutes. */
export function canEditMessage(
  message: ChatMessage,
  currentUserId: string | null,
  now: Date = new Date(),
): boolean {
  if (!currentUserId || message.authorId !== currentUserId) return false;
  if (message.kind !== "text") return false;
  if (message.attachments.length > 0) return false;
  return now.getTime() - new Date(message.createdAt).getTime() <= EDIT_WINDOW_MS;
}

/**
 * Active `@query` the caret sits in, or null.
 * Only triggers at the start of a word so emails never open the picker.
 */
export function activeMentionQuery(text: string, caret: number): string | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (/\s/.test(query)) return null;
  return query;
}

/** Replace the active `@query` with the chosen name. Returns new text + caret. */
export function applyMention(
  text: string,
  caret: number,
  name: string,
): { text: string; caret: number } {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at === -1) return { text, caret };
  const inserted = `@${name} `;
  const next = text.slice(0, at) + inserted + text.slice(caret);
  return { text: next, caret: at + inserted.length };
}

/** Ids of people whose `@Name` appears in the body. */
export function resolveMentionIds(body: string, people: MentionablePerson[]): string[] {
  const ids = new Set<string>();
  for (const person of people) {
    if (!person.name) continue;
    if (body.includes(`@${person.name}`)) ids.add(person.id);
  }
  return [...ids];
}

/** A case file that can be referenced in a message with `#`. */
export interface MentionableCase {
  id: string;
  reference: string | null;
  name: string;
  status?: string | null;
}

/** The token written into the body for a case, e.g. `#DRB-2026-0012`. */
export function caseMentionToken(c: MentionableCase): string {
  return `#${c.reference ?? c.id.slice(0, 8)}`;
}

/**
 * Active `#query` the caret sits in, or null.
 * Only triggers at the start of a word, so `a#b` and URLs never open the picker.
 */
export function activeCaseQuery(text: string, caret: number): string | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("#");
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (/\s/.test(query)) return null;
  return query;
}

/** Replace the active `#query` with the case token. Returns new text + caret. */
export function applyCaseMention(
  text: string,
  caret: number,
  token: string,
): { text: string; caret: number } {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("#");
  if (at === -1) return { text, caret };
  const inserted = `${token} `;
  const next = text.slice(0, at) + inserted + text.slice(caret);
  return { text: next, caret: at + inserted.length };
}

const CASE_TOKEN = /(^|\s)#([A-Za-z0-9][A-Za-z0-9_-]{2,})/g;

/** Distinct case references written as `#REF` in a body. */
export function extractCaseRefs(body: string): string[] {
  const refs = new Set<string>();
  for (const m of body.matchAll(CASE_TOKEN)) refs.add(m[2]);
  return [...refs];
}

export type BodySegment = { text: string; mention: boolean; caseRef?: string };


/** Split a body into plain and `@mention` segments for highlighting. */
export function splitMentions(body: string, people: MentionablePerson[]): BodySegment[] {
  const names = people
    .map((p) => p.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (names.length === 0) return [{ text: body, mention: false }];

  const segments: BodySegment[] = [];
  let index = 0;
  while (index < body.length) {
    const at = body.indexOf("@", index);
    if (at === -1) break;
    const match = names.find((name) => body.startsWith(`@${name}`, at));
    if (!match) {
      index = at + 1;
      continue;
    }
    if (at > index) segments.push({ text: body.slice(index, at), mention: false });
    segments.push({ text: `@${match}`, mention: true });
    index = at + match.length + 1;
  }
  if (index < body.length) segments.push({ text: body.slice(index), mention: false });
  return segments.length > 0 ? segments : [{ text: body, mention: false }];
}

/** Split a plain run into text and `#case` segments. */
function splitCaseRefs(text: string): BodySegment[] {
  const out: BodySegment[] = [];
  let index = 0;
  for (const m of text.matchAll(CASE_TOKEN)) {
    const lead = m[1] ?? "";
    const start = (m.index ?? 0) + lead.length;
    if (start > index) out.push({ text: text.slice(index, start), mention: false });
    out.push({ text: `#${m[2]}`, mention: false, caseRef: m[2] });
    index = start + m[2].length + 1;
  }
  if (index < text.length) out.push({ text: text.slice(index), mention: false });
  return out;
}

/**
 * Split a body into plain, `@mention` and `#case` segments.
 * Case segments carry `caseRef` so the UI can render them as links.
 */
export function splitChatBody(body: string, people: MentionablePerson[]): BodySegment[] {
  return splitMentions(body, people).flatMap((seg) =>
    seg.mention ? [seg] : splitCaseRefs(seg.text),
  );
}



export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
] as const;

export type AttachmentError = "size" | "mime" | null;

/** Client-side pre-check; the database validates again on send. */
export function validateAttachmentFile(file: { size: number; type: string }): AttachmentError {
  if (file.size > MAX_ATTACHMENT_BYTES) return "size";
  if (!ALLOWED_ATTACHMENT_MIMES.includes(file.type as (typeof ALLOWED_ATTACHMENT_MIMES)[number])) {
    return "mime";
  }
  return null;
}

export function isImageAttachment(att: ChatAttachment): boolean {
  return att.mime.startsWith("image/");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** en-US day key so Arabic UI still renders ASCII digits. */
export function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export type DayLabel = { type: "today" } | { type: "yesterday" } | { type: "date"; value: string };

export function dayLabel(iso: string, now: Date = new Date()): DayLabel {
  const key = dayKey(iso);
  const today = dayKey(now.toISOString());
  const yesterday = dayKey(new Date(now.getTime() - 86400000).toISOString());
  if (key === today) return { type: "today" };
  if (key === yesterday) return { type: "yesterday" };
  return { type: "date", value: new Date(iso).toLocaleDateString("en-US") };
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export interface ChatGroup {
  /** ISO day key of the group */
  day: string;
  authorId: string | null;
  authorName: string | null;
  authorRole: string | null;
  mine: boolean;
  messages: ChatMessage[];
}

/**
 * Group consecutive messages by day + author so bubbles stack like a real chat.
 * A new group also starts when more than 5 minutes pass between messages.
 */
export function groupMessages(
  messages: ChatMessage[],
  currentUserId: string | null,
  gapMs = 5 * 60 * 1000,
): ChatGroup[] {
  const groups: ChatGroup[] = [];
  for (const m of messages) {
    const day = dayKey(m.createdAt);
    const last = groups[groups.length - 1];
    const lastMsg = last?.messages[last.messages.length - 1];
    const sameRun =
      last &&
      last.day === day &&
      last.authorId === m.authorId &&
      lastMsg &&
      new Date(m.createdAt).getTime() - new Date(lastMsg.createdAt).getTime() <= gapMs &&
      lastMsg.visibility === m.visibility;
    if (sameRun) {
      last.messages.push(m);
    } else {
      groups.push({
        day,
        authorId: m.authorId,
        authorName: m.authorName,
        authorRole: m.authorRole,
        mine: !!currentUserId && m.authorId === currentUserId,
        messages: [m],
      });
    }
  }
  return groups;
}

/** Index of the first message the user has not read yet, or -1. */
export function firstUnreadIndex(
  messages: ChatMessage[],
  currentUserId: string | null,
  lastReadAt: string | null,
): number {
  if (!lastReadAt) return -1;
  const read = new Date(lastReadAt).getTime();
  return messages.findIndex(
    (m) => m.authorId !== currentUserId && new Date(m.createdAt).getTime() > read,
  );
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function isPdfAttachment(att: ChatAttachment): boolean {
  return att.mime === "application/pdf";
}

/**
 * Thread-list timestamp: time for today, weekday within the last week,
 * short date beyond that. Always en-US so digits stay ASCII in the RTL UI.
 */
export function formatThreadTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (dayKey(iso) === dayKey(now.toISOString())) return formatTime(iso);
  const diff = now.getTime() - d.getTime();
  if (diff < 7 * 86400000) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Human-readable list of the extensions users may attach. */
export const ALLOWED_ATTACHMENT_LABEL = "PNG, JPG, WEBP, GIF, PDF, DOC(X), XLS(X), TXT";
