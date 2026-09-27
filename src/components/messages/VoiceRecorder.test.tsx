import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import VoiceRecorder from "./VoiceRecorder";

class FakeMediaRecorder extends EventTarget {
  static isTypeSupported = vi.fn(() => true);
  state: RecordingState = "inactive";
  mimeType = "audio/webm; codecs=opus; bitrate=48000";

  start() {
    this.state = "recording";
  }

  stop() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    this.dispatchEvent(new BlobEvent("dataavailable", {
      data: new Blob(["voice"], { type: this.mimeType }),
    }));
    this.dispatchEvent(new Event("stop"));
  }
}

const stopTrack = vi.fn();
const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;

describe("VoiceRecorder", () => {
  beforeEach(() => {
    stopTrack.mockClear();
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:voice"),
      revokeObjectURL: vi.fn(),
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => stream) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts on one tap and sends from the visible send control", async () => {
    const onSend = vi.fn(async (_file: File, _durationMs: number) => undefined);
    render(<VoiceRecorder onSend={onSend} />);

    await userEvent.click(screen.getByRole("button", { name: "chat.voice.record" }));
    await screen.findByRole("button", { name: "chat.voice.send" });
    await userEvent.click(screen.getByRole("button", { name: "chat.voice.send" }));

    await waitFor(() => expect(onSend).toHaveBeenCalledOnce());
    const [file, duration] = onSend.mock.calls[0];
    expect(file.type).toBe("audio/webm;codecs=opus");
    expect(duration).toBeGreaterThan(0);
  });

  it("cancels an active recording without sending or crashing", async () => {
    const onSend = vi.fn(async (_file: File, _durationMs: number) => undefined);
    render(<VoiceRecorder onSend={onSend} />);

    await userEvent.click(screen.getByRole("button", { name: "chat.voice.record" }));
    const cancel = await screen.findByRole("button", { name: "chat.voice.cancel" });
    fireEvent.pointerDown(cancel);

    await screen.findByRole("button", { name: "chat.voice.record" });
    expect(onSend).not.toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalled();
  });

  it("ignores a microphone permission result that arrives after unmount", async () => {
    let resolvePermission: ((value: MediaStream) => void) | undefined;
    const permission = new Promise<MediaStream>((resolve) => {
      resolvePermission = resolve;
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(() => permission) },
    });
    const onSend = vi.fn(async (_file: File, _durationMs: number) => undefined);
    const view = render(<VoiceRecorder onSend={onSend} />);

    await userEvent.click(screen.getByRole("button", { name: "chat.voice.record" }));
    view.unmount();
    await act(async () => resolvePermission?.(stream));

    expect(onSend).not.toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalled();
  });

  it("shows the unsupported message when recording APIs are unavailable", async () => {
    vi.stubGlobal("MediaRecorder", undefined);
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    render(<VoiceRecorder onSend={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "chat.voice.record" }));
    expect(screen.getByRole("alert")).toHaveTextContent("chat.voice.error.unsupported");
  });
});