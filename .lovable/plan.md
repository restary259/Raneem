

# Plan: Partnership Page -- Structure, Clarity & Trust Overhaul

## Overview
Improve the Partnership page's content accuracy, interactivity, and trust signals without changing the visual design. This involves fixing text, removing non-Germany countries, replacing the static 4-card "How It Works" with a dynamic scrollable 8-step timeline, rewriting the FAQ to match the real program flow, and adding trust/transparency messaging throughout.

---

## 1. Text Corrections (translation file update)

**File**: `public/locales/ar/partnership.json`

- Fix hero title: "دارب" to "درب"
- Fix hero subtitle: "الدراسة بالخارج" to "الدراسة في ألمانيا" (Germany-only focus)
- The benefit text "لا تحتاج خبرة سابقة – فقط شغف ومصداقية" alignment is handled by the component -- will add `text-center` to the WhyJoinUs benefit items for visual symmetry

**File**: `src/components/partnership/WhyJoinUs.tsx`
- Change the flex layout from `items-start` with `text-right` to centered card layout matching the rest of the page for visual symmetry

---

## 2. Germany-Only Restriction

**File**: `public/locales/ar/partnership.json`
- Remove "romania" and "jordan" from `commissionCalculator.countries` -- keep only `"germany": "ألمانيا"`

**File**: `src/components/partnership/CommissionCalculator.tsx`
- Since only one country exists, remove the country `Select` dropdown entirely
- Hardcode `country = 'germany'` and remove the selector UI
- Update the note text to mention Germany specifically

---

## 3. "How the Program Works" -- Dynamic 8-Step Scrollable Timeline

**File**: `src/components/partnership/NewHowItWorks.tsx` (complete rewrite of component body)

Replace the current 4-card static grid with an interactive vertical timeline showing 8 steps. Each step has:
- A numbered circle connected by a vertical line
- An icon
- A title and detailed description
- Steps animate into view on scroll using `react-intersection-observer` (already installed)

### The 8 Steps (from translation file):

1. **التسجيل في البرنامج** (Sign Up) -- "سجّل في برنامج الشراكة. بعد الموافقة، تحصل على صفحة شخصية مخصصة."
2. **صفحتك الشخصية** (Custom Partner Page) -- "تحصل على صفحة فريدة، نموذج تسجيل خاص، ورابط تتبع مميز يمكنك مشاركته في ستوريز انستغرام، لينكتري، الهايلايتس، أو البايو."
3. **حرية المحتوى** (Content Freedom) -- "اختر أسلوبك، طريقتك، والمنصة التي تناسبك. أنشئ محتوى ترويجي بحرية كاملة بما يتناسب مع جمهورك."
4. **تسجيل الطلاب** (Student Registration) -- "يضغط الطالب على رابطك الخاص ويملأ النموذج. كل طالب يُربط تلقائياً باسمك."
5. **شفافية البيانات** (Data Transparency) -- "يتم إنشاء جدول بيانات مشترك لكل شريك. يمكنك مشاهدة أسماء الطلاب، حالتهم، وتقدمهم. الجدول للقراءة فقط -- شفاف وموثوق."
6. **تتبع حالة الطلاب** (Status Tracking) -- "كل طالب يُصنّف: مؤهل، غير مؤهل، تم التواصل، قيد المتابعة، دفع، تم التحويل."
7. **الدورة الشهرية** (Monthly Cycle) -- "في نهاية كل شهر يُغلق الجدول ويُفتح جدول جديد للشهر التالي. جميع البيانات تبقى مرئية للتاريخ والشفافية."
8. **العمولة والدفع** (Commission & Payment) -- "تُدفع العمولة بعد 20 يوماً من دفع الطالب. فترة الـ20 يوماً إلزامية لحماية من الإلغاء أو الاسترداد. هذه القاعدة واضحة ومُلزمة."

### Technical approach
- Vertical timeline with alternating left/right cards on desktop, stacked on mobile
- Each step uses `useInView` from `react-intersection-observer` for fade-in animation
- Connected by a vertical line with numbered circles (using existing Tailwind classes)
- Icons from lucide-react: `UserCheck`, `Globe`, `Palette`, `MousePointerClick`, `Table2`, `BarChart3`, `CalendarClock`, `Wallet`

