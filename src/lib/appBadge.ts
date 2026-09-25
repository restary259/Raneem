/**
 * App icon + browser-tab badging.
 *
 * Two mechanisms, applied together:
 *  1. The Badging API (`navigator.setAppBadge`) paints the OS-level red dot on
 *     the installed app icon (iOS 16.4+ home screen, Android, macOS dock,
 *     Windows taskbar) — visible while the app is closed.
 *  2. A canvas-painted favicon + title prefix, so a plain browser tab still
 *     shows the unread count.
 */

const BASE_ICON = "/favicon-v2.png";
const ICON_LINK_ID = "darb-dynamic-favicon";

let baseImage: HTMLImageElement | null = null;
let baseTitle: string | null = null;
let lastPainted = -1;

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function setOsBadge(count: number) {
  const nav = navigator as BadgeNavigator;
  if (typeof nav.setAppBadge !== "function") return;
  const call = count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.();
  // Permission/unsupported rejections must never surface to the user.
  void Promise.resolve(call).catch(() => undefined);
}

function iconLink(): HTMLLinkElement {
  let link = document.getElementById(ICON_LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = ICON_LINK_ID;
    link.rel = "icon";
    link.type = "image/png";
    document.head.appendChild(link);
  }
  return link;
}

function loadBaseImage(): Promise<HTMLImageElement | null> {
  if (baseImage) return Promise.resolve(baseImage);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      baseImage = img;
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = BASE_ICON;
  });
}

async function paintFavicon(count: number) {
  const img = await loadBaseImage();
  if (!img) return;

  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.drawImage(img, 0, 0, size, size);

  if (count > 0) {
    const label = count > 99 ? "99+" : String(count);
    const r = label.length > 2 ? 22 : 19;
    const cx = size - r - 1;
    const cy = r + 1;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${label.length > 2 ? 22 : 28}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, cy + 1);
  }

  try {
    iconLink().href = canvas.toDataURL("image/png");
  } catch {
    /* tainted canvas — keep the static icon */
  }
}

function paintTitle(count: number) {
  if (baseTitle === null) baseTitle = document.title.replace(/^\(\d+\+?\)\s*/, "");
  const clean = document.title.replace(/^\(\d+\+?\)\s*/, "");
  if (clean) baseTitle = clean;
  document.title = count > 0 ? `(${count > 99 ? "99+" : count}) ${baseTitle}` : baseTitle;
}

/** Reflect the unread total on the app icon, the tab icon and the tab title. */
export function updateAppBadge(count: number): void {
  if (typeof window === "undefined") return;
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  setOsBadge(safe);
  paintTitle(safe);
  if (safe === lastPainted) return;
  lastPainted = safe;
  void paintFavicon(safe);
}

/** Drop every badge (sign-out, or once everything is read). */
export function clearAppBadge(): void {
  updateAppBadge(0);
}
