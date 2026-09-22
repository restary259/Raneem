import darbLogoAsset from "@/assets/darb-logo.png.asset.json";

function LogoRouteFallback({ className }: { className: string }) {
  return (
    <div className={`grid place-items-center bg-background px-6 ${className}`} role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading</span>
      <img src={darbLogoAsset.url} alt="" width={182} height={64} className="h-auto w-44 animate-pulse object-contain motion-reduce:animate-none sm:w-52" />
    </div>
  );
}

/** Lightweight route placeholders that never import feature/page code. */
export function DashboardRouteFallback() {
  return <LogoRouteFallback className="min-h-screen" />;
}

export function PublicRouteFallback() {
  return <LogoRouteFallback className="min-h-[100svh]" />;
}