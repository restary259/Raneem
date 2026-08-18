/**
 * Seed content for the DARB Partner Operations Guide (version 1.0).
 *
 * Mirrors agentOperationsGuide.ts's structure. Money figures are `{{tokens}}`
 * resolved from the live Commission Hub at preview/generate time, so the guide
 * can never drift from the system it documents. Legal/uncertain exposure is
 * emitted as `legal` callouts, never invented clauses.
 */
import type { DocBlock } from "@/lib/documentBlocks";
import { blockIdFactory } from "./seedBlockHelpers";

interface PartnerStrings {
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
  s8calloutLegal: string;
  s9: string;
  s9p: string;
  s10: string;
  s10list: string[];
  s11: string;
  s11legal: string;
  ack: string;
  ackP: string;
  parties: string[];
  disclaimer: string;
  legalTitle: string;
}


function build(lang: string, s: PartnerStrings): DocBlock[] {
  const B = blockIdFactory("pg", lang);
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
    { id: B(), type: "callout", tone: "legal", title: s.legalTitle, text: s.s8calloutLegal },

    { id: B(), type: "heading", level: 1, text: s.s9 },
    { id: B(), type: "paragraph", text: s.s9p },

    { id: B(), type: "heading", level: 1, text: s.s10 },
    { id: B(), type: "list", items: s.s10list },

    { id: B(), type: "heading", level: 1, text: s.s11 },
    { id: B(), type: "callout", tone: "legal", title: s.legalTitle, text: s.s11legal },

    { id: B(), type: "heading", level: 1, text: s.ack },
    { id: B(), type: "paragraph", text: s.ackP },
    { id: B(), type: "signature", parties: s.parties },
    { id: B(), type: "disclaimer", text: s.disclaimer },
  ];
}

