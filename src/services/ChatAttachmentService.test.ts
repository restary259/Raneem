/* eslint-disable @typescript-eslint/no-explicit-any -- loose types for untyped mock surfaces (supabase query builders, browser globals) */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MockXHR {
  static instances: MockXHR[] = [];
  method = "";
  url = "";
  headers: Record<string, string> = {};
  upload: { onprogress: ((e: unknown) => void) | null } = { onprogress: null };
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  onload: (() => void) | null = null;
  status = 200;
  responseText = "";
  sentBody: unknown;
  aborted = false;

  constructor() {
    MockXHR.instances.push(this);
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }
  send(body: unknown) {
    this.sentBody = body;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
}

let session: { access_token?: string } | null = { access_token: "tok" };
let signedUrlResult: {
  data: { signedUrl: string } | null;
  error: { message: string } | null;
} = {
  data: { signedUrl: "https://signed" },
  error: null,
};
let removeCalls: string[][] = [];
let openSpy: ReturnType<typeof vi.fn>;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session } }) },
    storage: {
      from: () => ({
        createSignedUrl: () => Promise.resolve(signedUrlResult),
        remove: (paths: string[]) => {
          removeCalls.push(paths);
          return Promise.resolve({ error: null });
        },
      }),
    },
  },
}));

import {
  AttachmentValidationError,
  getAttachmentUrl,
  openAttachment,
  removeChatAttachment,
  uploadChatAttachment,
  uploadChatAttachmentWithProgress,
  uploadVoiceChatAttachmentWithProgress,
} from "./ChatAttachmentService";

