import type { BlogArticle } from '../types';

const article: BlogArticle = {
  slug: 'recognition-of-bagrut-and-anabin',
  category: 'university',
  publishedAt: '2026-08-09',
  updatedAt: '2026-08-09',
  sources: [
    { label: 'anabin — KMK database of foreign qualifications', url: 'https://anabin.kmk.org/anabin.html' },
    { label: 'uni-assist — application service for international students', url: 'https://www.uni-assist.de/en/' },
    { label: 'Study in Germany (DAAD / BMBF)', url: 'https://www.study-in-germany.de/en/' },
  ],
  relatedPaths: ['/resources/bagrut-calculator', '/educational-programs', '/faq'],
  ar: {
    title: 'معادلة شهادة البجروت والقبول في الجامعات الألمانية',
    description:
      'كيف تُقيَّم شهادة البجروت لدخول الجامعات الألمانية، ودور قاعدة anabin ومكتب uni-assist، ومتى تحتاج إلى Studienkolleg.',
    excerpt:
      'أول سؤال يواجه طلاب الداخل: هل البجروت كافٍ للقبول المباشر في ألمانيا؟ الجواب يعتمد على تركيبة الشهادة والوحدات، وهذه هي الجهات الرسمية التي تحدّد ذلك.',
    sections: [
      {
        heading: 'من يقرر قيمة شهادتك؟',
        paragraphs: [
          'التقييم الرسمي لمعادلة الشهادات الأجنبية في ألمانيا يستند إلى قاعدة بيانات anabin التابعة لمؤتمر وزراء التعليم (KMK). الجامعة أو مكتب uni-assist يستخدمان هذه القاعدة لتحديد ما إذا كانت شهادتك تمنح حق الالتحاق المباشر أم تحتاج خطوة تحضيرية.',
        ],
      },
      {
        heading: 'القبول المباشر أم Studienkolleg؟',
        paragraphs: [
          'في حالات كثيرة يحتاج حاملو شهادات ثانوية أجنبية إلى سنة تحضيرية (Studienkolleg) تنتهي بامتحان Feststellungsprüfung. في حالات أخرى، وحسب تركيبة الشهادة والوحدات، يكون القبول المباشر ممكناً — أحياناً بعد إتمام سنة دراسية جامعية في البلد الأصلي.',
        ],
        note: 'لا يوجد جواب واحد يناسب الجميع. القرار يُبنى على شهادتك أنت، لا على تجربة زميل.',
      },
      {
        heading: 'ما الذي يؤثر فعلياً على تقييمك',
        bullets: [
          'عدد وحدات الرياضيات والإنجليزية والمواد العلمية',
          'المعدل النهائي وطريقة تحويله إلى النظام الألماني',
          'اللغة المطلوبة للبرنامج (ألماني أو إنجليزي)',
          'شروط إضافية خاصة بالجامعة أو التخصص',
        ],
      },
      {
        heading: 'ترجمة وتصديق الوثائق',
        paragraphs: [
          'تُطلب عادة نسخ مصدّقة وترجمة معتمدة للشهادات وكشوف العلامات. الأخطاء هنا سبب متكرر لتأخير الملفات، لذلك تأكد من متطلبات الجهة التي تقدّم إليها قبل الترجمة.',
        ],
      },
    ],
  },
  en: {
    title: 'Bagrut Recognition and Admission to German Universities',
    description:
      'How a Bagrut certificate is assessed for German university entry, the role of anabin and uni-assist, and when a Studienkolleg is required.',
    excerpt:
      'The first question for Arab students in Israel: is the Bagrut enough for direct admission in Germany? It depends on the composition of your certificate — and these are the official bodies that decide.',
    sections: [
      {
        heading: 'Who decides what your certificate is worth?',
        paragraphs: [
          'Official assessment of foreign qualifications in Germany is based on anabin, the database of the Standing Conference of Ministers of Education (KMK). Universities and uni-assist use it to determine whether your certificate grants direct entry or requires a preparatory step.',
        ],
      },
      {
        heading: 'Direct admission or Studienkolleg?',
        paragraphs: [
          'Many holders of foreign secondary certificates need a preparatory year (Studienkolleg) ending with the Feststellungsprüfung exam. In other cases, depending on the certificate and its subject units, direct admission is possible — sometimes after completing one year of university study at home.',
        ],
        note: 'There is no single answer. The decision is based on your certificate, not on a classmate’s experience.',
      },
      {
        heading: 'What actually affects your assessment',
        bullets: [
          'Number of units in mathematics, English and science subjects',
          'Final average and how it converts into the German grading system',
          'Language of instruction required by the programme (German or English)',
          'Additional requirements set by the university or the subject',
        ],
      },
      {
        heading: 'Translation and certification',
        paragraphs: [
          'Certified copies and sworn translations of certificates and transcripts are normally required. Mistakes here are a frequent cause of delay, so confirm the requirements of the receiving institution before translating.',
        ],
      },
    ],
  },
};

export default article;
