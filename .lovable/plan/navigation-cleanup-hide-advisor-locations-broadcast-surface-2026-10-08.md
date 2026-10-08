# Navigation cleanup: hide advisor, locations, broadcast; surface Resources

## What changes for visitors
1. **AI advisor page removed from the menus**: it is no longer listed in the top menu, the phone menu or the footer. The page itself still works, and the floating chat bubble plus the "ask the advisor" link on the Contact page stay.
2. **Resources page added to the menu**: the "موارد" menu gets a first item, "Resources & tools" (the CV builder, Bagrut calculator and currency converter), on desktop and on phones.
3. **"Our locations" page hidden**: it is removed from "عن درب" (desktop and phone). Visiting /locations takes you to the home page.
4. **DARB Broadcast page hidden**: it is removed from "موارد" (desktop and phone). Visiting /broadcast takes you to the home page.
5. All three pages are removed from the sitemap so Google stops listing them. Nothing is deleted, and each page can be turned back on later.

## Resulting menus
```text
الدراسة في ألمانيا ▾ : Heidelberg, Majors, Major quiz
خدماتنا
موارد ▾             : Resources & tools, FAQ, Blog
عن درب ▾            : About, Partnership
تواصل معنا
```

## Technical details
- `DesktopNav.tsx` and `MobileNav.tsx`: drop the /ai-advisor, /broadcast and /locations items, and add /resources (using `nav.resources` and a short description key) to the Resources group.
- `Footer.tsx`: remove the /ai-advisor link.
- `routes/locations.tsx` and `routes/broadcast.tsx`: add `beforeLoad: () => { throw redirect({ to: "/" }) }`. The page components and data stay untouched.
- `public/sitemap.xml`: remove the ai-advisor, broadcast and locations entries.
- The LocalBusiness data in `__root.tsx` still references the `/locations` URL. Switch it to the home URL.
- Add the new description key in en/ar/he `common.json` if it is missing.
- Verify with Playwright at 1377px and 390px, in Arabic and English.
