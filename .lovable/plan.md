

# Fix PWA Desktop Scroll + Mobile Sidebar Scrollability

## Issues Identified

1. **PWA Desktop Scroll**: The last diff already addressed the root cause (removed `touch-action: pan-y pinch-zoom` from html, added `overflow-y: auto`). However, the `#root` element in PWA mode now has `overflow-y: auto` which can create a competing scroll container. It should not restrict scroll propagation.

2. **Admin Mobile Sheet Sidebar**: The `SheetContent` uses `h-full` (from the sheet variant) but the inner layout (header + nav + footer) lacks a proper flex container to constrain the nav to available space. If the sidebar has many items, the footer gets pushed off-screen with no way to scroll to it.

3. **Student Dashboard Sidebar on Mobile**: The `DashboardSidebar` has no max-height or scroll container on mobile. With 7 tabs, on small screens the list overflows without scrolling.

4. **Admin main content area**: Uses `overflow-hidden` on the `<main>` tag (line 188 of AdminLayout), which prevents content scrolling inside the main area. Should be `overflow-auto`.

## Changes

### 1. `src/styles/pwa.css` — Fix #root scroll propagation

Remove `overflow-y: auto` from `#root` in standalone mode. The root should use `overflow: visible` (default) so scroll naturally propagates to `body` and `html`. This prevents the double-scroll-container trap that blocks mouse wheel in desktop PWA.

### 2. `src/components/admin/AdminLayout.tsx` — Fix mobile sheet + main overflow

- Make the SheetContent inner wrapper a flex column with `h-full` so header stays at top, footer at bottom, and nav scrolls in the middle.
- Change `<main>` from `overflow-hidden` to `overflow-auto` so content scrolls properly.

### 3. `src/components/dashboard/DashboardSidebar.tsx` — Add mobile scroll

- On mobile (below `lg`), add `max-h-[60vh] overflow-y-auto` to the nav container so the tab list is scrollable when it exceeds available space.
- On desktop, keep it as-is (sidebar is in a tall left column).

## Files to Modify

| File | Change |
|------|--------|
| `src/styles/pwa.css` | Remove `overflow-y: auto` from `#root` to prevent scroll trap |
| `src/components/admin/AdminLayout.tsx` | Wrap SheetContent children in flex column; change main `overflow-hidden` to `overflow-auto` |
| `src/components/dashboard/DashboardSidebar.tsx` | Add `max-h-[60vh] overflow-y-auto` on mobile for the nav list |

