/**
 * Shared upload validation for the private student-documents bucket.
 * Keep these limits in sync with the DocumentsManager rules.
 */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

export const ALLOWED_UPLOAD_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const ALLOWED_UPLOAD_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "doc",
  "docx",
];

export function validateUploadFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File exceeds the ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB limit`;
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
    return "Unsupported file type";
  }
  if (file.type && !ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return "Unsupported file type";
  }
  return null;
}
