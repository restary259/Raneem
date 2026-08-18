/**
 * Seed content for the DARB Ambassador Guide (version 1.0).
 *
 * Mirrors agentOperationsGuide.ts's structure. Money figures are `{{tokens}}`
 * resolved from the live Commission Hub. Legal exposure is `legal` callouts.
 */
import type { DocBlock } from "@/lib/documentBlocks";
import { blockIdFactory } from "./seedBlockHelpers";

interface AmbassadorStrings {
  coverTitle: string;
  coverSubtitle: string;
  coverNote: string;
  s1: string;
  s1p: string;
  s2: string;
  s2p: string;
  s3: string;
  s3list: string[];
  s4: string;
  s4p: string;
  s4callout: string;
  s5: string;
  s5doList: string[];
  s5dont: string;
  s5dontList: string[];
  s6: string;
  s6p: string;
  s6flowTitle: string;
  s6flow: string[];
  s7: string;
  s7p: string;
  s7tableHead: string[];
  s7rows: string[][];
  s8: string;
  s8p: string;
  s9: string;
  s9list: string[];
  s10: string;
  s10legal: string;
  ack: string;
  ackP: string;
  parties: string[];
  disclaimer: string;
  legalTitle: string;
}

function build(lang: string, s: AmbassadorStrings): DocBlock[] {
  const B = blockIdFactory("am", lang);
  return [
    { id: B(), type: "cover", title: s.coverTitle, subtitle: s.coverSubtitle, note: s.coverNote },

    { id: B(), type: "heading", level: 1, text: s.s1 },
    { id: B(), type: "paragraph", text: s.s1p },

    { id: B(), type: "heading", level: 1, text: s.s2 },
    { id: B(), type: "paragraph", text: s.s2p },

    { id: B(), type: "heading", level: 1, text: s.s3 },
    { id: B(), type: "list", items: s.s3list },

    { id: B(), type: "heading", level: 1, text: s.s4 },
    { id: B(), type: "paragraph", text: s.s4p },
    { id: B(), type: "callout", tone: "warning", text: s.s4callout },

    { id: B(), type: "heading", level: 1, text: s.s5 },
    { id: B(), type: "list", items: s.s5doList },
    { id: B(), type: "heading", level: 2, text: s.s5dont },
    { id: B(), type: "list", items: s.s5dontList },

    { id: B(), type: "pagebreak" },

    { id: B(), type: "heading", level: 1, text: s.s6 },
    { id: B(), type: "paragraph", text: s.s6p },
    { id: B(), type: "flow", title: s.s6flowTitle, steps: s.s6flow },

    { id: B(), type: "heading", level: 1, text: s.s7 },
    { id: B(), type: "paragraph", text: s.s7p },
    { id: B(), type: "table", headers: s.s7tableHead, rows: s.s7rows },

    { id: B(), type: "heading", level: 1, text: s.s8 },
    { id: B(), type: "paragraph", text: s.s8p },

    { id: B(), type: "heading", level: 1, text: s.s9 },
    { id: B(), type: "list", items: s.s9list },

    { id: B(), type: "heading", level: 1, text: s.s10 },
    { id: B(), type: "callout", tone: "legal", title: s.legalTitle, text: s.s10legal },

    { id: B(), type: "heading", level: 1, text: s.ack },
    { id: B(), type: "paragraph", text: s.ackP },
    { id: B(), type: "signature", parties: s.parties },
    { id: B(), type: "disclaimer", text: s.disclaimer },
  ];
}

