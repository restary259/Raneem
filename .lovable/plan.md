

# Visual Polish for Influencer Payouts Tab

Align the InfluencerPayoutsTab with the established admin UI polish standards: left-accent KPI cards, standardized badge pills with leading dot indicators, alternating table row colors, rounded card corners, illustrated empty state, and proper mobile responsiveness.

---

## Changes (Single File)

**File: `src/components/admin/InfluencerPayoutsTab.tsx`**

### 1. Summary Cards -- Match SparklineCard Pattern
- Add `border-s-[3px]` left accent borders with distinct colors per card (amber for pending, blue for due, red for overdue, emerald for paid)
- Use `font-extrabold text-2xl lg:text-3xl` for stat values (matching SparklineCard)
- Add colored icon containers (`p-2.5 rounded-xl bg-X-500 shadow-sm`) instead of inline icons
- Add `hover:shadow-md transition-shadow duration-200` on each card

### 2. Filter Bar -- Pill-Style Buttons
- Replace plain `outline` variant buttons with rounded-full pill shapes (`rounded-full`)
- Add count badges inside filter buttons showing how many rows match each filter (e.g. "Ready (3)")
- Add subtle `gap-1.5` and icon-sized colored dots before filter labels for visual consistency

### 3. Table -- Alternating Rows and Rounded Container
- Add `rounded-xl overflow-hidden` on the outer Card
- Add alternating row colors: `even:bg-muted/20` on TableRow
- Add `whitespace-nowrap` on header cells to prevent mid-word breaking
- Make the chevron toggle column narrower and add a subtle rotation animation

### 4. Status Badges -- Standardized Dot-Style Pills
- Replace emoji-based badges (emoji icons like lock, checkmark, circle, money bag) with clean dot-indicator pills:
  - Countdown: small amber dot + text
  - Ready: small emerald dot + text
  - Overdue: small red dot + text  
  - Paid: small blue dot + text
- Same pattern for the per-influencer status badges (green/yellow/red)

### 5. Expanded Detail Row
- Add a subtle left border accent (`border-s-2 border-primary/30`) on the expanded section
- Use slightly smaller text (`text-sm`) in the nested table
- Add `rounded-lg` on the inner container background

### 6. Empty State -- Illustrated Style
- Enlarge the empty icon to `h-16 w-16`
- Add a subtitle line below the message
- Use `opacity-30` for the illustration and `text-base` for the message

### 7. Mobile Responsiveness
- On mobile (`useIsMobile`), switch the main table to a card-based vertical layout showing each influencer as a stacked card with key stats
- Summary cards: ensure `grid-cols-2` on mobile with compact padding
- Filter bar: horizontal scroll with `overflow-x-auto flex-nowrap`

---

## Technical Details

- Only one file modified: `src/components/admin/InfluencerPayoutsTab.tsx`
- Import `useIsMobile` from `@/hooks/use-mobile`
- Import `Progress` from `@/components/ui/progress` for visual countdown bars (optional micro-enhancement)
- No logic changes -- all business logic (countdown calculation, filtering, sorting, aggregation) remains identical
- No new dependencies

