# Student onboarding ↔ dashboard visual consistency (UI-only)

## What I found

**The DARB student design system (source of truth)**
- Tokens live in `src/index.css` + `tailwind.config.ts`: `--primary` (near-black in light, near-white in dark), `--muted-foreground`, `--border`, `--card`, `--radius: 0.5rem`. `--brand` is the DARB orange used on the **public marketing site** and CTA highlights, not as the dashboard primary.
- Student dashboard pages (`StudentNextStepsPage`, `StudentContactsPage`, `StudentDataPage`, `StudentVisaPage`, `StudentFeesPage`) all follow one pattern: page wrapper `p-4 sm:p-6 max-w-3xl mx-auto space-y-6`, `h1` = `text-2xl font-bold`, subtitle = `text-sm text-muted-foreground`, content inside shadcn `Card`/`CardHeader`/`CardTitle text-base`, icons `h-4 w-4 text-primary`, actions via default/`outline` shadcn `Button` (default height, `rounded-md` from `--radius`), status via `Badge`.
- No monospace font, no arbitrary font sizes, no custom glow shadows, no `rounded-2xl` anywhere in the student dashboard.

**Where the onboarding wizard diverges** (`src/components/student/OnboardingShell.tsx`, `src/components/student/StudentOnboardingGate.tsx`)
1. Orange everywhere: step counter, journey stamps, progress fill, plane marker, section label, and the primary CTA all use `bg-brand` / `text-brand` — the only place in the student area that does.
2. Primary CTA is a bespoke button: `rounded-2xl bg-brand text-[14.5px] font-bold shadow-[0_8px_24px_-8px_hsl(var(--brand)/0.5)] hover:bg-brand-strong` instead of the shared `Button` default variant.
3. Typography off-system: `font-mono` step counter and section labels with `tracking-[0.12em]`, headline `text-[26px]/[28px]`, footer notes `text-[10.5px]`, description `text-[13.5px]` — none of these sizes exist in the dashboard.
4. Layout off-system: full-bleed `max-w-md` page with no `Card`; dashboard pages are `max-w-3xl` inside cards.
5. Control sizing off-system: inputs/selects forced to `h-12 text-base` and `h-11` on the contacts step, vs the shared `Input`/`SelectTrigger` defaults used elsewhere.
6. Radius/shadow drift: `rounded-xl` back button, `rounded-2xl` CTA, custom glow shadow.
7. Progress indicator is a hand-rolled dashed track + plane marker rather than the shared `Progress` component language.

No functional problems found in the wizard flow itself while reading it.

## What I'll change (UI only)

**`src/components/student/OnboardingShell.tsx`** — keep the UX concept (step counter, progress, section context, headline, explanation, focused field, footer CTA) but re-skin to the dashboard system:
- Wrap the step content in a shadcn `Card` on a `max-w-2xl` centered page with `p-4 sm:p-6`, matching dashboard rhythm; keep the sticky mobile footer behaviour.
- Replace all `brand` usages with `primary` / `muted-foreground` tokens.
- Step counter and section labels: drop `font-mono` and arbitrary tracking; use `text-xs font-medium text-muted-foreground` with the current step in `text-foreground`.
- Replace the dashed track + plane with the shared `Progress` component (same real percentage, same aria semantics), keeping the origin/destination stamps as small `Badge`-style circles in neutral tokens.
- Headline → `text-2xl font-bold text-foreground`, description → `text-sm text-muted-foreground`, matching every dashboard page `h1`/subtitle pair.
- Back button → shared `Button variant="ghost" size="icon"` defaults, standard radius.
- Keep RTL logical properties, `rtl:rotate-180` arrows, reduced-motion guard, and safe-area padding exactly as they are.

**`src/components/student/StudentOnboardingGate.tsx`** (presentation only — no changes to `TASKS`, `ProfileShape`, `SELECT_COLUMNS`, `isProfileComplete`, `stepComplete`, `taskErrorFor`, `load`, `persist`, `stepPatch`, `next`, `back`, `cleanedContacts`, school-select or contacts-preview logic):
- Primary CTA → default shadcn `Button` (no `bg-brand`, no `rounded-2xl`, no glow shadow, no arbitrary text size); keep the loading spinner, label logic and arrow.
- Back button in the footer → `Button variant="outline"` at default size.
- Remove `h-12 text-base` / `h-11 text-base` overrides so `Input` and `SelectTrigger` render at their shared defaults; keep the `border-destructive focus-visible:ring-destructive` error styling.
- Footer note sizes → `text-xs text-muted-foreground`.
- Emergency-contact group cards → shadcn `Card`/`CardContent` instead of the ad-hoc bordered div; the mislabelled `Label className="text-destructive"` on required fields becomes a normal label with a `text-destructive` asterisk (visual only).
- Contacts-preview rows → `text-xs` / `text-muted-foreground` with `text-primary` icons, matching `StudentContactsPage`.

**Design decision to confirm as you review:** the wizard drops DARB orange entirely and uses the neutral `primary` accent, because that is what every student dashboard page uses. Orange stays the marketing-site brand color.

## Out of scope
No changes to team/admin/partner dashboards, backend, migrations, RPCs, edge functions, auth, validation or data structures. No new design-system components; only existing shadcn primitives are reused.

## Verification
- `npm run build` (tsc + vite) clean.
- `npx vitest run` — onboarding tests (`StudentOnboardingGate.test.ts`) and the i18n parity guard must stay green; no new locale keys are introduced.
- Manual pass in the preview: wizard opens, Continue/Back/validation/save-resume work, English + Arabic RTL, 320px → desktop, contrast and focus rings intact.
