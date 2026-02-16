

# Google Calendar-Style Appointments + Clean Mobile Nav

## Overview

Two changes to the Team Dashboard:
1. Redesign the Appointment Calendar to match Google Calendar's day view layout (hourly time grid, mini calendar sidebar, current time indicator)
2. Restyle the mobile bottom navigation to match the app's clean white/orange design instead of the current dark navy bar

---

## Change 1: Google Calendar-Style Appointment View

### Current State
The appointment tab shows a basic month grid with dots for appointments, and a list of appointments below. No hourly timeline view.

### New Design
A split layout inspired by Google Calendar:
- **Left panel** (desktop): Mini month calendar for date picking + upcoming appointments list
- **Right panel / main area**: Full day view with hourly time slots (1 AM - 11 PM), a red "current time" indicator line, and appointment blocks positioned at their scheduled times
- **Header**: "Today" button, prev/next navigation arrows, selected date display, and Day/Week toggle (Day active, Week as future placeholder)
- **Appointment blocks**: Colored cards spanning their duration on the time grid, showing student name, time, and location
- **"+ Create" button**: Floating action button to add new appointments

### Technical Approach
- Rewrite `src/components/lawyer/AppointmentCalendar.tsx` completely
- Keep existing data fetching and CRUD logic (Supabase queries unchanged)
- Add hourly grid rendering with `eachHourOfInterval` from date-fns
- Position appointments absolutely within the time grid based on their `scheduled_at` time and `duration_minutes`
- Red current-time line positioned based on current hour/minute with a pulsing dot
- Mini calendar stays as the existing month grid but smaller, in the sidebar
- Responsive: on mobile, mini calendar collapses above the day view

---

## Change 2: Clean Mobile Bottom Navigation

### Current State (lines 483-498 of TeamDashboardPage)
```
bg-[#1E293B] border-t border-white/10
```
Dark navy bar with white/muted text -- feels heavy and inconsistent with the app's light theme.

### New Design
Match the main app's BottomNav pattern:
```
bg-white border-t border-gray-200
```
- White background with subtle gray border
- Orange active state (text-orange-500) with gray inactive (text-gray-600)
- Same rounded, touch-friendly layout as the public BottomNav
- Safe area padding for iOS devices

---

## Files to Modify

### `src/components/lawyer/AppointmentCalendar.tsx` -- Full Rewrite
- Google Calendar day view with hourly time grid
- Mini calendar sidebar (reuse existing month logic)
- Current time red line indicator
- Appointment blocks positioned on the grid
- "Today" button and date navigation header
- Create appointment dialog (keep existing)
- Delete appointment (keep existing)

### `src/pages/TeamDashboardPage.tsx` -- Minor Edit
- Update mobile bottom nav styling (lines 483-498): change from dark navy to white/orange theme
- Update the appointments tab section to give the calendar full width instead of `max-w-2xl`

---

## Technical Details

```text
Hourly Grid Calculation:
- Each hour slot = 60px height
- Appointment top position = (hour * 60) + (minute * 1) px
- Appointment height = duration_minutes * 1 px
- Current time line = same formula with current time
- Scroll container auto-scrolls to current hour on mount

Component Structure:
AppointmentCalendar
  +-- Header (Today btn, arrows, date, Day toggle)
  +-- Body (flex row)
  |   +-- Sidebar (mini month calendar + upcoming list)
  |   +-- DayView (scroll container)
  |       +-- TimeGutter (hour labels: 1 AM, 2 AM, ...)
  |       +-- TimeGrid (horizontal lines + appointment blocks)
  |       +-- CurrentTimeLine (red line + dot)
  +-- CreateDialog (existing modal, unchanged logic)
```

