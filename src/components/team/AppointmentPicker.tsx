{
  /* Day strip */
}
<div className="w-full max-w-full overflow-hidden">
  <div className="flex w-full max-w-full items-center gap-1">
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0"
      onClick={() => setRangeStart((d) => addDays(d, -DAY_WINDOW))}
      aria-label={t("lawyer.picker.previousDays", "Previous days")}
    >
      <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
    </Button>

    {/* Day viewport */}
    <div className="relative min-w-0 flex-1 overflow-hidden">
      {/* Scrollable day track */}
      <div
        className="flex max-w-full gap-1.5 overflow-x-auto pb-1"
        style={{
          scrollbarWidth: "thin",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {days.map((d) => {
          const active = isSameDay(d, selectedDay);
          const past = d < startOfDay(now);

          return (
            <button
              key={d.toISOString()}
              type="button"
              disabled={past}
              onClick={() => setSelectedDay(startOfDay(d))}
              className={cn(
                // CRITICAL: fixed width + no shrinking
                "box-border flex h-[68px] w-[60px] min-w-[60px] max-w-[60px] shrink-0 flex-none flex-col items-center justify-center rounded-xl border px-1.5 py-1.5",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted",
                past && "cursor-not-allowed opacity-40",
              )}
            >
              <span className="w-full truncate text-center text-[10px] uppercase tracking-wide">
                {d.toLocaleDateString(locale, {
                  weekday: "short",
                })}
              </span>

              <span className="text-lg font-semibold leading-tight">
                {d.toLocaleDateString("en-US", {
                  day: "numeric",
                })}
              </span>

              <span className="w-full truncate text-center text-[10px]">
                {d.toLocaleDateString(locale, {
                  month: "short",
                })}
              </span>
            </button>
          );
        })}
      </div>
    </div>

    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0"
      onClick={() => setRangeStart((d) => addDays(d, DAY_WINDOW))}
      aria-label={t("lawyer.picker.nextDays", "Next days")}
    >
      <ChevronRight className="h-4 w-4 rtl:rotate-180" />
    </Button>
  </div>
</div>;
