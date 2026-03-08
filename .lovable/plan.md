
## Problem — Case Card Layout on Mobile

From the screenshot, the `Ahmad Khalil` card shows three items competing for horizontal space in a **single flex row**:

```text
[name / phone / time]  ←→  [badge]
```

The badge (`تم التقديم`) is `shrink-0` and wide in Arabic (~90px), eating into the left block. The left block has **no `min-w-0`**, so the phone number and timestamp overflow onto separate lines instead of the container growing cleanly.

**Root cause — lines 227–238 in `src/pages/team/TeamCasesPage.tsx`:**

```tsx
<CardContent className="p-4 flex items-center justify-between">
  <div>                                    {/* ← no min-w-0! */}
    <div className="font-medium">{c.full_name}</div>
    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
      <Phone />{c.phone_number}
      <span>·</span>
      <span dir="ltr" className="inline-block">   {/* ← no whitespace-nowrap! */}
        {formatDistanceToNow(...)}
      </span>
    </div>
  </div>
  <Badge ...>{statusLabel(c.status)}</Badge>   {/* badge on same row, no shrink-0 */}
</CardContent>
```

## Fix

Restructure the card to use a **2-row stacked layout** so the badge never competes with the name/phone/time content:

```text
Row 1: [name (bold)]                    [badge — right-aligned]
Row 2: [📞 phone number]  ·  [time ago]
```

**Changes to `src/pages/team/TeamCasesPage.tsx` — lines 227–238 only:**

```tsx
<CardContent className="p-4">
  {/* Row 1: name + badge */}
  <div className="flex items-start justify-between gap-2 min-w-0">
    <span className="font-semibold text-sm leading-snug truncate min-w-0 flex-1">
      {c.full_name}
    </span>
    <Badge className={`shrink-0 text-xs ${STATUS_COLORS[c.status] ?? '...'}`}>
      {statusLabel(c.status)}
    </Badge>
  </div>

  {/* Row 2: phone + timestamp */}
  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 flex-wrap">
    <Phone className="h-3 w-3 shrink-0" />
    <span className="shrink-0">{c.phone_number}</span>
    <span className="text-muted-foreground/40 shrink-0">·</span>
    <span dir="ltr" className="inline-block whitespace-nowrap">
      {formatDistanceToNow(new Date(c.last_activity_at), { addSuffix: true })}
    </span>
  </div>
</CardContent>
```

**Key changes:**
- Badge moves to Row 1 alongside the name with `items-start justify-between` — no more competing with phone/time
- Left name block gets `flex-1 min-w-0 truncate` to handle long Arabic names
- Phone + timestamp row is `flex-wrap` with all items `shrink-0` + `whitespace-nowrap` on the timestamp
- `whitespace-nowrap` on `dir="ltr"` span prevents "about 1 hour / ago" split

**File:** `src/pages/team/TeamCasesPage.tsx` — single file, lines 227–238.
