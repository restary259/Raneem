

## Phase 4: Student Dashboard Overhaul

This phase fixes all hardcoded strings in MyApplicationTab, upgrades the progress tracker to the full 10-stage funnel, adds ref_code display, upcoming appointment details, and connects document status to the checklist.

---

### 4A. Fix MyApplicationTab i18n (Replace all `isAr` ternaries)

**Current problem**: `MyApplicationTab.tsx` uses `isAr ? 'Arabic' : 'English'` ternaries for ALL strings (~20 instances) instead of `t()` keys.

**Changes to `MyApplicationTab.tsx`**:
- Remove `const isAr = i18n.language === 'ar';` pattern
- Replace every ternary with `t()` calls using new keys under `application.*`

Strings to replace:
| Current pattern | New key |
|----------------|---------|
| `isAr ? 'جار التحميل...' : 'Loading...'` | `t('application.loading')` |
| `isAr ? 'لا يوجد ملف تقديم بعد' : 'No application found yet'` | `t('application.noApplication')` |
| `isAr ? 'سيظهر ملفك هنا بعد تسجيلك لدينا' : 'Your application will appear...'` | `t('application.noApplicationDesc')` |
| `isAr ? 'تقدم الطلب' : 'Application Progress'` | `t('application.progress')` |
| `isAr ? 'المدينة' : 'City'` | `t('application.city')` |
| `isAr ? 'المدرسة' : 'School'` | `t('application.school')` |
| `isAr ? 'السكن' : 'Accommodation'` | `t('application.accommodation')` |
| `isAr ? 'لم يُحدد' : 'Not set'` | `t('application.notSet')` |
| `isAr ? 'المدفوعات' : 'Payments'` | `t('application.payments')` |
| Payment type labels (service_fee, school_payment, translation) | `t('application.paymentTypes.service_fee')` etc. |
| `isAr ? 'مدفوع' : 'Paid'` / `isAr ? 'معلق' : 'Pending'` | `t('application.paid')` / `t('application.pending')` |
| CASE_STEPS labels | Use `t('application.steps.assigned')` etc. |

---

### 4B. Upgrade to 10-Stage Progress Bar

**Current state**: `CASE_STEPS` array has 8 stages with hardcoded Arabic/English labels.

**New approach**: Replace with the full 10-stage funnel aligned with the system:

```text
assigned -> contacted -> appointment -> paid -> ready_to_apply -> registration_submitted -> visa_stage -> settled -> completed
```

Remove `closed` (not a student-visible stage). The progress bar will show 9 student-facing stages.

Each step label comes from `t('application.steps.VALUE')` translation keys.

**Visual upgrade**: Replace the simple `<Progress>` bar with a timeline-style stepper:
- Horizontal on desktop, vertical on mobile
- Each step shows a circle (filled if completed, outlined if future, highlighted if current)
- Current step has a pulsing animation
- Step labels below each circle
- Color progression: completed steps in green, current in primary/blue, future in gray

---

### 4C. Enhanced Application View with Ref Code

**Add ref_code display**: Fetch the linked lead's `ref_code` via the `student_cases.lead_id` foreign key.

**Query change**: Update the fetch query to join with leads:
```
.select('*, leads!student_cases_lead_id_fkey(ref_code, full_name, eligibility_score)')
```

Wait -- there's no explicit FK constraint named that way. Instead, fetch the lead separately using `studentCase.lead_id`.

**New UI element**: A prominent badge/card at the top showing:
- Ref code (e.g., "DARB-1042") in a large monospace font
- Eligibility score badge
- Case creation date

---

### 4D. Upcoming Appointment Details

**Add appointment section**: Query the `appointments` table for appointments linked to the student's case.

```typescript
const { data: appointments } = await supabase
  .from('appointments')
  .select('*')
  .eq('case_id', caseData.id)
  .gte('scheduled_at', new Date().toISOString())
  .order('scheduled_at', { ascending: true })
  .limit(3);
```

**Note**: Students currently cannot SELECT from `appointments` table (RLS only allows lawyers and admins). We need a new RLS policy so students can view appointments linked to their case.