**File**: `public/locales/ar/partnership.json`
- Replace `howItWorks.steps` array with the 8 new steps including detailed descriptions

---

## 4. FAQ -- Updated to Match New Program Flow

**File**: `public/locales/ar/partnership.json`
- Replace `partnershipFaq.items` with 7 updated Q&As:

1. **كيف يتم تتبع الطلاب؟** -- "كل شريك يحصل على رابط تتبع فريد وجدول بيانات مشترك. عند تسجيل طالب عبر رابطك، يُربط تلقائياً باسمك. يمكنك متابعة حالة كل طالب بشفافية كاملة."
2. **متى تُدفع العمولات؟** -- "تُدفع العمولة بعد 20 يوماً من تاريخ دفع الطالب. فترة الـ20 يوماً ضرورية لحماية الطرفين من حالات الإلغاء أو الاسترداد."
3. **لماذا فترة الـ20 يوماً؟** -- "هذه الفترة تحمي الشريك والشركة. إذا غيّر الطالب رأيه أو طلب استرداداً خلال هذه الفترة، لا يتأثر الشريك. بعد انتهاء الفترة، تُحوّل العمولة مباشرة."
4. **ما البيانات التي يمكنني رؤيتها؟** -- "يمكنك رؤية: أسماء الطلاب المسجلين عبر رابطك، حالة كل طالب (مؤهل، غير مؤهل، تم التواصل، قيد المتابعة، دفع، تم التحويل)، وتاريخ التسجيل."
5. **كيف تضمنون الشفافية؟** -- "نوفر جدول بيانات مشترك للقراءة فقط، يُحدّث بشكل مستمر. في نهاية كل شهر، يُغلق الجدول ويُفتح جدول جديد. جميع البيانات السابقة تبقى مرئية."
6. **هل هناك تكاليف للانضمام؟** -- "لا توجد أي تكاليف. الانضمام مجاني تماماً ونوفر لك كل الدعم للبدء."
7. **هل يمكنني اختيار أسلوب المحتوى الخاص بي؟** -- "نعم، لديك حرية كاملة في اختيار الأسلوب والمنصة وطريقة الترويج. نحن نوفر لك المعلومات والمواد، وأنت تختار كيف تقدمها لجمهورك."

---

## 5. Trust & Transparency Section (New Component)

**File**: `src/components/partnership/TrustSection.tsx` (new)

A new section placed between AgentToolkit and RegistrationForm showing 3-4 trust pillars:
- **شفافية الأرقام** -- "جدول بيانات مشترك لكل شريك"
- **عمليات واضحة** -- "كل خطوة موثقة ومرئية"
- **قواعد عمولة عادلة** -- "20 يوماً لحماية الجميع"
- **هيكل احترافي** -- "دورة شهرية منظمة وبيانات تاريخية"

Uses existing Card components with icons, same styling as WhyJoinUs section.

**File**: `src/pages/PartnershipPage.tsx` -- add `TrustSection` between AgentToolkit and RegistrationForm

---

## Technical Details

### New Files

| File | Purpose |
|------|---------|
| `src/components/partnership/TrustSection.tsx` | Trust & transparency pillars section |

### Modified Files

| File | Changes |
|------|---------|
| `public/locales/ar/partnership.json` | Fix title typo, remove Romania/Jordan from calculator, replace howItWorks with 8 steps, replace FAQ with 7 updated items, add trust section translations |
| `src/components/partnership/NewHowItWorks.tsx` | Replace 4-card grid with interactive 8-step vertical timeline with scroll animations |
| `src/components/partnership/CommissionCalculator.tsx` | Remove country selector, hardcode Germany only |
| `src/components/partnership/WhyJoinUs.tsx` | Improve alignment/symmetry of benefit items |
| `src/pages/PartnershipPage.tsx` | Add TrustSection component |

### What Will NOT Change
- Website design, colors, fonts, or branding
- Navigation order (logo, menu items, student portal button)
- Header, Footer, or any other page
- Registration form structure
- Closing CTA styling

