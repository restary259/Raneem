import { describe, expect, it } from "vitest";
import {
  dayLabel,
  formatFileSize,
  formatVoiceDuration,
  groupMessages,
  initials,
  isVoiceAttachment,
  normalizeVoiceMime,
  validateAttachmentFile,
  validateVoiceRecording,
  type ChatMessage,
} from "@/lib/chatFormat";

function msg(over: Partial<ChatMessage>): ChatMessage {
  return {
    id: Math.random().toString(36).slice(2),
    authorId: "u1",
    authorName: "Rana",
    authorRole: "admin",
    body: "hi",
    createdAt: "2026-08-08T10:00:00.000Z",
    attachments: [],
    kind: "text",
    ...over,
  };
}

describe("chatFormat", () => {
  it("groups consecutive messages from the same author", () => {
    const groups = groupMessages(
      [
        msg({ createdAt: "2026-08-08T10:00:00.000Z" }),
        msg({ createdAt: "2026-08-08T10:01:00.000Z" }),
        msg({ authorId: "u2", createdAt: "2026-08-08T10:02:00.000Z" }),
      ],
      "u1",
    );
    expect(groups).toHaveLength(2);
    expect(groups[0].messages).toHaveLength(2);
    expect(groups[0].mine).toBe(true);
    expect(groups[1].mine).toBe(false);
  });

  it("starts a new group after a long gap or a new day", () => {
    const groups = groupMessages(
      [
        msg({ createdAt: "2026-08-08T10:00:00.000Z" }),
        msg({ createdAt: "2026-08-08T10:30:00.000Z" }),
        msg({ createdAt: "2026-08-09T10:31:00.000Z" }),
      ],
      "u1",
    );
    expect(groups).toHaveLength(3);
  });

  it("keeps internal notes in their own group", () => {
    const groups = groupMessages(
      [
        msg({ visibility: "shared", createdAt: "2026-08-08T10:00:00.000Z" }),
        msg({ visibility: "internal", createdAt: "2026-08-08T10:00:30.000Z" }),
      ],
      "u1",
    );
    expect(groups).toHaveLength(2);
  });

  it("labels today, yesterday and older days", () => {
    const now = new Date("2026-08-08T12:00:00.000Z");
    expect(dayLabel("2026-08-08T09:00:00.000Z", now).type).toBe("today");
    expect(dayLabel("2026-08-07T09:00:00.000Z", now).type).toBe("yesterday");
    expect(dayLabel("2026-08-01T09:00:00.000Z", now).type).toBe("date");
  });

  it("rejects oversized files and unsupported types", () => {
    expect(validateAttachmentFile({ size: 1024, type: "image/png" })).toBeNull();
    expect(validateAttachmentFile({ size: 20 * 1024 * 1024, type: "image/png" })).toBe("size");
    expect(validateAttachmentFile({ size: 1024, type: "application/x-msdownload" })).toBe("mime");
  });

  it("formats sizes and initials", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(3 * 1024 * 1024)).toBe("3.0 MB");
    expect(initials("Rana Dwahde")).toBe("RD");
    expect(initials(null)).toBe("?");
  });

  it("validates voice recordings and formats their duration", () => {
    const voice = { size: 48_000, type: "audio/webm" };
    expect(validateVoiceRecording(voice, 7_250)).toBeNull();
    expect(validateVoiceRecording(voice, 0)).toBe("duration");
    expect(validateVoiceRecording(voice, 5 * 60 * 1000 + 1)).toBe("duration");
    expect(validateVoiceRecording({ size: 48_000, type: "audio/wav" }, 7_250)).toBe("mime");
    expect(validateVoiceRecording({ size: 48_000, type: "audio/webm; codecs=opus; bitrate=48000" }, 7_250)).toBeNull();
    expect(normalizeVoiceMime("audio/ogg; codecs=opus; bitrate=48000")).toBe("audio/ogg;codecs=opus");
    expect(formatVoiceDuration(7_250)).toBe("0:07");
    expect(formatVoiceDuration(65_000)).toBe("1:05");
  });

  it("recognizes voice attachment metadata without treating files as voice", () => {
    expect(
      isVoiceAttachment({
        name: "voice.webm",
        path: "direct/t/voice.webm",
        mime: "audio/webm",
        size: 48_000,
        kind: "voice",
        durationMs: 7_250,
      }),
    ).toBe(true);
    expect(
      isVoiceAttachment({
        name: "voice.webm",
        path: "direct/t/voice.webm",
        mime: "audio/webm",
        size: 48_000,
      }),
    ).toBe(false);
  });

});
