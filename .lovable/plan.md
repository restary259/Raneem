
## Problem — Header Layout

From the screenshot: on 390px the header is one `flex-wrap` row with 3 items:
1. `[← back button]` — shrink-0, ~36px
2. `[name block]` — flex-1, min-w-0 but only gets ~170px because...
3. `[badge + delete group]` — shrink-0, takes ~175px for "appointment scheduled" badge + red delete button

So the name only gets ~170px → `truncate` fires immediately → `A...`

Additionally the phone number and clock/timestamp row also compete for width.

**Fix** — Break the header into 3 explicit stacked rows:

```text
Row 1: [← back]  [Full Student Name — no truncation pressure]
Row 2: [📞 phone]  [copy]  ·  [🕐]  [time ago]
Row 3: [status badge]  [account badge]          [delete btn →]
```

This way:
- Name gets the full width minus ~36px back button → no truncation on even 320px
- Badges and delete button sit on their own row with `flex justify-between` or `flex-wrap`
- Phone/clock row wraps independently

### File to change
`src/pages/team/CaseDetailPage.tsx` — lines 691–731 only

### Precise change

Replace the current header `div` (lines 691–731) with:

```tsx
{/* ── Header ── */}
<div className="space-y-2" dir="ltr">
  {/* Row 1: back + name */}
  <div className="flex items-center gap-2 min-w-0">
    <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="shrink-0 -ms-2">
      <ArrowLeft className="h-4 w-4" />
    </Button>
    <h1 className="text-xl sm:text-2xl font-bold truncate min-w-0 flex-1">{caseData.full_name}</h1>
  </div>

  {/* Row 2: phone + timestamp */}
  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap ps-1">
    <a href={`tel:${caseData.phone_number}`}
       className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors font-medium text-xs shrink-0">
      <Phone className="h-3 w-3" />
      {caseData.phone_number}
    </a>
    <CopyButton value={caseData.phone_number} />
    <span className="text-muted-foreground/40">·</span>
    <Clock className="h-3 w-3 shrink-0" />
    <span dir="ltr" className="inline-block whitespace-nowrap text-xs">
      {formatDistanceToNow(new Date(caseData.last_activity_at), { addSuffix: true })}
    </span>
  </div>

  {/* Row 3: status badges + delete */}
  <div className="flex items-center gap-2 flex-wrap justify-between ps-1">
    <div className="flex items-center gap-2 flex-wrap">
      <Badge className={STATUS_COLORS[caseData.status] ?? "bg-muted"}>
        {caseData.status.replace(/_/g, " ")}
      </Badge>
      {caseData.student_user_id && (
        <Badge variant="secondary" className="gap-1 text-xs">
          <User className="h-3 w-3" />
          {t("case.detail.accountActive")}
        </Badge>
      )}
    </div>
    {!isTerminal && (
      <Button size="sm" variant="outline"
        className="gap-1 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground shrink-0"
        onClick={() => setShowDeleteCase(true)}>
        <Trash2 className="h-4 w-4" />
        <span className="hidden sm:inline">{t("case.detail.deleteCase")}</span>
      </Button>
    )}
  </div>
</div>
```

**Key changes from current code:**
- `flex-wrap` single row → `space-y-2` vertical stack (3 rows)
- Name `text-2xl` → `text-xl sm:text-2xl` (slightly smaller on mobile, still clear)
- Delete button now on its own row with `justify-between`, so it sits at the far end of the badge row without fighting for name space
- `dir="ltr"` stays on the outer wrapper to keep arrow pointing correctly
- No layout fight between name and badge group anymore
