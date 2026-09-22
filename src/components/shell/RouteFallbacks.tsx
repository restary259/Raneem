/** Lightweight route placeholders that never import feature/page code. */
export function DashboardRouteFallback() {
  return (
    <div className="min-h-screen bg-background" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading</span>
      <div className="h-16 border-b border-border bg-background" />
      <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
        <div className="h-7 w-48 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-20 animate-pulse rounded-lg border border-border bg-muted/40 motion-reduce:animate-none" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg border border-border bg-muted/30 motion-reduce:animate-none" />
      </div>
    </div>
  );
}

export function PublicRouteFallback() {
  return (
    <div className="min-h-[100svh] bg-background" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading</span>
      <div className="h-20 border-b border-border bg-background/95" />
      <div className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-7xl flex-col justify-center gap-5 px-5 py-12">
        <div className="h-3 w-24 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
        <div className="h-10 w-full max-w-xl animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
        <div className="h-5 w-full max-w-md animate-pulse rounded-xl bg-muted/70 motion-reduce:animate-none" />
        <div className="mt-3 h-12 w-44 animate-pulse rounded-full bg-primary/15 motion-reduce:animate-none" />
      </div>
    </div>
  );
}