

# Plan: Enhanced PWA + Dedicated AI Chat Page

## Overview
Enhance the existing PWA infrastructure and add a dedicated AI advisor page -- all without changing the current website design.

---

## Phase 1: Dedicated AI Chat Page (`/ai-advisor`)

**What**: A new full-page route for immersive AI conversations, reusing existing components and styling.

- Create `src/pages/AIAdvisorPage.tsx` -- full-screen chat interface using the same Header/Footer as other pages
- Reuse the existing `AIChatPopup` streaming logic but adapted for a full-page layout
- Add conversation history persistence using `localStorage` (no new DB table needed for MVP)
- Students can continue previous conversations and see past messages
- Quick-question cards, topic categories (Admissions, Visa, Language, Life in Germany)
- Add route `/ai-advisor` in `App.tsx`
- Add link in BottomNav (replace or add an "AI" tab) and in the desktop navigation

**Design rule**: Same fonts, colors (orange gradient), card styles, and RTL layout as the rest of the site.

---

## Phase 2: Enhanced Service Worker & Caching

**What**: Upgrade `public/service-worker.js` for better offline support.

- **Versioned cache**: Bump to `v2.0.0` with smarter cache invalidation
- **AI conversation caching**: Cache recent AI responses in a dedicated `darb-ai-cache` so students can read past conversations offline (read-only)
- **Document caching**: When a student views a document, cache it in a `darb-docs-cache` for offline access
- **Stale-while-revalidate** strategy for API responses (show cached data, update in background)
- **Font caching**: Explicitly cache Google Fonts for offline use
- Add `/ai-advisor` to `STATIC_CACHE_URLS`

---

## Phase 3: Offline AI Fallback

**What**: When offline, the AI chat shows cached FAQ answers and last conversation.

- In `AIChatPopup` and the new AI page, detect `navigator.onLine`
- If offline: load last conversation from localStorage, show a banner "You're offline - viewing saved conversations"
- Provide pre-cached FAQ answers for the 4 quick questions (stored as static JSON)
- When back online, auto-sync and resume normal streaming

---

## Phase 4: Push Notifications Foundation

**What**: Opt-in notification system for document reminders and deadline alerts.

- Create a notification preferences component (toggle in student dashboard settings)
- Use the existing `requestNotificationPermission()` from `pwaUtils.ts`
- Store subscription endpoint in a new `push_subscriptions` DB table
- Create an edge function `push-notify` to send notifications via Web Push API
- Notification triggers: document expiry (7 days before), visa deadline reminders

---

## Phase 5: PWA Install & Session Enhancements

**What**: Polish the install experience and session persistence.

- Improve `PWAInstaller.tsx`: Add iOS-specific install instructions modal (not just `alert()`)
- Ensure auth tokens persist across app restarts (already using Supabase session -- verify `persistSession: true`)
- Add `display: standalone` CSS adjustments (hide browser-specific UI elements)
- Update `manifest.json` to include the new `/ai-advisor` shortcut
- Cross-platform testing notes for iOS Safari PWA limitations

---

## Technical Details

### New Files
| File | Purpose |
|------|---------|
| `src/pages/AIAdvisorPage.tsx` | Full-page AI chat interface |
| `src/hooks/useAIChat.ts` | Shared hook for AI chat logic (streaming, history, offline) |
| `src/utils/chatCache.ts` | localStorage helpers for conversation persistence |

### Modified Files
| File | Change |
|------|--------|
| `src/App.tsx` | Add `/ai-advisor` route |
| `src/components/common/BottomNav.tsx` | Add AI advisor nav item |
| `src/components/chat/AIChatPopup.tsx` | Extract logic into shared hook, add offline fallback |
| `src/components/chat/ChatWidget.tsx` | Link to full page option |
| `src/components/common/PWAInstaller.tsx` | iOS install modal improvement |
| `public/service-worker.js` | Enhanced caching strategies |
| `public/manifest.json` | Add AI advisor shortcut |

### Database Migration
- New table `push_subscriptions` (user_id, endpoint, p256dh, auth_key, created_at) with RLS policies
- Edge function `push-notify` for sending web push notifications

### No Design Changes
All new UI uses existing Tailwind classes, orange/amber gradient theme, Tajawal font, and RTL direction. No new colors, fonts, or layout patterns introduced.

