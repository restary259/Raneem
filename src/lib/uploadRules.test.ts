import { describe, it, expect } from "vitest";
import { MAX_UPLOAD_BYTES, validateUploadFile } from "./uploadRules";

function makeFile(name: string, type: string, size = 1024): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("validateUploadFile", () => {
  it("accepts an allowed extension and mime type", () => {
    expect(validateUploadFile(makeFile("passport.pdf", "application/pdf"))).toBeNull();
    expect(validateUploadFile(makeFile("PHOTO.JPG", "image/jpeg"))).toBeNull();
  });

  it("accepts a known extension when the browser reports no mime type", () => {
    expect(validateUploadFile(makeFile("scan.docx", ""))).toBeNull();
  });

  it("rejects files above the size limit", () => {
    const error = validateUploadFile(makeFile("big.pdf", "application/pdf", MAX_UPLOAD_BYTES + 1));
    expect(error).toBe("File exceeds the 15 MB limit");
  });

  it("rejects unsupported extensions", () => {
    expect(validateUploadFile(makeFile("archive.zip", "application/zip"))).toBe("Unsupported file type");
    expect(validateUploadFile(makeFile("noextension", "application/pdf"))).toBe("Unsupported file type");
  });

  it("rejects an allowed extension carrying a disallowed mime type", () => {
    expect(validateUploadFile(makeFile("payload.pdf", "application/x-msdownload"))).toBe("Unsupported file type");
  });
});
