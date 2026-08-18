/**
 * Seed content for the DARB Student Service Agreement (version 1.0).
 *
 * A `contract` (not a guide) — the student-facing service agreement. The
 * student's name appears as the `{{student_name}}` token (left unresolved until
 * a recipient context is supplied at preview/print time). Clauses with legal
 * exposure are `legal` callouts — no invented contractual language.
 */
import type { DocBlock } from "@/lib/documentBlocks";
import { blockIdFactory } from "./seedBlockHelpers";

interface StudentAgreementStrings {
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
  s4list: string[];
  s5: string;
  s5p: string;
  s5tableHead: string[];
  s5rows: string[][];
  s6: string;
  s6p: string;
  s6calloutLegal: string;
  s7: string;
  s7p: string;
  s7list: string[];
  s8: string;
  s8legal: string;
  ack: string;
  ackP: string;
  parties: string[];
  disclaimer: string;
  legalTitle: string;
}


function build(lang: string, s: StudentAgreementStrings): DocBlock[] {
  const B = blockIdFactory("sa", lang);
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
    { id: B(), type: "list", items: s.s4list },

    { id: B(), type: "heading", level: 1, text: s.s5 },
    { id: B(), type: "paragraph", text: s.s5p },
    { id: B(), type: "table", headers: s.s5tableHead, rows: s.s5rows },

    { id: B(), type: "heading", level: 1, text: s.s6 },
    { id: B(), type: "paragraph", text: s.s6p },
    { id: B(), type: "callout", tone: "legal", title: s.legalTitle, text: s.s6calloutLegal },

    { id: B(), type: "heading", level: 1, text: s.s7 },
    { id: B(), type: "paragraph", text: s.s7p },
    { id: B(), type: "list", items: s.s7list },

    { id: B(), type: "heading", level: 1, text: s.s8 },
    { id: B(), type: "callout", tone: "legal", title: s.legalTitle, text: s.s8legal },

    { id: B(), type: "heading", level: 1, text: s.ack },
    { id: B(), type: "paragraph", text: s.ackP },
    { id: B(), type: "signature", parties: s.parties },
    { id: B(), type: "disclaimer", text: s.disclaimer },
  ];
}

const AR: StudentAgreementStrings = {
  coverTitle: "اتفاقية خدمات الطلاب",
  coverSubtitle: "درب — اتفاقية خدمات بين درب والطالب",
  coverNote: "الإصدار {{version}} · تاريخ السريان {{effective_date}}",
  s1: "عن درب",
  s1p: "درب وكالة متخصّصة بمرافقة الطلاب من مرحلة الاستفسار وحتى التسجيل والوصول إلى ألمانيا: اختيار مدرسة اللغة والبرنامج، تجهيز الملف، السكن، التأمين، ومتابعة إجراءات التأشيرة.",
  s2: "الأطراف",
  s2p: "يتوقّع هذا الاتفاق بين درب والطالب: {{student_name}}.",
  s3: "نطاق الخدمات",
  s3list: [
    "استشارة أولية واختيار البرنامج ومدرسة اللغة المناسبة.",
    "تجهيز ملف التقديم ومتابعته.",
    "الإرشاد حول السكن والتأمين وإجراءات التأشيرة.",
    "متابعة الحالة عبر منصّة درب حتى التسجيل.",
  ],
  s4: "مسؤوليات الطالب",
  s4p: "يلتزم الطالب بما يلي:",
  s4list: [
    "تقديم معلومات ومستندات صحيحة وكاملة.",
    "الالتزام بالتعليمات والمواعيد المحدّدة.",
    "سداد رسوم الخدمة المقرّرة في أوقاتها.",
    "التواصل مع درب عبر القنوات الرسمية فقط.",
  ],
  s5: "الرسوم",
  s5p: "تُحدّد رسوم الخدمة وفق البرنامج المختار وتُدفع وفق المراحل المبيّنة في لوحة الطالب. القيم المالية تعكس إعدادات النظام الفعليّة.",
  s5tableHead: ["المرحلة", "الوصف"],
  s5rows: [
    ["رسوم الخدمة", "تُدفع عند تأكيد التسجيل"],
    ["الدفعات الأخرى", "وفق الجدول الزمني للبرنامج"],
  ],
  s6: "الإلغاء والاسترداد",
  s6p: "المبدأ التشغيلي: تُربط الرسوم بالمراحل المؤكّدة، وأي إلغاء ينعكس على الرسوم المرتبطة به.",
  s6calloutLegal: "الصياغة التفصيلية لحالات الإلغاء والاسترداد وآثارها على الرسوم المدفوعة تحتاج إلى مراجعة قانونية قبل الاعتماد النهائي.",
  s7: "الخصوصية",
  s7p: "تتعامل درب مع بيانات الطالب بسرّية تامّة وفق سياسة الخصوصية المعتمدة، ولا تُشارك خارج النطاق اللازم لتقديم الخدمة.",
  s7list: [
    "لا تُشارك بيانات الطالب مع أطراف ثالثة دون موافقة.",
    "يحقّ للطالب طلب تعديل أو حذف بياناته وفق السياسة.",
  ],
  s8: "إنهاء الاتفاق والاختصاص القضائي",
  s8legal: "بنود إنهاء الاتفاق، وحدود المسؤولية، والقانون الواجب التطبيق، والاختصاص القضائي لم تُصَغ في هذا الإصدار، وتحتاج إلى مراجعة قانونية قبل نشر أي نسخة مُلزِمة.",
  ack: "إقرار وتوقيع",
  ackP: "بتوقيعه أدناه يقرّ الطالب بأنّه اطّلع على هذه الاتفاقية وفهم مضمونها، وأنّ المعلومات المقدّمة صحيحة.",
  parties: ["عن درب", "الطالب: {{student_name}}"],
  disclaimer: "هذه الاتفاقية وثيقة صادرة عن درب. القيم المالية الواردة فيها تعكس إعدادات النظام بتاريخ {{date}} وقد تتغيّر. الصياغة القانونية النهائية تخضع لمراجعة قانونية قبل النشر.",
  legalTitle: "يتطلّب مراجعة قانونية",
};

export const STUDENT_AGREEMENT_AR: DocBlock[] = build("ar", AR);

export const STUDENT_AGREEMENT_SEED = [
  {
    slug: "student-service-agreement-ar",
    title: "اتفاقية خدمات الطلاب",
    subtitle: "درب — اتفاقية خدمات بين درب والطالب",
    description: "اتفاقية الخدمات بين درب والطالب: النطاق، المسؤوليات، الرسوم، الخصوصية، والإلغاء.",
    category: "students",
    doc_kind: "contract" as const,
    language: "ar" as const,
    content: STUDENT_AGREEMENT_AR,
  },
];