**New UI card**: "Upcoming Appointments" section showing:
- Date and time
- Duration
- Location (if set)
- Staff name (from case's assigned_lawyer_id profile)
- Status badge

---

### 4E. Database Migration: Student Appointment Visibility

Add RLS policy on `appointments` table so students can view appointments for their cases:

```sql
CREATE POLICY "Students can view appointments for their cases"
  ON public.appointments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM student_cases sc
      WHERE sc.id = appointments.case_id
      AND sc.student_profile_id = auth.uid()
    )
  );
```

---

### Translation Keys to Add

**English (`dashboard.json`)** -- new `application` section:

```json
"application": {
  "loading": "Loading...",
  "noApplication": "No application found yet",
  "noApplicationDesc": "Your application will appear here after registration",
  "progress": "Application Progress",
  "city": "City",
  "school": "School",
  "accommodation": "Accommodation",
  "notSet": "Not set",
  "payments": "Payments",
  "paid": "Paid",
  "pending": "Pending",
  "refCode": "Reference Code",
  "score": "Eligibility Score",
  "createdAt": "Application Date",
  "upcomingAppointments": "Upcoming Appointments",
  "noAppointments": "No upcoming appointments",
  "duration": "{{minutes}} min",
  "withStaff": "with {{name}}",
  "paymentTypes": {
    "service_fee": "Service Fee",
    "school_payment": "School Payment",
    "translation": "Translation"
  },
  "steps": {
    "assigned": "Assigned",
    "contacted": "Contacted",
    "appointment": "Appointment",
    "paid": "Paid",
    "ready_to_apply": "Ready to Apply",
    "registration_submitted": "Registration Submitted",
    "visa_stage": "Visa Stage",
    "settled": "Settled",
    "completed": "Completed"
  }
}
```

**Arabic (`dashboard.json`)** -- mirror:

```json
"application": {
  "loading": "جار التحميل...",
  "noApplication": "لا يوجد ملف تقديم بعد",
  "noApplicationDesc": "سيظهر ملفك هنا بعد تسجيلك لدينا",
  "progress": "تقدم الطلب",
  "city": "المدينة",
  "school": "المدرسة",
  "accommodation": "السكن",
  "notSet": "لم يُحدد",
  "payments": "المدفوعات",
  "paid": "مدفوع",
  "pending": "معلق",
  "refCode": "رمز المرجع",
  "score": "درجة الأهلية",
  "createdAt": "تاريخ التقديم",
  "upcomingAppointments": "المواعيد القادمة",
  "noAppointments": "لا توجد مواعيد قادمة",
  "duration": "{{minutes}} دقيقة",
  "withStaff": "مع {{name}}",
  "paymentTypes": {
    "service_fee": "رسوم الخدمة",
    "school_payment": "دفعة المدرسة",
    "translation": "ترجمة"
  },
  "steps": {
    "assigned": "معيّن",
    "contacted": "تم التواصل",
    "appointment": "موعد",
    "paid": "مدفوع",
    "ready_to_apply": "جاهز للتقديم",
    "registration_submitted": "تم تقديم التسجيل",
    "visa_stage": "مرحلة الفيزا",
    "settled": "تم الاستقرار",
    "completed": "مكتمل"
  }
}
```

---

### Technical File Summary

| File | Action |
|------|--------|
| `public/locales/en/dashboard.json` | Add `application.*` section (~25 keys) |
| `public/locales/ar/dashboard.json` | Add `application.*` section (~25 keys) |
| `src/components/dashboard/MyApplicationTab.tsx` | Full rewrite: remove all `isAr` ternaries, use `t()`, add 10-stage timeline stepper, add ref_code card, add appointments section |
| DB Migration | Add RLS policy for students to view their case appointments |

---

### Design Notes

- Timeline stepper uses the existing brand colors: green for completed, primary blue for current, gray for future
- Ref code displayed in a monospace font with a subtle copy button
- Appointment cards match the existing Card component style with rounded-2xl
- Mobile-first: timeline goes vertical on small screens
- All spacing follows the 8px grid
- No decorative gradients -- clean, high-contrast cards only

