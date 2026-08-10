import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { ChatMessage, OFFLINE_FAQ, clearChatHistory, loadChatHistory, saveChatHistory } from "./chatCache";

// jsdom does not implement crypto.subtle, so provide a real AES-GCM
// implementation (Node's WebCrypto) for the duration of these tests.
beforeAll(() => {
  vi.stubGlobal("crypto", webcrypto);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const KEY_V2 = "darb-ai-chat-history-v2";
const LEGACY_KEY = "darb-ai-chat-history";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const message = (i: number): ChatMessage => ({ role: "user", content: `m${i}` });

describe("saveChatHistory / loadChatHistory", () => {
  it("round-trips a conversation", async () => {
    const history: ChatMessage[] = [message(1), { role: "assistant", content: "hello" }];
    await saveChatHistory(history);
    expect(await loadChatHistory()).toEqual(history);
  });

  it("keeps only the 50 most recent messages", async () => {
    await saveChatHistory(Array.from({ length: 60 }, (_, i) => message(i)));
    const stored = await loadChatHistory();
    expect(stored).toHaveLength(50);
    expect(stored[0].content).toBe("m10");
    expect(stored[49].content).toBe("m59");
  });

  it("returns an empty history when nothing is stored", async () => {
    expect(await loadChatHistory()).toEqual([]);
  });

  it("returns an empty history when the entry is corrupt", async () => {
    localStorage.setItem(KEY_V2, "not json");
    expect(await loadChatHistory()).toEqual([]);
    expect(localStorage.getItem(KEY_V2)).toBeNull();
  });

  it("returns an empty history for an unsupported payload version", async () => {
    localStorage.setItem(KEY_V2, JSON.stringify({ v: 1, data: "plaintext" }));
    expect(await loadChatHistory()).toEqual([]);
    expect(localStorage.getItem(KEY_V2)).toBeNull();
  });

  it("never throws when storage rejects the write", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    await expect(saveChatHistory([message(1)])).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it("stores only ciphertext — the plaintext conversation never hits localStorage", async () => {
    await saveChatHistory([message(1), { role: "assistant", content: "secret answer" }]);
    const raw = localStorage.getItem(KEY_V2);
    expect(raw).not.toBeNull();
    expect(raw).not.toContain("secret answer");
    expect(raw).not.toContain('"role"');
    expect(raw).not.toContain('"content"');
    const payload = JSON.parse(raw!);
    expect(payload.v).toBe(2);
    expect(payload.iv).toBeTruthy();
    expect(payload.data).toBeTruthy();
    expect(payload.savedAt).toEqual(expect.any(Number));
  });

  it("uses a fresh IV so identical conversations encrypt differently", async () => {
    await saveChatHistory([message(1)]);
    const first = localStorage.getItem(KEY_V2);
    await saveChatHistory([message(1)]);
    const second = localStorage.getItem(KEY_V2);
    expect(first).not.toEqual(second);
  });

  it("cannot decrypt once the session key is gone (tab closed)", async () => {
    await saveChatHistory([message(1)]);
    expect(await loadChatHistory()).toEqual([message(1)]);
    sessionStorage.clear();
    expect(await loadChatHistory()).toEqual([]);
  });

  it("purges the legacy plaintext key on access", async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([message(1)]));
    await saveChatHistory([message(2)]);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it("expires the history after the TTL and removes the ciphertext", async () => {
    const now = Date.now();
    const spy = vi.spyOn(Date, "now").mockReturnValue(now);
    await saveChatHistory([message(1)]);
    expect(await loadChatHistory()).toEqual([message(1)]);
    spy.mockReturnValue(now + TTL_MS + 1);
    expect(await loadChatHistory()).toEqual([]);
    expect(localStorage.getItem(KEY_V2)).toBeNull();
    spy.mockRestore();
  });

  it("does not expire history within the TTL", async () => {
    const now = Date.now();
    const spy = vi.spyOn(Date, "now").mockReturnValue(now);
    await saveChatHistory([message(1)]);
    spy.mockReturnValue(now + TTL_MS - 1);
    expect(await loadChatHistory()).toEqual([message(1)]);
    spy.mockRestore();
  });
});

describe("clearChatHistory", () => {
  it("removes the stored conversation and the session key", async () => {
    await saveChatHistory([message(1)]);
    expect(await loadChatHistory()).toEqual([message(1)]);
    clearChatHistory();
    expect(localStorage.getItem(KEY_V2)).toBeNull();
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(sessionStorage.getItem("darb-ai-chat-key")).toBeNull();
    expect(await loadChatHistory()).toEqual([]);
  });
});

describe("OFFLINE_FAQ", () => {
  it("answers every cached question with non-empty text", () => {
    const questions = Object.keys(OFFLINE_FAQ);
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) expect(OFFLINE_FAQ[q].trim().length).toBeGreaterThan(0);
  });
});
