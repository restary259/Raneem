
## Update Resources Page FAQ

### Problem
The FAQ section on `/resources` has 3 questions that reference the deleted Living Cost Calculator:
1. **"كيف يمكنني استخدام حاسبة التكاليف؟"** — directly about the removed tool
2. **"كم دقيقة تقديرات التكاليف؟"** — also about the removed cost calculator accuracy
3. **"هل أسعار الصرف محدثة؟"** — this one is still valid (Currency Comparator)

### Current 3 tools on the page
1. Currency Converter (محول العملات)
2. Bagrut Calculator (حاسبة البجروت)
3. CV Builder / Lebenslauf

### Fix
Replace the 2 dead cost-calculator questions with questions about the Bagrut Calculator and the CV Builder. Keep the exchange rates question as-is.

**New FAQ (both AR + EN):**

| Key | AR question | EN question |
|-----|-------------|-------------|
| `costCalculator` → renamed to `bagrutCalculator` | كيف أستخدم حاسبة البجروت؟ | How do I use the Bagrut Calculator? |
| `exchangeRates` | هل أسعار الصرف محدثة؟ (unchanged) | Are exchange rates up to date? (unchanged) |
| `accuracy` → renamed to `cvBuilder` | هل السيرة الذاتية جاهزة للتقديم للجامعات الألمانية؟ | Is the CV ready for German university applications? |

**New answers:**
- `bagrutCalculator` AR: أدخل علاماتك البجروت وعدد الوحدات لكل مادة، وستحصل فوراً على معدلك ومكافئه في النظام الألماني (1.0–4.0) باستخدام المعادلة البافارية.
- `bagrutCalculator` EN: Enter your Bagrut grades and credit units for each subject. You'll instantly get your average and its German equivalent (1.0–4.0) using the Modified Bavarian Formula.
- `cvBuilder` AR: نعم! قوالبنا مصممة خصيصاً لمعايير الجامعات والشركات الألمانية. اختر القالب المناسب، أدخل بياناتك، واحفظ مسودتك في أي وقت وحمّل PDF نظيف بدون علامات مائية.
- `cvBuilder` EN: Yes! Our templates are designed specifically for German university and employer standards. Choose your template, fill in your details, save a draft at any time, and download a clean watermark-free PDF.

### Files to change: 2
- `public/locales/ar/resources.json` — lines 328–343 (the `faq` block)
- `public/locales/en/resources.json` — lines 328–343 (the `faq` block)

The ResourcesPage.tsx already renders these via `t('faq.questions.costCalculator.question')`, `t('faq.questions.exchangeRates.question')`, and `t('faq.questions.accuracy.question')` — so those 3 keys need to remain (or we update the component too). Let me check whether we should rename the keys or just update the content.

Looking at `ResourcesPage.tsx` lines ~105–142, the 3 Cards are hardcoded to `faq.questions.costCalculator`, `faq.questions.exchangeRates`, `faq.questions.accuracy`. The simplest approach is to **keep the same keys** but replace their content to be about Bagrut + CV Builder — no component change needed.

### Precise plan:
- Update `faq.questions.costCalculator` → Bagrut Calculator question (both files)
- Keep `faq.questions.exchangeRates` as-is
- Update `faq.questions.accuracy` → CV Builder question (both files)

Only 2 files, only the `faq` block in each.
