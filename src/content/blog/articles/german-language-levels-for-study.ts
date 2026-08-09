import type { BlogArticle } from '../types';

const article: BlogArticle = {
  slug: 'german-language-levels-for-study',
  category: 'before-arrival',
  publishedAt: '2026-08-09',
  updatedAt: '2026-08-09',
  sources: [
    { label: 'Goethe-Institut — German exams and levels', url: 'https://www.goethe.de/en/spr.html' },
    { label: 'TestDaF Institute', url: 'https://www.testdaf.de/' },
    { label: 'Study in Germany (DAAD / BMBF)', url: 'https://www.study-in-germany.de/en/' },
  ],
  relatedPaths: ['/educational-programs', '/services', '/faq'],
  ar: {
    title: 'مستوى اللغة الألمانية المطلوب للدراسة في ألمانيا',
    description:
      'ما هو المستوى اللغوي المطلوب للجامعات الألمانية، الفرق بين TestDaF وDSH وامتحانات Goethe، وكم يستغرق الوصول إليه.',
    excerpt:
      'ليست كل البرامج تتطلب نفس المستوى. هذا الدليل يوضح المستويات المعترف بها، الامتحانات الرسمية، وكيف تخطط لجدول تعلمك بشكل واقعي.',
    sections: [
      {
        heading: 'ما المستوى الذي تحتاجه فعلاً؟',
        paragraphs: [
          'البرامج التي تُدرَّس بالألمانية تتطلب عادة مستوى متقدماً يثبت عبر امتحان معترف به مثل TestDaF أو DSH. البرامج التي تُدرَّس بالإنجليزية تطلب إثبات إنجليزية (مثل IELTS أو TOEFL) لكنها غالباً تشترط أيضاً مستوى ألماني أساسي للحياة اليومية أو للفيزا في بعض المسارات.',
        ],
        note: 'المستوى المطلوب يحدده البرنامج نفسه. تحقق من صفحة القبول في الجامعة قبل التسجيل في أي دورة لغة.',
      },
      {
        heading: 'الامتحانات الرسمية الأكثر قبولاً',
        bullets: [
          'TestDaF — امتحان موحّد معترف به في جميع الجامعات تقريباً',
          'DSH — امتحان تعقده الجامعات الألمانية نفسها',
          'امتحانات Goethe-Zertifikat للمستويات المختلفة',
          'telc Deutsch Hochschule في بعض الحالات',
        ],
      },
      {
        heading: 'كم يستغرق الوصول إلى المستوى المطلوب؟',
        paragraphs: [
          'المدة تعتمد على عدد ساعات الدراسة الأسبوعية وعلى انتظامك. الدورات المكثفة تتقدّم أسرع بكثير من الدورات المسائية المتقطعة. خطط على أساس ساعات الدراسة الفعلية لا على أساس «عدد الشهور».',
        ],
      },
      {
        heading: 'أخطاء شائعة',
        bullets: [
          'التسجيل في امتحان قبل الوصول للمستوى، ما يعني رسوماً مهدورة',
          'اختيار دورة غير معترف بها كإثبات للسفارة',
          'إهمال مهارة الكتابة والتحدث والتركيز على القواعد فقط',
          'تأجيل تعلم اللغة إلى ما بعد القبول',
        ],
      },
    ],
  },
  en: {
    title: 'German Language Levels Required to Study in Germany',
    description:
      'Which German level universities require, the difference between TestDaF, DSH and Goethe exams, and how long reaching that level really takes.',
    excerpt:
      'Not every programme requires the same level. This guide explains recognised levels, the official exams, and how to plan a realistic study schedule.',
    sections: [
      {
        heading: 'Which level do you actually need?',
        paragraphs: [
          'German-taught programmes normally require an advanced level proven through a recognised exam such as TestDaF or DSH. English-taught programmes require English proof (IELTS or TOEFL) but often still expect basic German for daily life, and in some paths for the visa file.',
        ],
        note: 'The required level is set by the programme itself. Check the university admission page before enrolling in any language course.',
      },
      {
        heading: 'The most widely accepted exams',
        bullets: [
          'TestDaF — a standardised exam accepted by almost all universities',
          'DSH — an exam held by German universities themselves',
          'Goethe-Zertifikat exams at the various levels',
          'telc Deutsch Hochschule in some cases',
        ],
      },
      {
        heading: 'How long does it take?',
        paragraphs: [
          'It depends on weekly study hours and consistency. Intensive courses progress far faster than occasional evening classes. Plan by actual study hours, not by "number of months".',
        ],
      },
      {
        heading: 'Common mistakes',
        bullets: [
          'Registering for the exam before reaching the level, wasting the fee',
          'Choosing a course that is not accepted as proof by the embassy',
          'Neglecting writing and speaking while focusing only on grammar',
          'Postponing language learning until after admission',
        ],
      },
    ],
  },
};

export default article;
