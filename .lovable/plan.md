# Navigation bar audit and restructure (desktop and mobile)

## What a first-time visitor sees today
Desktop, from the start of the bar: **الدراسة في ألمانيا ▾ · اكتشف مسارك الدراسي ▾ · خدماتنا · موارد ▾ · عن درب ▾ · تواصل معنا**, plus one button: **تسجيل الدخول للطلاب**. The phone menu shows the same six groups stacked, followed by WhatsApp, email and student login.

## Audit by visitor type

**Student (the main visitor), not a good fit**
- There is **no "Apply" button anywhere in the bar**. The site's main goal is hidden. The only prominent button is "Student login", which is for people who are already students.
- "الدراسة في ألمانيا" and "اكتشف مسارك الدراسي" overlap. Both answer the same question: *what and where should I study?* Majors sit in one group and the major quiz in the other.
- "موارد" mixes four unrelated things: a general resources page, FAQ, the live broadcast and the blog. That's fine for returning visitors, but it gives new visitors too many choices.
- Six top-level groups plus dropdowns is heavy for a mobile visitor who arrives from a campaign and wants to ask or apply.

**Lawyer / partner (وكيل), poor fit**
- The partnership program is hidden as the 3rd item under "عن درب". A lawyer looking for how to work with DARB won't guess it's there.
- There is no sign-in for partners or agents. The only sign-in button is labeled "for students", which suggests partners have no account.

**Agent, poor fit**
- There is nothing for agents at all. They share the partnership page, but its entry point is hidden in the same way.

**What already works**
- Services and Contact are direct links (good).
- The phone menu offers WhatsApp and email directly (good for Arab 48 visitors).
- The menu works in Arabic, Hebrew and English, and in both reading directions.

## Proposed structure
```text
Desktop:  [Logo]  الدراسة في ألمانيا▾  خدماتنا  موارد▾  عن درب▾  تواصل معنا   [دخول الحساب]  [قدّم طلبك]
```
1. **Merge** "الدراسة في ألمانيا" and "اكتشف مسارك الدراسي" into one group, "الدراسة في ألمانيا": majors, the major quiz, the AI advisor, and educational destinations. This leaves one fewer top-level item.
2. **Replace the desktop bar's "تسجيل الدخول للطلاب" button with a "قدّم طلبك" apply button** (brand color, the main action) and a quiet "دخول الحساب" link next to it. The phone's bottom navigation stays unchanged.
3. **Rename every remaining login entry point** (phone menu, footer) from "تسجيل الدخول للطلاب" to "دخول الحساب" / "Account login" — one unified login for students, partners and agents.
4. **Keep "عن درب" exactly as it is** — no rename, no new partners item.
5. **Trim "موارد"** to FAQ, Blog and Broadcast. The general resources page stays reachable from within those pages.
6. The phone menu mirrors the same order. The WhatsApp and email buttons stay.

## Already true — no work needed
- The sign-in page (`/student-auth`) already signs in **all roles** and sends each to their own dashboard, so a unified login needs no new page — only the label changes.
- Mobile sign-in **already stays logged in** (the session is stored persistently on the device), so no change is needed there either.

## Technical notes
- Files: `src/components/landing/DesktopNav.tsx`, `MobileNav.tsx`, `Header.tsx` (desktop apply button + login label; phone bottom nav untouched); nav keys in `common.json` for en/ar/he (both `src` and `public` locale folders where present).
- No new pages and no backend changes. Verify with Playwright at 1353px and 390px in Arabic and English, checking the bar for overlap or wrapping.
