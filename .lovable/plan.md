
## Audit Report Summary — What Needs to Change in `src/data/majorsData.ts`

The PDF is a 20-page cross-reference audit with 6 CRITICAL errors, 5 MODERATE corrections, and several INFO additions. Here is the exact field-by-field change plan:

---

### CRITICAL FIXES (6 issues)

**1. Medicine — Bagrut NC conversion error**
- `requiredBackground` / `arab48Notes` (AR + EN): Change "بجروت فوق 90 = أقل من 1.5 ألماني" → "بجروت 90 ≈ درجة ألمانية 1.67. للحصول على درجة أقل من 1.5 تحتاج بجروت 93-94+"
- Same fix in EN: "Bagrut 90 ≈ German 1.67. To achieve German grade below 1.5, you need Bagrut 93–94+"

**2. Space Engineering — ESA headquarters wrong**
- `careerOpportunities` (AR): Remove "ESA (وكالة الفضاء الأوروبية) مقرها في ألمانيا" → "تستضيف ألمانيا مركز عمليات الفضاء التابع لوكالة الفضاء الأوروبية (ESOC) في دارمشتات. المقر الرئيسي لوكالة الفضاء الأوروبية في باريس، فرنسا"
- EN: Change "ESA (European Space Agency) is headquartered in Germany" → "Germany hosts ESA's space operations center (ESOC) in Darmstadt. ESA headquarters is in Paris, France"

**3. Law — all 3 sub-majors duration wrong**
- `international-law`, `criminal-law`, `commercial-law`: `duration`/`durationEN` show "6 فصول دراسية" / "6 semesters"
- Fix to: "Jura/Staatsexamen: 9-10+ فصول دراسية | LL.B. الدولي: 6 فصول" / "Jura (Staatsexamen): 9–10+ semesters. LL.B. international programs: 6 semesters"
- Also update `detailedDescription` for each to clarify Staatsexamen vs LL.B. path

**4. Physiotherapy — missing Ausbildung distinction**
- `detailedDescription` (AR): Add prominent note that physiotherapy in Germany is PRIMARILY a 3-year Ausbildung, not a university bachelor's. University BSc programs exist but are rare.
- EN: Same. Update `arab48Notes` to clarify the two paths.
- `duration`: Change to "3 سنوات تدريب مهني (Ausbildung) أو 6 فصول جامعية" / "3-year Ausbildung (vocational) or 6-semester university BSc (limited)"

**5. Nursing — missing Ausbildung distinction**
- Same as physiotherapy: add prominent Ausbildung vs. university BSc note
- `careerOpportunities` (AR+EN): Change "فرص عمل مضمونة 100%" → remove "100%" and replace with "شح حاد في الممرضين يجعل إيجاد العمل سهلاً جداً" / "Germany's severe nursing shortage makes job-finding very easy"

**6. Studienkolleg threshold — all affected majors**
All majors that say "لا يتطلب Studienkolleg إذا كان المعدل فوق 60" need to be updated to "القبول المباشر يتطلب عادةً بجروت 80+. الطلاب بمعدل أقل سيحتاجون Studienkolleg على الأرجح"
Affected: `public-health` (arab48Notes), `physiotherapy` (arab48Notes), `nursing` (arab48Notes), `biomedical-engineering` (arab48Notes — says 65 but now needs clarification)

---

### MODERATE FIXES (5 issues)

**7. Medicine starting salary** — `careerOpportunities`: Change "4,500–5,500 يورو شهرياً" → "3,800–4,400 يورو شهرياً (Assistenzarzt طبقاً لـ TV-Ärzte)"

**8. Dentistry starting salary** — `careerOpportunities`: Change "4,000–5,000 يورو" → "3,500–4,200 يورو"

**9. Medicine duration** — `duration`/`durationEN`: Change "12 فصل دراسي + سنة تدريب" → "12 فصل دراسي (6 سنوات) شاملاً السنة العملية" / "12 semesters (6 years) including the Praktisches Jahr"

**10. Engineering duration** — All engineering programs (computer-engineering, aerospace-engineering, space-engineering, chemical-engineering, mechanical-engineering, civil-engineering, electrical-it, renewable-energy, software-engineering, industrial-engineering): Update `durationEN` from "6 semesters" → "6–7 semesters"

**11. Business/Economics W-Kurs missing** — In all business/economics/management majors (`business-administration`, `economics`, `international-business`, `entrepreneurship`): add W-Kurs mention to arab48Notes and Studienkolleg guidance

---

### INFO ADDITIONS (3 key additions)

These appear in affected `arab48Notes` fields:
- Add to medicine/dentistry notes: "ملاحظة: اختبار البسيكومتري الإسرائيلي (PET) غير مطلوب للتقديم للجامعات الألمانية"
- Add to medicine/all health: "الطلاب الإسرائيليون لا يحتاجون شهادة APS (تُطلب فقط من الصينيين والفيتناميين)"
- Add to most majors: "معظم الجامعات تتطلب التقديم عبر uni-assist.de — قدّم مبكراً"

---

### File to Change
- **Single file**: `src/data/majorsData.ts`
- **No component changes** needed — all corrections are data-only

### Approach
Edit `majorsData.ts` field by field. The file is 403 lines. The majors are mostly on single long lines (each entry is one `{ ... }` object). I'll use targeted line replacements for each affected major's specific fields, keeping all correct data untouched.

### Affected Majors (by id):
1. `medicine` — duration, salary, NC note, Bagrut threshold
2. `dentistry` — salary, NC note  
3. `physiotherapy` — duration, Ausbildung note, Studienkolleg threshold
4. `nursing` — duration, Ausbildung note, "100% guarantee" removal
5. `public-health` — Studienkolleg threshold (arab48Notes)
6. `space-engineering` — ESA HQ correction
7. `international-law` — duration (6→9-10+)
8. `criminal-law` — duration (6→9-10+)
9. `commercial-law` (if exists) — duration
10. All engineering majors — duration 6→6-7 semesters
11. All business majors — add W-Kurs mention
