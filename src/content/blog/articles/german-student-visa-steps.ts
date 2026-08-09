import type { BlogArticle } from '../types';

const article: BlogArticle = {
  slug: 'german-student-visa-steps',
  category: 'before-arrival',
  publishedAt: '2026-08-09',
  updatedAt: '2026-08-09',
  sources: [
    { label: 'Auswärtiges Amt — visa information', url: 'https://www.auswaertiges-amt.de/en/visa-service' },
    { label: 'German Representations in Israel', url: 'https://israel.diplo.de/' },
    { label: 'Make it in Germany — official government portal', url: 'https://www.make-it-in-germany.com/en/' },
  ],
  relatedPaths: ['/services', '/faq', '/contact'],
  ar: {
    title: 'خطوات فيزا الطالب إلى ألمانيا: الترتيب الصحيح',
    description:
      'دليل عملي لخطوات فيزا الطالب الألمانية: من القبول الجامعي إلى موعد السفارة والوثائق المطلوبة ومدة الانتظار.',
    excerpt:
      'أكثر ما يؤخّر الطلاب ليس رفض الفيزا، بل ترتيب الخطوات بشكل خاطئ. هنا التسلسل الصحيح من القبول حتى الحصول على التأشيرة.',
    sections: [
      {
        heading: 'الترتيب الصحيح للخطوات',
        bullets: [
          'اعتماد شهادتك والتأكد من معادلتها لمتطلبات الجامعة الألمانية',
          'التقديم على الجامعة أو على معهد لغة/كولك (Studienkolleg) حسب حالتك',
          'استلام القبول (قبول مشروط أو نهائي)',
          'فتح الحساب المغلق وإتمام التأمين الصحي',
          'حجز موعد السفارة أو القنصلية المختصة بمكان إقامتك',
          'تقديم ملف الفيزا كاملاً في الموعد',
          'انتظار القرار ثم استلام جواز السفر بالتأشيرة',
        ],
        note: 'مواعيد السفارات محدودة وقد تُحجز قبل أشهر. احجز الموعد بمجرد أن يصبح لديك مسار قبول واضح.',
      },
      {
        heading: 'الوثائق التي تُطلب عادةً',
        paragraphs: [
          'القائمة الدقيقة تحددها السفارة أو القنصلية المختصة، وقد تختلف بين ممثلية وأخرى. عملياً يشمل الملف:',
        ],
        bullets: [
          'جواز سفر ساري المفعول وصور شخصية بالمواصفات المطلوبة',
          'استمارة طلب التأشيرة الوطنية مُعبأة وموقعة',
          'خطاب القبول أو إثبات التقديم',
          'إثبات التمويل (حساب مغلق أو ما يعادله)',
          'إثبات تأمين صحي',
          'الشهادات الدراسية وكشوف العلامات',
          'إثبات مستوى اللغة المطلوب للبرنامج',
        ],
      },
      {
        heading: 'كم تستغرق المعالجة؟',
        paragraphs: [
          'مدة المعالجة تختلف حسب الممثلية والموسم، وقد تمتد لأسابيع أو أشهر خصوصاً قبل بداية الفصل الدراسي. لا تحجز طيراناً أو سكناً غير قابل للإلغاء قبل صدور القرار.',
        ],
      },
      {
        heading: 'أسباب شائعة للتأخير',
        bullets: [
          'ملف ناقص أو ترجمة غير معتمدة',
          'إثبات تمويل لا يطابق الشروط الحالية',
          'حجز موعد متأخر بعد بدء الفصل',
          'تناقض بين المعلومات في الاستمارة والوثائق',
        ],
      },
    ],
  },
  en: {
    title: 'German Student Visa Steps in the Right Order',
    description:
      'A practical guide to the German student visa: admission, blocked account, embassy appointment, documents and realistic processing times.',
    excerpt:
      'What delays most students is not rejection — it is doing the steps in the wrong order. Here is the correct sequence from admission to visa.',
    sections: [
      {
        heading: 'The correct sequence',
        bullets: [
          'Have your certificate assessed against German university entry requirements',
          'Apply to the university, or to a language course / Studienkolleg if required',
          'Receive your admission (conditional or final)',
          'Open the blocked account and arrange health insurance',
          'Book an appointment at the embassy or consulate responsible for your place of residence',
          'Submit the complete visa file at your appointment',
          'Wait for the decision and collect your passport with the visa',
        ],
        note: 'Embassy slots are limited and can be booked out months ahead. Book as soon as your admission path is clear.',
      },
      {
        heading: 'Documents usually required',
        paragraphs: [
          'The exact list is defined by the responsible mission and can differ. In practice the file includes:',
        ],
        bullets: [
          'Valid passport and photos meeting the required specification',
          'Completed and signed national visa application form',
          'Admission letter or proof of application',
          'Proof of financing (blocked account or equivalent)',
          'Proof of health insurance',
          'Certificates and transcripts',
          'Proof of the language level required by your programme',
        ],
      },
      {
        heading: 'How long does it take?',
        paragraphs: [
          'Processing time depends on the mission and the season and can run for weeks or months, especially before semester start. Do not book non-refundable flights or housing before the decision.',
        ],
      },
      {
        heading: 'Common causes of delay',
        bullets: [
          'Incomplete files or uncertified translations',
          'Financing proof that does not match current requirements',
          'Booking the appointment too late in the cycle',
          'Inconsistencies between the form and the supporting documents',
        ],
      },
    ],
  },
};

export default article;
