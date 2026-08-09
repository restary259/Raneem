import type { BlogArticle } from '../types';

const article: BlogArticle = {
  slug: 'cost-of-living-germany-students',
  category: 'money',
  publishedAt: '2026-08-09',
  updatedAt: '2026-08-09',
  sources: [
    { label: 'Auswärtiges Amt — Federal Foreign Office (visa FAQ)', url: 'https://www.auswaertiges-amt.de/en/visa-service/buergerservice/faq/-/606852' },
    { label: 'Study in Germany (DAAD / BMBF)', url: 'https://www.study-in-germany.de/en/' },
    { label: 'Make it in Germany — official government portal', url: 'https://www.make-it-in-germany.com/en/study-training/studying/financing' },
    { label: 'Deutsches Studierendenwerk', url: 'https://www.studierendenwerke.de/themen' },
  ],
  relatedPaths: ['/resources/cost-calculator', '/services', '/faq'],
  ar: {
    title: 'تكلفة المعيشة في ألمانيا للطلاب والحساب المغلق',
    description:
      'ميزانية شهرية واقعية للطالب في ألمانيا، وكيف يعمل الحساب المغلق (Sperrkonto)، ومن أين تتحقق من المبلغ المطلوب رسمياً.',
    excerpt:
      'قبل أن تقدّم على فيزا الطالب تحتاج إلى إثبات تمويل معيشتك. هذا الدليل يشرح بنود المصروف الشهري الحقيقية، وكيف يعمل الحساب المغلق، وأين تتأكد من المبلغ المطلوب من المصدر الرسمي.',
    sections: [
      {
        heading: 'ما هو الحساب المغلق (Sperrkonto)؟',
        paragraphs: [
          'الحساب المغلق هو حساب بنكي ألماني تودع فيه مبلغاً يغطي سنة دراسية، ولا تستطيع سحب أكثر من قسط شهري ثابت منه. تستخدمه السفارة كإثبات على قدرتك على تمويل معيشتك أثناء الدراسة (Finanzierungsnachweis).',
          'المبلغ المطلوب يُحدَّث من قبل الجهات الألمانية بشكل دوري، ويرتبط بالحد الأعلى لمنحة BAföG. لهذا السبب لا ننشر رقماً ثابتاً هنا: تحقق دائماً من الرقم الساري في تاريخ تقديمك عبر صفحة وزارة الخارجية الألمانية أو السفارة/القنصلية المختصة.',
        ],
        note: 'لا تعتمد على أرقام منشورة في منتديات أو مواقع غير رسمية. الرقم الرسمي هو الوحيد الذي تقبله السفارة.',
      },
      {
        heading: 'بنود المصروف الشهري الحقيقية',
        paragraphs: [
          'تختلف التكلفة بين مدينة وأخرى بفارق كبير؛ السكن في ميونخ أو فرانكفورت أغلى بكثير منه في لايبتسيغ أو ماغديبورغ. البنود التي يجب أن تحسبها:',
        ],
        bullets: [
          'الإيجار (غرفة في سكن طلابي أو WG هو الخيار الأوفر عادة)',
          'التأمين الصحي الإلزامي للطلاب',
          'الطعام والمشتريات اليومية',
          'رسوم الفصل (Semesterbeitrag) وغالباً تشمل تذكرة مواصلات',
          'الاتصالات والإنترنت',
          'الكتب والمصاريف الدراسية',
          'مصاريف طارئة وسفر',
        ],
      },
      {
        heading: 'رسوم الجامعة مقابل رسوم الفصل',
        paragraphs: [
          'معظم الجامعات الحكومية في ألمانيا لا تفرض رسوماً دراسية على البكالوريوس، لكن هناك «رسوم فصل» إدارية تُدفع كل سيميستر وتذهب لخدمات الطلاب والمواصلات. بعض الولايات والبرامج الخاصة أو برامج الماجستير غير المتتابعة قد تفرض رسوماً — تحقق من صفحة الجامعة نفسها.',
        ],
      },
      {
        heading: 'كيف تخطط لميزانيتك قبل السفر',
        bullets: [
          'اختر المدينة على أساس تكلفة السكن لا على أساس الاسم فقط',
          'قدّم على السكن الطلابي مبكراً جداً — قوائم الانتظار طويلة',
          'احسب مصاريف الأشهر الأولى (تأمين السكن، أثاث، وثائق) بشكل منفصل عن المصروف الشهري',
          'استخدم حاسبة التكاليف لدينا لتقدير رقم قريب من الواقع لمدينتك',
        ],
      },
    ],
  },
  en: {
    title: 'Cost of Living in Germany for Students & the Blocked Account',
    description:
      'A realistic monthly student budget in Germany, how the blocked account (Sperrkonto) works, and where to verify the officially required amount.',
    excerpt:
      'Before a student visa is granted you must prove you can finance your stay. This guide covers real monthly costs, how the blocked account works, and where to confirm the required amount from the official source.',
    sections: [
      {
        heading: 'What is a blocked account (Sperrkonto)?',
        paragraphs: [
          'A blocked account is a German bank account holding roughly one academic year of living costs, from which you may withdraw only a fixed monthly amount. Embassies accept it as proof of financing (Finanzierungsnachweis) for a student visa.',
          'The required amount is updated periodically by the German authorities and is tied to the maximum BAföG rate. That is why we do not publish a fixed number here: always confirm the amount valid on your application date via the Federal Foreign Office or the responsible embassy/consulate.',
        ],
        note: 'Do not rely on figures from forums or unofficial sites. Only the official figure is accepted by the embassy.',
      },
      {
        heading: 'What your monthly budget actually contains',
        paragraphs: [
          'Costs vary strongly by city — a room in Munich or Frankfurt costs far more than in Leipzig or Magdeburg. Budget for:',
        ],
        bullets: [
          'Rent (a student dorm room or a shared flat/WG is usually cheapest)',
          'Mandatory student health insurance',
          'Food and daily shopping',
          'Semester fee (Semesterbeitrag), often including a transport ticket',
          'Phone and internet',
          'Books and study materials',
          'Emergencies and travel',
        ],
      },
      {
        heading: 'Tuition versus semester fee',
        paragraphs: [
          'Most public universities charge no tuition for bachelor programmes, but every student pays an administrative semester fee that funds student services and often public transport. Some states, private institutions and non-consecutive master programmes do charge tuition — check the university page itself.',
        ],
      },
      {
        heading: 'Planning your budget before departure',
        bullets: [
          'Choose your city partly on housing cost, not reputation alone',
          'Apply for student housing very early — waiting lists are long',
          'Budget first-month costs (deposit, furniture, paperwork) separately from monthly spend',
          'Use our cost calculator for a realistic estimate for your city',
        ],
      },
    ],
  },
};

export default article;
