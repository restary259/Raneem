import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import PWAInstaller from "@/components/common/PWAInstaller";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string, f?: string) => f ?? k, i18n: { language: "en" } }),
}));

vi.mock("@/hooks/useDirection", () => ({
  useDirection: () => ({ dir: "ltr", isRtl: false }),
}));

/** Minimal `beforeinstallprompt` stand-in, since jsdom never fires the real one. */
class FakeInstallPrompt extends Event {
  outcome: "accepted" | "dismissed" = "accepted";
  prompt = vi.fn().mockResolvedValue(undefined);
  userChoice = Promise.resolve({ outcome: this.outcome });
}

const setStandalone = (standalone: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: standalone && query.includes("standalone"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

const installButton = () => screen.queryByRole("button", { name: "pwa.installNow" });

describe("PWAInstaller", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    (window.navigator as any).standalone = false;
    setStandalone(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a persistent install tab on a fresh visit", () => {
    render(<PWAInstaller />);
    expect(installButton()).toBeInTheDocument();
  });

  it("stays visible after a dismissed browser prompt (never a one-shot popup)", async () => {
    render(<PWAInstaller />);
    const prompt = new FakeInstallPrompt("beforeinstallprompt");
    prompt.outcome = "dismissed";
    prompt.userChoice = Promise.resolve({ outcome: "dismissed" });

    await act(async () => {
      window.dispatchEvent(prompt);
    });
    expect(installButton()).toBeInTheDocument();

    await act(async () => {
      installButton()!.click();
    });
    expect(prompt.prompt).toHaveBeenCalled();
    // Declined → the tab must remain so the user can try again later.
    expect(installButton()).toBeInTheDocument();
  });

  it("retires once the app is actually installed", async () => {
    render(<PWAInstaller />);
    expect(installButton()).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(installButton()).not.toBeInTheDocument();
  });

  it("does not render when launched as an installed app", () => {
    setStandalone(true);
    render(<PWAInstaller />);
    expect(installButton()).not.toBeInTheDocument();
  });

  it("offers no dismiss control", () => {
    render(<PWAInstaller />);
    expect(screen.queryByRole("button", { name: /close/i })).not.toBeInTheDocument();
  });

  it("anchors above the WhatsApp side tab on the same edge", () => {
    render(<PWAInstaller />);
    const tab = installButton()!.closest("div")!;
    const cls = tab.className;
    // Same anchored edge as the WhatsApp tab, so the two stack in one column…
    expect(cls).toContain("fixed");
    expect(cls).toContain("end-0");
    expect(cls).toContain("z-40");
    // …and the offset must place it ABOVE it (WhatsApp sits at 5.25rem / md:bottom-8).
    expect(cls).toContain("bottom-[calc(8.5rem+env(safe-area-inset-bottom))]");
    expect(cls).toContain("md:bottom-[5.25rem]");
  });
});
