
# Plan: Role-Based Dashboard System (Admin, Influencer, Student)

## Overview

Build a comprehensive, high-end dashboard system with three role-based views: Admin (full control), Influencer (view-only), and Student (checklist tracker). This involves database schema changes, new edge functions, role-based routing, and a completely redesigned UI with a premium aesthetic.

---

## Phase 1: Database Schema Changes

### 1a. Add 'influencer' to `app_role` enum

```sql
ALTER TYPE public.app_role ADD VALUE 'influencer';
```

### 1b. Add columns to `profiles` table

```sql
ALTER TABLE public.profiles
  ADD COLUMN student_status text NOT NULL DEFAULT 'eligible',
  ADD COLUMN influencer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
```

Student status values: `eligible`, `ineligible`, `converted`, `paid`, `nurtured`

### 1c. Create `checklist_items` table (admin-defined required items)

```sql
CREATE TABLE public.checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  description text,
  is_required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
```

RLS: Admins can CRUD, authenticated users can SELECT.

### 1d. Create `student_checklist` table (per-student completion tracking)

```sql
CREATE TABLE public.student_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checklist_item_id uuid NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, checklist_item_id)
);
ALTER TABLE public.student_checklist ENABLE ROW LEVEL SECURITY;
```

RLS: Students can read/update own rows. Admins can read all. Influencers can read rows where student's `influencer_id` matches their user ID.

### 1e. Create `influencer_invites` table

```sql
CREATE TABLE public.influencer_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL,
  created_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.influencer_invites ENABLE ROW LEVEL SECURITY;
```

RLS: Admins only.

### 1f. Seed default checklist items

```sql
INSERT INTO public.checklist_items (item_name, description, sort_order) VALUES
  ('جواز السفر', 'نسخة سارية المفعول من جواز السفر', 1),
  ('الشهادات الأكاديمية', 'شهادة الثانوية / البجروت مع كشف الدرجات', 2),
  ('الترجمات المعتمدة', 'ترجمة معتمدة للشهادات والمستندات', 3),
  ('شهادة اللغة', 'شهادة لغة ألمانية أو إنجليزية', 4),
  ('الحساب البنكي المغلق', 'Blocked Account أو كفالة مالية', 5),
  ('التأمين الصحي', 'تأمين صحي ساري المفعول', 6),
  ('صور شخصية', 'صور بحجم جواز السفر', 7),
  ('خطاب القبول الجامعي', 'Zulassungsbescheid أو شرط القبول', 8);
```

---

## Phase 2: Edge Function for Influencer Account Creation

### Create `supabase/functions/create-influencer/index.ts`

Admin-only edge function that:
1. Verifies caller is admin (using `has_role`)
2. Creates a new auth user with the provided email and a generated password
3. Inserts a `user_roles` row with role = `influencer`
4. Creates a `profiles` row for the influencer
5. Updates the `influencer_invites` table status to `accepted`
6. Returns the created account details (admin can share credentials manually or via email)

Note: Since Lovable Cloud email is auth-only, the admin will receive the generated password in the response and share it with the influencer manually.

---

## Phase 3: Role-Based Routing

### Modify `src/pages/StudentAuthPage.tsx`

After successful login, check the user's role:
1. Query `user_roles` for the logged-in user
2. If role = `admin` -> redirect to `/admin`
3. If role = `influencer` -> redirect to `/influencer-dashboard`
4. Otherwise -> redirect to `/student-dashboard`

### Add new route in `src/App.tsx`

```tsx
<Route path="/influencer-dashboard" element={<InfluencerDashboardPage />} />
```

---

## Phase 4: Redesigned Admin Dashboard (High-End UI)

### New file structure under `src/components/admin/`

```
src/components/admin/
  AdminLayout.tsx          -- Glass-morphism sidebar + header layout
  AdminOverview.tsx        -- Stats cards with gradients and charts
  StudentManagement.tsx    -- Full CRUD table with status, checklist progress, influencer assignment
  InfluencerManagement.tsx -- Influencer table + invite modal
  ChecklistManagement.tsx  -- Define/edit checklist items
  ContactsManager.tsx      -- Contact submissions (migrated from current)
  SecurityPanel.tsx         -- Login attempts + alerts (migrated from current)
  AuditLog.tsx              -- Audit trail (migrated from current)
```

### Redesign `src/pages/AdminDashboardPage.tsx`

Replace the current monolithic 379-line file with a clean layout using:
- Dark navy sidebar with gradient accents (matching Darb brand)
- Stat cards with subtle gradients and animated counters
- Professional data tables using the existing `Table` UI component
- Color-coded status badges
- Inline editing for student status and influencer assignment
- Checklist progress bars (visual percentage)
- Search, filter by status/influencer/checklist completion
- CSV/Excel export buttons
- Invite influencer modal (creates account via edge function)

### Key Admin Features

**Student Management Table:**
| Column | Details |
|--------|---------|
| Name | Editable inline |
| Email | Read-only |
| Student Status | Dropdown: Eligible/Ineligible/Converted/Paid/Nurtured |
| Checklist Progress | Visual progress bar (e.g., 5/8 = 62%) |
| Influencer | Dropdown to assign (hidden from student/influencer) |
| Actions | Edit, view details |

**Influencer Management:**
- Table: Name, Email, Number of assigned students
- "Invite Influencer" button -> modal with name + email -> calls edge function
- Track invite status (Pending/Active)

**Checklist Management:**
- Add/edit/remove required checklist items
- Drag-reorder (or sort_order field)
- Items auto-sync to all student checklists

---

