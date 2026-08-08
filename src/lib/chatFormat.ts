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
