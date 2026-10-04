/* eslint-disable @typescript-eslint/no-explicit-any -- loose types for untyped mock surfaces (supabase query builders, browser globals) */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MockImage {
  static instances: MockImage[] = [];
  crossOrigin = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = "";
  set src(value: string) {
    this._src = value;
  }
  get src() {
    return this._src;
  }
  constructor() {
    MockImage.instances.push(this);
  }
}

let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;
let getContext: ReturnType<typeof vi.fn>;
let toBlob: ReturnType<typeof vi.fn>;
let anchorClick: any;
let ctx: Record<string, ReturnType<typeof vi.fn>>;

function buildElement(id = "box"): HTMLElement {
  const el = document.createElement("div");
  el.id = id;
  const child = document.createElement("span");
  child.textContent = "content";
  el.appendChild(child);
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  MockImage.instances = [];
  (globalThis as any).Image = MockImage;

  createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
  revokeObjectURL = vi.fn();
  (globalThis as any).URL.createObjectURL = createObjectURL;
  (globalThis as any).URL.revokeObjectURL = revokeObjectURL;

  ctx = {
    scale: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  };
  getContext = vi.fn().mockReturnValue(ctx);
  toBlob = vi.fn((cb: (b: Blob | null) => void) =>
    cb(new Blob(["x"], { type: "image/png" })),
  );
  (HTMLCanvasElement.prototype as any).getContext = getContext;
  (HTMLCanvasElement.prototype as any).toBlob = toBlob;

  anchorClick = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
    anchorClick();
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const loadImage = async () => {
  await vi.waitFor(() => expect(MockImage.instances).toHaveLength(1));
  return MockImage.instances[0];
};

describe("captureElementAsImage", () => {
  it("throws when the element does not exist", async () => {
    const { captureElementAsImage } = await import("./captureUtils");
    await expect(captureElementAsImage("missing")).rejects.toThrow(
      "Element #missing not found",
    );
  });

  it("renders the element to a PNG and triggers a download", async () => {
    buildElement();
    const { captureElementAsImage } = await import("./captureUtils");
    const promise = captureElementAsImage("box", "png", "my-capture.png");

    const img = await loadImage();
    expect(img.crossOrigin).toBe("anonymous");
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    img.onload?.();
    await expect(promise).resolves.toBeUndefined();

    expect(ctx.drawImage).toHaveBeenCalled();
    expect(toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      "image/png",
      undefined,
    );
    expect(anchorClick).toHaveBeenCalledTimes(1);
    // svg blob url + download blob url are both revoked
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("fills a white background for JPEG and uses the jpg default name", async () => {
    buildElement();
    const { captureElementAsImage } = await import("./captureUtils");
    const promise = captureElementAsImage("box", "jpeg");

    const img = await loadImage();
    img.onload?.();
    await promise;

    expect(ctx.fillRect).toHaveBeenCalled();
    expect(toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      "image/jpeg",
      0.95,
    );
    const anchor = document.createElement("a");
    // The default file name is applied to the anchor that was clicked.
    expect(anchorClick).toHaveBeenCalled();
  });

  it("rejects when the canvas context is unavailable", async () => {
    buildElement();
    getContext.mockReturnValueOnce(null);
    const { captureElementAsImage } = await import("./captureUtils");
    const promise = captureElementAsImage("box");

    const img = await loadImage();
    img.onload?.();
    await expect(promise).rejects.toThrow("Canvas context not available");
  });

  it("rejects when the canvas cannot produce a blob", async () => {
    buildElement();
    toBlob.mockImplementationOnce((cb: (b: Blob | null) => void) => cb(null));
    const { captureElementAsImage } = await import("./captureUtils");
    const promise = captureElementAsImage("box");

    const img = await loadImage();
    img.onload?.();
    await expect(promise).rejects.toThrow("Failed to create image blob");
  });

  it("rejects when the SVG image fails to load", async () => {
    buildElement();
    const { captureElementAsImage } = await import("./captureUtils");
    const promise = captureElementAsImage("box");

    const img = await loadImage();
    img.onerror?.();
    await expect(promise).rejects.toThrow("Failed to load SVG as image");
  });

  it("removes the off-screen clone after serializing", async () => {
    buildElement();
    const { captureElementAsImage } = await import("./captureUtils");
    const promise = captureElementAsImage("box");
    const img = await loadImage();
    img.onload?.();
    await promise;
    expect(document.querySelectorAll("#box")).toHaveLength(1);
  });
});