## Phase 5: Redesigned Student Dashboard

### Update `src/pages/StudentDashboardPage.tsx` and components

Premium design with:
- Welcome banner with student name and progress ring
- Checklist tracker as the primary view (card-based with checkboxes)
- Each checklist item shows: item name, description, status (completed/pending), completion date
- Students can toggle completion status
- Overall progress percentage with animated circular progress
- Existing features retained: profile, documents, services, payments
- Mobile-first responsive layout with smooth transitions

### New sidebar tab: "Checklist" (primary tab)

---

## Phase 6: Influencer Dashboard (New Page)

### Create `src/pages/InfluencerDashboardPage.tsx`

Structure:
1. Auth guard: verify session + role = `influencer`
2. Premium header with influencer name + stats
3. Stats cards: Total Referred, Total Converted, % Checklist Complete
4. Read-only student table showing only students assigned to this influencer:
   - Name, Email, Student Status, Checklist Progress
   - No edit capabilities
5. Mobile-responsive card layout on small screens

### Components under `src/components/influencer/`

```
src/components/influencer/
  InfluencerLayout.tsx
  InfluencerStats.tsx
  InfluencerStudentTable.tsx
```

---

## Phase 7: RLS Policies

### `checklist_items`

- SELECT: All authenticated users
- INSERT/UPDATE/DELETE: Admins only

### `student_checklist`

- SELECT: Own rows (student_id = auth.uid()) OR admin OR influencer where student's influencer_id = auth.uid()
- INSERT: Own rows (student_id = auth.uid()) OR admin
- UPDATE: Own rows OR admin
- DELETE: Admin only

### `influencer_invites`

- ALL: Admin only

### Updated `profiles` policies

- Influencers can SELECT profiles where `influencer_id = auth.uid()` (to see their assigned students)

---

## Phase 8: UI/UX Design Language

All three dashboards will share a consistent premium aesthetic:

- **Color palette**: Navy blue (`#1e3a5f`) sidebar, white content area, orange/amber accents for CTAs, subtle gray borders
- **Cards**: White with subtle shadow (`shadow-lg`), rounded-xl corners, hover elevation transitions
- **Typography**: Bold headings, muted descriptions, proper hierarchy
- **Tables**: Alternating row backgrounds, hover states, sticky headers
- **Status badges**: Color-coded (green=completed/paid, amber=pending/eligible, red=ineligible/rejected, blue=converted, purple=nurtured)
- **Progress indicators**: Circular progress rings for checklists, linear progress bars in tables
- **Animations**: Fade-in on load, smooth tab transitions, counter animations for stats
- **Mobile**: Cards collapse into stacked layout, tables become scrollable or card-based
- **RTL support**: Full RTL layout using `useDirection()` hook

---

## Technical Summary

### Database Changes (Migration)

| Change | Type |
|--------|------|
| Add `influencer` to `app_role` enum | ALTER TYPE |
| Add `student_status` and `influencer_id` to `profiles` | ALTER TABLE |
| Create `checklist_items` table + RLS | CREATE TABLE |
| Create `student_checklist` table + RLS | CREATE TABLE |
| Create `influencer_invites` table + RLS | CREATE TABLE |
| Seed default checklist items | INSERT |
| Add influencer SELECT policy on `profiles` | CREATE POLICY |
| Add influencer SELECT policy on `student_checklist` | CREATE POLICY |

### New Edge Function

| Function | Purpose |
|----------|---------|
| `create-influencer` | Admin creates influencer account (auth user + role + profile) |

### New Files (~15)

| File | Purpose |
|------|---------|
| `src/pages/InfluencerDashboardPage.tsx` | Influencer dashboard page |
| `src/components/admin/AdminLayout.tsx` | Shared admin layout with sidebar |
| `src/components/admin/AdminOverview.tsx` | Stats and overview |
| `src/components/admin/StudentManagement.tsx` | Student CRUD table |
| `src/components/admin/InfluencerManagement.tsx` | Influencer table + invites |
| `src/components/admin/ChecklistManagement.tsx` | Checklist item management |
| `src/components/admin/ContactsManager.tsx` | Contact submissions |
| `src/components/admin/SecurityPanel.tsx` | Security monitoring |
| `src/components/admin/AuditLog.tsx` | Audit trail |
| `src/components/influencer/InfluencerLayout.tsx` | Influencer dashboard layout |
| `src/components/influencer/InfluencerStats.tsx` | Influencer stats cards |
| `src/components/influencer/InfluencerStudentTable.tsx` | Read-only student table |
| `src/components/dashboard/ChecklistTracker.tsx` | Student checklist component |
| `supabase/functions/create-influencer/index.ts` | Edge function |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/AdminDashboardPage.tsx` | Complete redesign using new admin components |
| `src/pages/StudentDashboardPage.tsx` | Add checklist tab, redesign UI |
| `src/pages/StudentAuthPage.tsx` | Role-based redirect after login |
| `src/App.tsx` | Add `/influencer-dashboard` route |
| `src/components/dashboard/DashboardSidebar.tsx` | Add checklist tab, premium styling |
| `src/components/dashboard/DashboardMainContent.tsx` | Add checklist case |
| `src/components/dashboard/DashboardHeader.tsx` | Premium styling |
| `src/types/profile.ts` | Add `student_status` and `influencer_id` fields |

### What Will NOT Change

- Website design, navigation, logo, or public pages
- Existing authentication flow (email/password)
- PWA functionality
- Bilingual support structure
- Security architecture (auth-guard, admin-verify edge functions)
- Existing data in profiles, documents, services, payments tables
