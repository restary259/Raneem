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
Desktop:  [Logo]  الدراسة في ألمانيا▾  خدماتنا  موارد▾  عن درب▾  تواصل معنا   [دخول]  [قدّم طلبك]
```
1. **Merge** "الدراسة في ألمانيا" and "اكتشف مسارك الدراسي" into one group, "الدراسة في ألمانيا": majors, the major quiz, the AI advisor, and educational destinations. This leaves one fewer top-level item.
2. **Add a primary "قدّم طلبك" button** in brand color as the main action, on both desktop and phone. On the phone it sits in the bar itself, next to the menu icon.
3. **Turn the login button into a neutral "تسجيل الدخول"** (outline style) for all account types. The sign-in page already serves all roles.
4. **Make partnership visible:** rename "عن درب" to "عن درب والشراكة", or add a clear "للشركاء والوكلاء" item. On the phone, add a short "Are you a lawyer or agent? Partner with DARB" link at the bottom.
5. **Trim "موارد"** to FAQ, Blog and Broadcast. The general resources page stays reachable from within those pages.
6. The phone menu mirrors the same order. The WhatsApp and email buttons stay.

## Questions before building
- Option 4: a separate top-level item "للشركاء", or keep it inside "عن درب" but rename that group?
- Should the sign-in page actually work for partners and agents? It should if they use the same sign-in page, but that needs checking before the label changes.

## Technical notes
- Files: `src/components/landing/DesktopNav.tsx`, `MobileNav.tsx`, `Header.tsx`; nav keys in `common.json` for en/ar/he (both `src` and `public` locale folders where present).
- No new pages and no backend changes. Verify with Playwright at 1353px and 390px in Arabic and English, checking the bar for overlap or wrapping.