const AR: PartnerStrings = {
  coverTitle: "دليل عمل الشريك",
  coverSubtitle: "درب — دليل تشغيلي رسمي للشركاء",
  coverNote: "الإصدار {{version}} · تاريخ السريان {{effective_date}}",
  s1: "عن درب",
  s1p: "درب وكالة متخصّصة بمرافقة الطلاب من مرحلة الاستفسار الأولي وحتى التسجيل والوصول إلى ألمانيا. تُدار كل حالة داخل منصّة درب، ويكون لكل شريك لوحة تحكّم خاصة به.",
  s2: "من هو الشريك؟",
  s2p: "الشريك هو جهة تعاون تُحيل الطلاب إلى درب عبر رابطها الخاص. يحصل الشريك على عمولة ثابتة عن كل طالب يصل إلى مرحلة الدفع والتسجيل المؤكّد.",
  s3: "مسؤوليات الشريك",
  s3list: [
    "عرض خدمات درب بدقّة وبالاعتماد على المعلومات الرسمية المنشورة في المنصّة.",
    "توجيه الطالب إلى رابط التقديم الرسمي دون جمع مستندات أو مبالغ بشكل شخصي.",
    "المحافظة على خصوصية بيانات الطلاب وعدم مشاركتها خارج المنصّة.",
    "التواصل مع الإدارة عبر صندوق المحادثة داخل لوحة التحكّم.",
  ],
  s4: "الوضع القانوني للشريك",
  s4p: "الشريك مقدّم خدمة مستقلّ. لا تنشئ هذه العلاقة علاقة عمل أو استخدام أو شراكة قانونية مع درب.",
  s4callout: "الشريك مسؤول بشكل كامل عن التزاماته الضريبية والقانونية الشخصية الناتجة عن العمولات التي يتقاضاها.",
  s5: "مسارات العمل",
  s5doList: [
    "مشاركة رابط التقديم الشخصي مع الطلاب المهتمّين.",
    "متابعة الحالات المنسوبة عبر لوحة التحكّم.",
    "تقديم معلومات دقيقة عن البرامج والأسعار المعتمدة.",
  ],
  s5dont: "ممنوع منعًا باتًا",
  s5dontList: [
    "تقديم وعود بقبول جامعي أو تأشيرة أو نتيجة مضمونة.",
    "الإعلان عن أسعار أو خصومات غير معتمدة من الإدارة.",
    "تحصيل أي مبلغ مالي من الطالب باسم درب.",
    "التعريف عن النفس كموظّف لدى درب.",
  ],
  s6: "مسار الإحالة",
  s6p: "عندما يقدّم الطالب طلبه عبر رابط الشريك، تُنسب الحالة إليه تلقائيًا. العمولة ثابتة وتُستحق عند وصول الحالة إلى مرحلة التسجيل المؤكّد، ثم تدخل فترة تثبيت مدّتها {{lock_days}} يومًا.",
  s6flowTitle: "مسار الإحالة",
  s6flow: ["الشريك", "رابط التقديم", "الطالب", "درب"],
  s7: "العمولات",
  s7p: "العمولات مبالغ ثابتة بالشيكل الجديد كما هي معرّفة في مركز العمولات. القيم أدناه وفق الإعدادات الفعليّة:",
  s7tableHead: ["نوع الإحالة", "مستحقّ العمولة", "المبلغ"],
  s7rows: [
    ["طالب أحاله الشريك مباشرة", "الشريك", "{{partner_amount}}"],
    ["طالب أحاله سفير", "السفير", "{{ambassador_amount}}"],
  ],
  s8: "الإلغاء والاسترداد",
  s8p: "المبدأ التشغيلي: العمولة مرتبطة بحالة مدفوعة ومؤكّدة، وأي إلغاء أو استرداد لاحق ينعكس على العمولة المرتبطة بها.",
  s8calloutLegal: "الصياغة التفصيلية لحالات الإلغاء والاسترداد وآثارها على العمولات تحتاج إلى مراجعة قانونية قبل الاعتماد النهائي.",
  s9: "المدفوعات",
  s9p: "تُصرف العمولات المتاحة عبر تحويل بنكي بعد تقديم طلب سحب من لوحة التحكّم، وتراجع الإدارة كل طلب قبل التنفيذ.",
  s10: "الإشعارات",
  s10list: [
    "إشعار عند تسجيل عمولة جديدة.",
    "إشعار عند تغيّر حالة طلب السحب.",
    "رسائل الإدارة عبر صندوق المحادثة.",
  ],
  s11: "إنهاء التعاون والمسؤولية والاختصاص القضائي",
  s11legal: "بنود إنهاء التعاون وحدود المسؤولية والاختصاص القضائي لم تُصَغ في هذا الإصدار، وتحتاج إلى مراجعة قانونية قبل نشر أي نسخة مُلزِمة.",
  ack: "إقرار",
  ackP: "بتوقيعه أدناه يقرّ الشريك بأنّه اطّلع على هذا الدليل التشغيلي وفهم مضمونه. هذا الدليل وثيقة تشغيلية توضيحية وليس عقدًا مُلزِمًا.",
  parties: ["عن درب", "الشريك: {{partner_name}}"],
  disclaimer: "وثيقة داخلية صادرة عن درب. القيم المالية الواردة فيها تعكس إعدادات النظام بتاريخ {{date}} وقد تتغيّر بقرار من الإدارة.",
  legalTitle: "يتطلّب مراجعة قانونية",
};

export const PARTNER_GUIDE_AR: DocBlock[] = build("ar", AR);

export const PARTNER_GUIDE_SEED = [
  {
    slug: "partner-operations-guide-ar",
    title: "دليل عمل الشريك",
    subtitle: "درب — دليل تشغيلي رسمي للشركاء",
    description: "دليل شامل للشركاء: الدور، الإحالة، العمولات، فترة التثبيت، والمدفوعات.",
    category: "partners",
    doc_kind: "guide" as const,
    language: "ar" as const,
    content: PARTNER_GUIDE_AR,
  },
];
