

# Broadcast Translation, Housing Removal, and Contact Us Glow Effect

## 1. Translate Broadcast Page Content

The broadcast video data in `src/components/broadcast/data.ts` is currently hardcoded in Arabic only. Each video's `title`, `description`, `category`, and `country` fields need bilingual support.

**Approach**: Add English fields (`title_en`, `description_en`) to each video object in `data.ts`, then create a helper hook/function that picks the right field based on `i18n.language`. Update all consuming components (`HeroVideo`, `BroadcastVideoCard`, `VideoCategories`, `BroadcastPage`) to use the translated text.

**Files to change**:
- `src/components/broadcast/data.ts` -- add `title_en`, `description_en`, `country_en` fields to every video entry
- `src/components/broadcast/HeroVideo.tsx` -- use language-aware title/description
- `src/components/broadcast/BroadcastVideoCard.tsx` -- use language-aware title/description
- `src/pages/BroadcastPage.tsx` -- no structural change needed (already uses i18n for UI labels)

## 2. Hide Student Housing Tab

Remove the housing link from all navigation menus:

**Files to change**:
- `src/components/landing/DesktopNav.tsx` -- remove the housing entry from `moreComponents` array
- `src/components/landing/MobileNav.tsx` -- remove the housing `<Link>` inside the collapsible "More" section

## 3. Contact Us Button Glow Animation

Add an attention-grabbing pulse glow effect to the "Contact Us" link in the desktop and mobile navigation. The effect will be a subtle orange glow that pulses every few seconds using a CSS keyframe animation.

**Files to change**:
- `src/components/landing/DesktopNav.tsx` -- add a special class to the Contact Us `NavigationMenuLink`
- `src/components/landing/MobileNav.tsx` -- add the same glow class to the Contact Us mobile link
- `src/styles/navigation.css` -- add the `@keyframes contact-glow` animation and `.contact-glow` class with:
  - A repeating orange box-shadow pulse every 3 seconds
  - Rounded pill shape with orange background tint
  - Subtle scale bump at peak glow

---

## Technical Details

### Broadcast Data Bilingual Schema

Each `BroadcastPost` will gain optional English fields:

```typescript
export interface BroadcastPost {
  // ...existing fields
  title_en?: string;
  description_en?: string;
  country_en?: string;
}
```

Components will use a pattern like:

```typescript
const title = i18n.language === 'en' && post.title_en ? post.title_en : post.title;
```

### Glow Animation CSS

```css
@keyframes contact-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
  50% { box-shadow: 0 0 12px 4px rgba(249, 115, 22, 0.4); }
}

.contact-glow {
  animation: contact-glow 3s ease-in-out infinite;
  border-radius: 9999px;
  padding: 0.375rem 1rem;
  background: rgba(249, 115, 22, 0.08);
}
```

### Navigation Changes

The housing entry will simply be removed from `moreComponents` in `DesktopNav.tsx` (line with `/housing` href) and the corresponding `<Link to="/housing">` block in `MobileNav.tsx`. The route itself stays intact in case it's needed later -- only the navigation links are hidden.

