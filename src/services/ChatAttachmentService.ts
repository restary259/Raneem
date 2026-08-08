import { supabase } from "@/integrations/supabase/client";
import { validateAttachmentFile, type ChatAttachment } from "@/lib/chatFormat";

const BUCKET = "chat-attachments";

export class AttachmentValidationError extends Error {
  constructor(public reason: "size" | "mime") {
    super(reason);
  }
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-80);
}

/**
 * Upload one file into the private chat bucket.
 * Path layout `{case|direct}/{threadId}/{uuid}-{name}` is what storage RLS checks.
 */
export async function uploadChatAttachment(
  threadType: "case" | "direct",
  threadId: string,
  file: File,
): Promise<ChatAttachment> {
  const invalid = validateAttachmentFile(file);
  if (invalid) throw new AttachmentValidationError(invalid);

  const path = `${threadType}/${threadId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;

  return { name: file.name, path, mime: file.type, size: file.size };
}

/** Short-lived signed URL — the bucket is private, never public. */
export async function getAttachmentUrl(path: string, expiresIn = 600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function openAttachment(path: string): Promise<void> {
  const url = await getAttachmentUrl(path);
  window.open(url, "_blank", "noopener,noreferrer");
}
