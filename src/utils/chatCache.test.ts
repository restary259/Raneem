import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ChatMessage, OFFLINE_FAQ, clearChatHistory, loadChatHistory, saveChatHistory } from "./chatCache";

const KEY = "darb-ai-chat-history";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const message = (i: number): ChatMessage => ({ role: "user", content: `m${i}` });

describe("saveChatHistory / loadChatHistory", () => {
  it("round-trips a conversation", () => {
    const history: ChatMessage[] = [message(1), { role: "assistant", content: "hello" }];
    saveChatHistory(history);
    expect(loadChatHistory()).toEqual(history);
  });

  it("keeps only the 50 most recent messages", () => {
    saveChatHistory(Array.from({ length: 60 }, (_, i) => message(i)));
    const stored = loadChatHistory();
    expect(stored).toHaveLength(50);
    expect(stored[0].content).toBe("m10");
    expect(stored[49].content).toBe("m59");
  });

  it("returns an empty history when nothing is stored or the entry is corrupt", () => {
    expect(loadChatHistory()).toEqual([]);
    localStorage.setItem(KEY, "not json");
    expect(loadChatHistory()).toEqual([]);
  });

  it("never throws when storage rejects the write", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() => saveChatHistory([message(1)])).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });
});

describe("clearChatHistory", () => {
  it("removes the stored conversation", () => {
    saveChatHistory([message(1)]);
    clearChatHistory();
    expect(loadChatHistory()).toEqual([]);
  });
});

describe("OFFLINE_FAQ", () => {
  it("answers every cached question with non-empty text", () => {
    const questions = Object.keys(OFFLINE_FAQ);
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) expect(OFFLINE_FAQ[q].trim().length).toBeGreaterThan(0);
  });
});