const AR: AmbassadorStrings = {
  coverTitle: "دليل السفير",
  coverSubtitle: "درب — دليل تشغيلي رسمي للسفراء",
  coverNote: "الإصدار {{version}} · تاريخ السريان {{effective_date}}",
  s1: "عن درب",
  s1p: "درب وكالة متخصّصة بمرافقة الطلاب حتى التسجيل والوصول إلى ألمانيا. لكل سفير لوحة تحكّم خاصة به لمتابعة إحالاته وأرباحه.",
  s2: "من هو السفير؟",
  s2p: "السفير شريك إعلامي يُحيل الطلاب إلى درب عبر رابطه الخاص، ويحصل على عمولة ثابتة عن كل طالب يصل إلى مرحلة التسجيل المؤكّد.",
  s3: "مسؤوليات السفير",
  s3list: [
    "عرض خدمات درب بدقّة عبر منصّاته الإعلامية.",
    "توجيه الطالب إلى رابط التقديم الرسمي.",
    "المحافظة على خصوصية بيانات الطلاب.",
    "التواصل مع الإدارة عبر صندوق المحادثة.",
  ],
  s4: "الوضع القانوني للسفير",
  s4p: "السفير مقدّم خدمة مستقلّ. لا تنشئ هذه العلاقة علاقة عمل أو استخدام مع درب.",
  s4callout: "السفير مسؤول بشكل كامل عن التزاماته الضريبية والقانونية الشخصية الناتجة عن العمولات.",
  s5: "الممارسات المسموحة",
  s5doList: [
    "نشر رابط التقديم الشخصي عبر القنوات الإعلامية.",
    "متابعة الحالات المنسوبة عبر لوحة التحكّم.",
    "تقديم معلومات دقيقة عن البرامج.",
  ],
  s5dont: "ممنوع منعًا باتًا",
  s5dontList: [
    "تقديم وعود بقبول جامعي أو تأشيرة.",
    "الإعلان عن أسعار أو خصومات غير معتمدة.",
    "تحصيل أي مبلغ باسم درب.",
    "التعريف عن النفس كموظّف لدى درب.",
  ],
  s6: "مسار الإحالة",
  s6p: "عندما يقدّم الطالب طلبه عبر رابط السفير، تُنسب الحالة إليه. العمولة ثابتة وتُستحق عند التسجيل المؤكّد، ثم تدخل فترة تثبيت مدّتها {{lock_days}} يومًا.",
  s6flowTitle: "مسار الإحالة",
  s6flow: ["السفير", "رابط التقديم", "الطالب", "درب"],
  s7: "العمولات",
  s7p: "العمولة ثابتة بالشيكل الجديد كما هي معرّفة في مركز العمولات:",
  s7tableHead: ["نوع الإحالة", "مستحقّ العمولة", "المبلغ"],
  s7rows: [["طالب أحاله السفير", "السفير", "{{ambassador_amount}}"]],
  s8: "المدفوعات",
  s8p: "تُصرف العمولات المتاحة عبر تحويل بنكي بعد تقديم طلب سحب من لوحة التحكّم، وتراجع الإدارة كل طلب قبل التنفيذ.",
  s9: "الإشعارات",
  s9list: [
    "إشعار عند تسجيل عمولة جديدة.",
    "إشعار عند تغيّر حالة طلب السحب.",
    "رسائل الإدارة عبر صندوق المحادثة.",
  ],
  s10: "إنهاء التعاون والمسؤولية والاختصاص القضائي",
  s10legal: "بنود إنهاء التعاون وحدود المسؤولية والاختصاص القضائي لم تُصَغ في هذا الإصدار، وتحتاج إلى مراجعة قانونية قبل نشر أي نسخة مُلزِمة.",
  ack: "إقرار",
  ackP: "بتوقيعه أدناه يقرّ السفير بأنّه اطّلع على هذا الدليل وفهم مضمونه. هذا الدليل وثيقة تشغيلية توضيحية وليس عقدًا مُلزِمًا.",
  parties: ["عن درب", "السفير: {{partner_name}}"],
  disclaimer: "وثيقة داخلية صادرة عن درب. القيم المالية الواردة فيها تعكس إعدادات النظام بتاريخ {{date}} وقد تتغيّر بقرار من الإدارة.",
  legalTitle: "يتطلّب مراجعة قانونية",
};

export const AMBASSADOR_GUIDE_AR: DocBlock[] = build("ar", AR);

export const AMBASSADOR_GUIDE_SEED = [
  {
    slug: "ambassador-guide-ar",
    title: "دليل السفير",
    subtitle: "درب — دليل تشغيلي رسمي للسفراء",
    description: "دليل شامل للسفراء: الدور، الإحالة، العمولات، فترة التثبيت، والمدفوعات.",
    category: "ambassadors",
    doc_kind: "guide" as const,
    language: "ar" as const,
    content: AMBASSADOR_GUIDE_AR,
  },
];
