
## Diagnosis: "Average Days Per Stage" Chart

### Is the chart technically rendering?
**Yes, it renders** — but it is **completely useless** because all bars show `0` days (or near-zero fractions).

### Why it shows 0 for everything:

**Root cause: All cases are only hours old.**

The DB query confirms:
- All 4 cases were created on **2026-03-08** (today)
- `last_activity_at - created_at` = minutes to hours at most (max 0.01 days = ~15 minutes)
- After `Math.round()`, every single value rounds to **0**

So the chart renders fine but displays `0` bars for every stage — it looks broken but is actually calculating correctly on toy/demo data.

**Secondary issue: The calculation measures the WRONG thing.**

The current formula:
```js
diff = last_activity_at - created_at  // time since case was CREATED
```

This measures "how long the case has existed in its current status" for cases **still in that status** — which is meaningless for real pipeline analysis.

What it SHOULD measure: **how long cases spent in each stage before advancing**, which requires a `stage_history` or `status_changed_at` audit trail. That data doesn't exist in the DB schema right now.

**The correct approximation (without a full audit trail)** is to measure the gap between `status_changed_at` and `now()` for active cases, or compare `last_activity_at` vs expected SLA thresholds. The current approach using `created_at` as the baseline is wrong for cases that have been in multiple statuses.

### What to fix

**Fix 1 — Use `updated_at` (when status last changed) minus `created_at` as a proxy**
This is still imperfect but better — `updated_at` reflects the last time the row was modified (which coincides with status transitions).

**Fix 2 — Add a `minPointSize` guard and a "no meaningful data" empty state**
When all values are 0 (all data is < 1 day old), show a placeholder message instead of a flat bar chart.

**Fix 3 — Correct the label from "Average Days Per Stage" to "Avg. Days In Current Stage"**
This is accurate to what the chart actually shows (time spent so far in current status).

**Fix 4 — Add decimal precision for fresh data**
Instead of `Math.round()` (which zeroes out everything < 0.5 days), use `Math.round(avg * 10) / 10` to show 1 decimal place, and for sub-day values show hours instead.

### Files to change: 1 file

| File | Change |
|------|---------|
| `src/pages/admin/AdminAnalyticsPage.tsx` | Fix avgDays calculation to use `updated_at` as stage-change proxy; show 1-decimal precision; add empty-state guard when all values are 0; use hours for sub-day values |

### Implementation

```tsx
// Fix avgDays calculation
const avgDays = STATUSES.slice(0, 7).map(s => {
  const group = cases.filter(c => c.status === s);
  if (group.length === 0) return { name: statusLabels[s], avg: 0, hours: 0 };
  
  const avgMs = group.reduce((sum, c) => {
    // Use last_activity_at as "entered current status at" proxy
    const base = new Date(c.last_activity_at).getTime();
    const now = Date.now();
    return sum + Math.max(0, now - base);
  }, 0) / group.length;
  
  const days = avgMs / 86400000;
  return { 
    name: statusLabels[s], 
    avg: Math.round(days * 10) / 10,  // 1 decimal
    hours: Math.round(avgMs / 3600000) // for tooltip
  };
});

const allZero = avgDays.every(d => d.avg === 0);
```

And in the JSX, add the empty state:
```tsx
{allZero ? (
  <div className="h-[260px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
    <Clock className="h-8 w-8 opacity-30" />
    <p className="text-sm">Not enough time has passed to calculate stage durations</p>
    <p className="text-xs opacity-70">This chart populates as cases progress through the pipeline over days</p>
  </div>
) : (
  <ResponsiveContainer ...>
    ...
  </ResponsiveContainer>
)}
```

The tooltip also changes to show hours when < 1 day:
```tsx
formatter={(v, _, props) => {
  const hours = props.payload?.hours;
  if (v < 1 && hours) return [`${hours}h`, ''];
  return [`${v} ${t('admin.analytics.tooltipDays')}`, ''];
}}
```

No DB migration, no new tables, no other files changed.