beforeEach(() => {
  MockXHR.instances = [];
  session = { access_token: "tok" };
  signedUrlResult = { data: { signedUrl: "https://signed" }, error: null };
  removeCalls = [];
  (globalThis as any).XMLHttpRequest = MockXHR;
  vi.spyOn(crypto, "randomUUID").mockReturnValue(
    "uuid-1" as `${string}-${string}-${string}-${string}-${string}`,
  );
  openSpy = vi.fn();
  vi.spyOn(window, "open").mockImplementation(openSpy as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const pngFile = (name = "photo.png") =>
  new File(["x"], name, { type: "image/png" });

describe("uploadChatAttachmentWithProgress — validation", () => {
  it("rejects an oversized file before opening a request", async () => {
    const big = new File([new Uint8Array(1)], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 20 * 1024 * 1024 });
    const handle = uploadChatAttachmentWithProgress("case", "c1", big);
    await expect(handle.promise).rejects.toBeInstanceOf(
      AttachmentValidationError,
    );
    expect(MockXHR.instances).toHaveLength(0);
    expect(() => handle.cancel()).not.toThrow();
  });

  it("rejects a disallowed mime type", async () => {
    const exe = new File(["x"], "virus.exe", {
      type: "application/x-msdownload",
    });
    const handle = uploadChatAttachmentWithProgress("case", "c1", exe);
    await expect(handle.promise).rejects.toMatchObject({ reason: "mime" });
    expect(MockXHR.instances).toHaveLength(0);
  });
});

describe("uploadChatAttachmentWithProgress — upload", () => {
  it("posts to the private bucket path with auth headers", async () => {
    const handle = uploadChatAttachmentWithProgress(
      "case",
      "c1",
      pngFile("my report.png"),
    );
    await vi.waitFor(() => expect(MockXHR.instances).toHaveLength(1));
    const xhr = MockXHR.instances[0];

    expect(xhr.method).toBe("POST");
    expect(xhr.url).toBe(
      "http://127.0.0.1:54321/storage/v1/object/chat-attachments/case/c1/uuid-1-my_report.png",
    );
    expect(xhr.headers.Authorization).toBe("Bearer tok");
    expect(xhr.headers.apikey).toBe("test-publishable-key");
    expect(xhr.headers["x-upsert"]).toBe("false");
    expect(xhr.headers["Content-Type"]).toBe("image/png");

    xhr.status = 200;
    xhr.onload?.();
    await expect(handle.promise).resolves.toEqual({
      name: "my report.png",
      path: "case/c1/uuid-1-my_report.png",
      mime: "image/png",
      size: 1,
    });
  });

  it("reports upload progress percentages", async () => {
    const onProgress = vi.fn();
    const handle = uploadChatAttachmentWithProgress(
      "case",
      "c1",
      pngFile(),
      onProgress,
    );
    await vi.waitFor(() => expect(MockXHR.instances).toHaveLength(1));
    const xhr = MockXHR.instances[0];

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 });
    expect(onProgress).toHaveBeenCalledWith(25);
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 1, total: 2 });
    expect(onProgress).toHaveBeenCalledTimes(1);

    xhr.status = 201;
    xhr.onload?.();
    await handle.promise;
    expect(onProgress).toHaveBeenCalledWith(100);
  });

  it("surfaces the provider message from a non-2xx response", async () => {
    const handle = uploadChatAttachmentWithProgress("case", "c1", pngFile());
    await vi.waitFor(() => expect(MockXHR.instances).toHaveLength(1));
    const xhr = MockXHR.instances[0];
    xhr.status = 413;
    xhr.responseText = JSON.stringify({ message: "Payload too large" });
    xhr.onload?.();
    await expect(handle.promise).rejects.toThrow("Payload too large");
  });

  it("falls back to the HTTP status when the error body is not JSON", async () => {
    const handle = uploadChatAttachmentWithProgress("case", "c1", pngFile());
    await vi.waitFor(() => expect(MockXHR.instances).toHaveLength(1));
    const xhr = MockXHR.instances[0];
    xhr.status = 500;
    xhr.responseText = "<html>oops</html>";
    xhr.onload?.();
    await expect(handle.promise).rejects.toThrow("HTTP 500");
  });

  it("rejects when there is no session", async () => {
    session = null;
    const handle = uploadChatAttachmentWithProgress("case", "c1", pngFile());
    await expect(handle.promise).rejects.toThrow("Not authenticated");
  });

  it("rejects on a network error", async () => {
    const handle = uploadChatAttachmentWithProgress("case", "c1", pngFile());
    await vi.waitFor(() => expect(MockXHR.instances).toHaveLength(1));
    MockXHR.instances[0].onerror?.();
    await expect(handle.promise).rejects.toThrow("network");
  });

  it("rejects with an AbortError when cancelled", async () => {
    const handle = uploadChatAttachmentWithProgress("case", "c1", pngFile());
    await vi.waitFor(() => expect(MockXHR.instances).toHaveLength(1));
    handle.cancel();
    expect(MockXHR.instances[0].aborted).toBe(true);
    await expect(handle.promise).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("uploadVoiceChatAttachmentWithProgress", () => {
  it("tags the upload as a voice note with its duration", async () => {
    const audio = new File(["x"], "note.webm", { type: "audio/webm" });
    const handle = uploadVoiceChatAttachmentWithProgress(
      "direct",
      "d1",
      audio,
      4200,
    );
    await vi.waitFor(() => expect(MockXHR.instances).toHaveLength(1));
    const xhr = MockXHR.instances[0];
    xhr.status = 200;
    xhr.onload?.();
    await expect(handle.promise).resolves.toMatchObject({
      kind: "voice",
      durationMs: 4200,
      path: "direct/d1/uuid-1-note.webm",
    });
  });

  it("rejects a recording over the duration limit", async () => {
    const audio = new File(["x"], "note.webm", { type: "audio/webm" });
    const handle = uploadVoiceChatAttachmentWithProgress(
      "direct",
      "d1",
      audio,
      10 * 60 * 1000,
    );
    await expect(handle.promise).rejects.toMatchObject({ reason: "duration" });
  });
});

describe("uploadChatAttachment", () => {
  it("resolves with the attachment once the upload completes", async () => {
    const promise = uploadChatAttachment("case", "c1", pngFile());
    await vi.waitFor(() => expect(MockXHR.instances).toHaveLength(1));
    MockXHR.instances[0].status = 200;
    MockXHR.instances[0].onload?.();
    await expect(promise).resolves.toMatchObject({
      name: "photo.png",
      mime: "image/png",
    });
  });
});

describe("signed URLs", () => {
  it("returns the signed url", async () => {
    await expect(getAttachmentUrl("case/c1/a.png")).resolves.toBe(
      "https://signed",
    );
  });

  it("throws when signing fails", async () => {
    signedUrlResult = { data: null, error: { message: "not found" } };
    await expect(getAttachmentUrl("missing")).rejects.toEqual({
      message: "not found",
    });
  });

  it("opens the signed url in a new tab", async () => {
    await openAttachment("case/c1/a.png");
    expect(openSpy).toHaveBeenCalledWith(
      "https://signed",
      "_blank",
      "noopener,noreferrer",
    );
  });
});

describe("removeChatAttachment", () => {
  it("removes the path from the bucket", async () => {
    await removeChatAttachment("case/c1/a.png");
    expect(removeCalls).toEqual([["case/c1/a.png"]]);
  });
});
