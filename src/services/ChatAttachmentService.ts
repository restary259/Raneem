import { supabase } from "@/integrations/supabase/client";
import {
  validateAttachmentFile,
  validateVoiceRecording,
  type ChatAttachment,
} from "@/lib/chatFormat";

const BUCKET = "chat-attachments";

export class AttachmentValidationError extends Error {
  constructor(public reason: "size" | "mime" | "duration") {
    super(reason);
  }
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-80);
}

export interface UploadHandle {
  promise: Promise<ChatAttachment>;
  cancel: () => void;
}

/**
 * Upload one file into the private chat bucket with progress reporting.
 * The JS client exposes no progress events, so this posts directly to the
 * storage REST endpoint with the caller's session token. The path layout
 * `{case|direct}/{threadId}/{uuid}-{name}` is what storage RLS checks.
 */
function uploadAttachmentWithProgress(
  threadType: "case" | "direct",
  threadId: string,
  file: File,
  validate: () => "size" | "mime" | "duration" | null,
  meta: Pick<ChatAttachment, "kind" | "durationMs">,
  onProgress?: (percent: number) => void,
): UploadHandle {
  const invalid = validate();
  if (invalid) {
    return {
      promise: Promise.reject(new AttachmentValidationError(invalid)),
      cancel: () => undefined,
    };
  }

  const path = threadType + "/" + threadId + "/" + crypto.randomUUID() + "-" + safeName(file.name);
  const xhr = new XMLHttpRequest();

  const promise = new Promise<ChatAttachment>((resolve, reject) => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        const token = data.session?.access_token;
        if (!token) {
          reject(new Error("Not authenticated"));
          return;
        }
        const base = import.meta.env.VITE_SUPABASE_URL as string;
        xhr.open("POST", base + "/storage/v1/object/" + BUCKET + "/" + encodeURI(path));
        xhr.setRequestHeader("Authorization", "Bearer " + token);
        xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
        xhr.setRequestHeader("x-upsert", "false");
        if (file.type) xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onerror = () => reject(new Error("network"));
        xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            onProgress?.(100);
            resolve({
              name: file.name,
              path,
              mime: file.type,
              size: file.size,
              ...meta,
            });
          } else {
            let message = "HTTP " + xhr.status;
            try {
              const parsed = JSON.parse(xhr.responseText);
              message = parsed.message || parsed.error || message;
            } catch {
              /* keep the status text */
            }
            reject(new Error(message));
          }
        };
        xhr.send(file);
      })
      .catch(reject);
  });

  return { promise, cancel: () => xhr.abort() };
}

/**
 * Upload one ordinary file into the private chat bucket with progress reporting.
 * The browser and database both validate the allowed document/image MIME list.
 */
export function uploadChatAttachmentWithProgress(
  threadType: "case" | "direct",
  threadId: string,
  file: File,
  onProgress?: (percent: number) => void,
): UploadHandle {
  return uploadAttachmentWithProgress(
    threadType,
    threadId,
    file,
    () => validateAttachmentFile(file),
    {},
    onProgress,
  );
}

/**
 * Upload a recorded voice note. Audio types are deliberately separated from
 * ordinary file attachments so arbitrary audio files cannot enter via the
 * normal attach picker.
 */
export function uploadVoiceChatAttachmentWithProgress(
  threadType: "case" | "direct",
  threadId: string,
  file: File,
  durationMs: number,
  onProgress?: (percent: number) => void,
): UploadHandle {
  return uploadAttachmentWithProgress(
    threadType,
    threadId,
    file,
    () => validateVoiceRecording(file, durationMs),
    { kind: "voice", durationMs },
    onProgress,
  );
}

/** Simple promise wrapper kept for callers that do not need progress. */
export async function uploadChatAttachment(
  threadType: "case" | "direct",
  threadId: string,
  file: File,
): Promise<ChatAttachment> {
  return uploadChatAttachmentWithProgress(threadType, threadId, file).promise;
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

/** Remove an upload that was never sent (composer cancel / remove). */
export async function removeChatAttachment(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
}
