/**
 * Heidelberg city presentation (/heidelberg).
 *
 * Every fact carries the official page it was taken from and the date it was
 * checked. Every photo carries its Wikimedia Commons author + licence. Sources
 * and credits are intentionally NOT rendered on the page (owner's request for a
 * cleaner look); they are kept here for compliance and future review.
 *
 * TODO_VERIFY (left out of the page until confirmed on an official source):
 * - University Library total volumes (brief says ~3.2 million).
 * - Universitätsklinikum yearly outpatient visits (brief says >1 million) and
 *   Medical International Office contact details.
 * - Pädagogische Hochschule student count (~4,200) and city-wide total of
 *   ~39,000 students across ten institutions.
 * - Castle founding date, height above Old Town (~80 m); Alte Brücke year (1788);
 *   Hauptstraße length (~2 km).
 * - Walking/tram distances from the Old Town to Neuenheimer Feld, the hospital
 *   and Hauptbahnhof (distance chips skipped for now).
 * - A verifiable Arab students' association in Heidelberg (none confirmed).
 * - Typical private WG rents and a full monthly living-cost breakdown.
 */
import hero from "@/assets/heidelberg/hero.webp.asset.json";
import uniplatz from "@/assets/heidelberg/uniplatz.webp.asset.json";
import altebruecke from "@/assets/heidelberg/altebruecke.webp.asset.json";
import schloss from "@/assets/heidelberg/schloss.webp.asset.json";
import bergbahn from "@/assets/heidelberg/bergbahn.webp.asset.json";
import marktplatz from "@/assets/heidelberg/marktplatz.webp.asset.json";
import hauptstrasse from "@/assets/heidelberg/hauptstrasse.webp.asset.json";
import infPanorama from "@/assets/heidelberg/inf-panorama.webp.asset.json";
import infCampus from "@/assets/heidelberg/inf-campus.webp.asset.json";
import chirurgie from "@/assets/heidelberg/chirurgie.webp.asset.json";
import krehl from "@/assets/heidelberg/krehl.webp.asset.json";
import ub from "@/assets/heidelberg/ub.webp.asset.json";
import ubInfo from "@/assets/heidelberg/ub-info.webp.asset.json";
import altstadt from "@/assets/heidelberg/altstadt.webp.asset.json";
import bismarckplatz from "@/assets/heidelberg/bismarckplatz.webp.asset.json";
import neckarwiese from "@/assets/heidelberg/neckarwiese.webp.asset.json";
import philosophenweg from "@/assets/heidelberg/philosophenweg.webp.asset.json";
import koenigstuhl from "@/assets/heidelberg/koenigstuhl.webp.asset.json";

export type Lang = "ar" | "en" | "he";
export type L10n = Record<Lang, string>;

export const HEIDELBERG_VERIFIED_AT = "2026-10-03";

export interface HeidelbergPhoto {
  url: string;
  alt: L10n;
  file: string;
  author: string;
  license: string;
  sourceUrl: string;
}

const commons = (file: string) =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`;

const photo = (url: string, file: string, author: string, license: string, alt: L10n): HeidelbergPhoto => ({
  url,
  file,
  author,
  license,
  sourceUrl: commons(file),
  alt,
});

export const HEIDELBERG_HERO = photo(
  hero.url,
  "View of Heidelberg Castle, Alte Brücke, and Altstadt from the northwest.jpg",
  "Eugene Alvin Villar (seav)",
  "CC BY-SA 4.0",
  {
    ar: "قلعة هايدلبرغ والجسر القديم والبلدة القديمة على نهر النيكار",
    en: "Heidelberg Castle, the Old Bridge and the Old Town on the Neckar",
    he: "טירת היידלברג, הגשר הישן והעיר העתיקה על נהר הנקר",
  },
);

export interface HeidelbergFact {
  value: string;
  label: L10n;
}

export interface HeidelbergSection {
  id: string;
  nav: L10n;
  title: L10n;
  body: L10n;
  /** Optional bullet list (landmarks, sports, activities). */
  items?: Array<{ name: string; text: L10n }>;
  facts: HeidelbergFact[];
  photos: HeidelbergPhoto[];
  sources: Array<{ url: string; verifiedAt: string }>;
}

const V = HEIDELBERG_VERIFIED_AT;

export const HEIDELBERG_SECTIONS: HeidelbergSection[] = [
  {
    id: "why",
    nav: { ar: "لماذا هايدلبرغ", en: "Why Heidelberg", he: "למה היידלברג" },
    title: { ar: "لماذا هايدلبرغ؟", en: "Why Heidelberg?", he: "למה היידלברג?" },
    body: {
      ar: "هايدلبرغ مدينة جامعية بامتياز: جامعتها Ruprecht-Karls-Universität هي أقدم جامعة في ألمانيا، تأسست عام 1386. المدينة صغيرة وآمنة ويمكن التنقل فيها بالدراجة أو الترام، وطالب من كل خمسة تقريبًا في الجامعة طالب دولي، فلن تشعر بأنك غريب.",
      en: "Heidelberg is a true university town. Ruprecht-Karls-Universität, founded in 1386, is Germany's oldest university. The city is compact and easy to get around by bike or tram, and about one in five university students is international, so you won't feel out of place.",
      he: "היידלברג היא עיר סטודנטים אמיתית. אוניברסיטת Ruprecht-Karls, שנוסדה ב-1386, היא האוניברסיטה הוותיקה ביותר בגרמניה. העיר קומפקטית וקל לנוע בה באופניים או בחשמלית, וכחמישית מהסטודנטים באוניברסיטה הם בינלאומיים.",
    },
    facts: [
      { value: "1386", label: { ar: "سنة تأسيس الجامعة", en: "University founded", he: "שנת ייסוד האוניברסיטה" } },
      { value: "32,178", label: { ar: "طالب (شتاء 2025/26)", en: "Students (winter 2025/26)", he: "סטודנטים (חורף 2025/26)" } },
      { value: "6,633", label: { ar: "طالب دولي (20.6%)", en: "International students (20.6%)", he: "סטודנטים בינלאומיים (20.6%)" } },
      { value: "196", label: { ar: "برنامج دراسي (صيف 2026)", en: "Degree programmes (summer 2026)", he: "תוכניות לימוד (קיץ 2026)" } },
    ],
    photos: [
      photo(uniplatz.url, "Heidelberg - Hauptstraße - Universitätsplatz.jpg", "Txllxt TxllxT", "CC BY-SA 4.0", {
        ar: "ساحة الجامعة Universitätsplatz في البلدة القديمة",
        en: "Universitätsplatz in the Old Town",
        he: "כיכר האוניברסיטה בעיר העתיקה",
      }),
      photo(altebruecke.url, "20230315 Alte Brücke Heidelberg 01.jpg", "Flocci Nivis", "CC BY 4.0", {
        ar: "الجسر القديم Alte Brücke فوق نهر النيكار",
        en: "The Alte Brücke over the Neckar",
        he: "הגשר הישן מעל הנקר",
      }),
    ],
    sources: [{ url: "https://www.uni-heidelberg.de/de/universitaet/daten-fakten/studierende-wissenschaftlicher-nachwuchs", verifiedAt: V }],
  },
  {
    id: "landmarks",
    nav: { ar: "المعالم", en: "Landmarks", he: "אתרים" },
    title: { ar: "معالم ستراها كل يوم", en: "Landmarks you'll pass every day", he: "אתרים שתעברו לידם כל יום" },
    body: {
      ar: "البلدة القديمة Altstadt هي قلب المدينة: قلعة على سفح الجبل، جسر حجري فوق النهر، وشارع مشاة طويل مليء بالمقاهي والمكتبات. معظم هذه الأماكن على بعد دقائق مشيًا من مباني الجامعة القديمة.",
      en: "The Altstadt (Old Town) is the heart of the city: a castle on the hillside, a stone bridge over the river and a long pedestrian street full of cafés and bookshops. Most of it is a few minutes' walk from the old university buildings.",
      he: "העיר העתיקה (Altstadt) היא לב העיר: טירה על צלע ההר, גשר אבן מעל הנהר ורחוב הולכי רגל ארוך מלא בתי קפה וחנויות ספרים.",
    },
    items: [
      { name: "Heidelberger Schloss", text: { ar: "قلعة هايدلبرغ فوق البلدة القديمة، ويمكن الصعود إليها بالقطار الجبلي Bergbahn، وفي داخلها متحف الصيدلة الألماني.", en: "The castle above the Old Town, reachable by the Bergbahn funicular; the German Pharmacy Museum is inside.", he: "הטירה מעל העיר העתיקה, נגישה ברכבל Bergbahn; בתוכה מוזיאון הרוקחות הגרמני." } },
      { name: "Alte Brücke", text: { ar: "الجسر القديم (جسر كارل تيودور) فوق نهر النيكار، أشهر منظر في المدينة.", en: "The Old Bridge (Karl-Theodor-Brücke) over the Neckar, the city's best-known view.", he: "הגשר הישן (Karl-Theodor-Brücke) מעל הנקר, הנוף המוכר ביותר בעיר." } },
      { name: "Hauptstraße", text: { ar: "الشارع الرئيسي للمشاة عبر البلدة القديمة.", en: "The main pedestrian street through the Old Town.", he: "רחוב הולכי הרגל הראשי של העיר העתיקה." } },
      { name: "Marktplatz & Heiliggeistkirche", text: { ar: "ساحة السوق وكنيسة الروح القدس، مكان لقاء الطلاب.", en: "The market square and Church of the Holy Spirit, a common meeting point.", he: "כיכר השוק וכנסיית רוח הקודש, נקודת מפגש מוכרת." } },
      { name: "Philosophenweg", text: { ar: "\"درب الفلاسفة\" على الضفة الأخرى من النهر، مع إطلالة على القلعة والبلدة القديمة.", en: "The Philosophers' Walk across the river, with views over the castle and Old Town.", he: "שביל הפילוסופים מעבר לנהר, עם תצפית על הטירה והעיר העתיקה." } },
    ],
    facts: [],
    photos: [
      photo(schloss.url, "Heidelberg Castle from the Old Bridge.jpg", "Eugene Alvin Villar (seav)", "CC BY-SA 4.0", {
        ar: "قلعة هايدلبرغ من الجسر القديم", en: "Heidelberg Castle from the Old Bridge", he: "טירת היידלברג מהגשר הישן",
      }),
      photo(bergbahn.url, "Bergbahn Heidelberg.jpg", "Immanuel Giel", "Public domain", {
        ar: "القطار الجبلي Bergbahn إلى القلعة", en: "The Bergbahn funicular to the castle", he: "רכבל Bergbahn לטירה",
      }),
      photo(marktplatz.url, "Marktplatz (Heidelberg).jpg", "Maksym Kozlenko", "CC BY-SA 4.0", {
        ar: "ساحة السوق Marktplatz", en: "Marktplatz", he: "כיכר השוק",
      }),
      photo(hauptstrasse.url, "Heidelberg - Hauptstraße - View West.jpg", "Txllxt TxllxT", "CC BY-SA 4.0", {
        ar: "شارع المشاة Hauptstraße", en: "Hauptstraße pedestrian street", he: "רחוב Hauptstraße",
      }),
    ],
    sources: [{ url: "https://visit.heidelberg.de/en", verifiedAt: V }],
  },
  {
    id: "universities",
    nav: { ar: "الجامعات", en: "Universities", he: "אוניברסיטאות" },
    title: { ar: "الجامعات والحرم الجامعي", en: "Universities and campuses", he: "אוניברסיטאות וקמפוסים" },
    body: {
      ar: "إلى جانب جامعة هايدلبرغ توجد في المدينة Pädagogische Hochschule (كلية التربية) وSRH Hochschule Heidelberg (جامعة خاصة) وHochschule für Jüdische Studien. للجامعة ثلاثة أحرام: البلدة القديمة Altstadt، وBergheim، وNeuenheimer Feld وهو الحرم العلمي شمال النهر حيث الطب والعلوم الطبيعية.",
      en: "Besides Heidelberg University, the city has the Pädagogische Hochschule (University of Education), SRH Hochschule Heidelberg (private) and the Hochschule für Jüdische Studien. The university has three campuses: the Old Town (Altstadt), Bergheim and Neuenheimer Feld, the science campus north of the river where medicine and the natural sciences are based.",
      he: "מלבד אוניברסיטת היידלברג יש בעיר את Pädagogische Hochschule (מכללה לחינוך), SRH Hochschule Heidelberg (פרטית) ואת Hochschule für Jüdische Studien. לאוניברסיטה שלושה קמפוסים: העיר העתיקה, Bergheim ו-Neuenheimer Feld לרפואה ולמדעי הטבע.",
    },
    facts: [
      { value: "3", label: { ar: "أحرام: Altstadt · Bergheim · Neuenheimer Feld", en: "Campuses: Altstadt · Bergheim · Neuenheimer Feld", he: "קמפוסים: Altstadt · Bergheim · Neuenheimer Feld" } },
      { value: "189.80 €", label: { ar: "رسوم الفصل (شتاء 2026/27)", en: "Semester fee (winter 2026/27)", he: "דמי סמסטר (חורף 2026/27)" } },
      { value: "1,500 €", label: { ar: "رسوم دراسية لكثير من الطلاب من خارج الاتحاد الأوروبي لكل فصل", en: "Tuition per semester for many non-EU students", he: "שכר לימוד לסמסטר לרבים מחוץ לאיחוד" } },
    ],
    photos: [
      photo(infPanorama.url, "Neuenheimer Feld from Schloss-Wolfsbrunnenweg.jpg", "R. J. Mathar", "CC0", {
        ar: "الحرم العلمي Neuenheimer Feld من بعيد", en: "The Neuenheimer Feld science campus from afar", he: "קמפוס Neuenheimer Feld ממרחק",
      }),
      photo(infCampus.url, "GER Heidelberg, Im Neuenheimer Feld 001.jpg", "-wuppertaler", "CC BY-SA 4.0", {
        ar: "مبانٍ في حرم Neuenheimer Feld", en: "Buildings on the Neuenheimer Feld campus", he: "בניינים בקמפוס Neuenheimer Feld",
      }),
    ],
    sources: [
      { url: "https://www.uni-heidelberg.de/de/studium/studienorganisation/beitraege-gebuehren/studienbeitraege", verifiedAt: V },
      { url: "https://www.stura.uni-heidelberg.de/finanzen/semesterbeitrag/", verifiedAt: V },
    ],
  },
  {
    id: "health",
    nav: { ar: "الصحة", en: "Healthcare", he: "בריאות" },
    title: { ar: "المستشفى والتأمين الصحي", en: "Hospital and health insurance", he: "בית חולים וביטוח בריאות" },
    body: {
      ar: "المستشفى الجامعي Universitätsklinikum Heidelberg يقع في Im Neuenheimer Feld 672, 69120 Heidelberg، بجوار الحرم العلمي. للتسجيل في الجامعة يجب أن تثبت أن لديك تأمينًا صحيًا: إما تأمين حكومي (gesetzliche Krankenversicherung) أو إعفاء منه. فريق درب يساعدك في اختيار التأمين المناسب قبل التسجيل. هذه معلومات تنظيمية وليست نصيحة طبية.",
      en: "Universitätsklinikum Heidelberg is at Im Neuenheimer Feld 672, 69120 Heidelberg, next to the science campus. To enrol you must show proof of health insurance: either statutory insurance (gesetzliche Krankenversicherung) or an exemption from it. The Darb team helps you pick the right option before enrolment. This is practical information, not medical advice.",
      he: "בית החולים האוניברסיטאי נמצא ב-Im Neuenheimer Feld 672, 69120 Heidelberg, ליד קמפוס המדעים. כדי להירשם צריך להציג ביטוח בריאות: ביטוח ציבורי (gesetzliche Krankenversicherung) או פטור ממנו. צוות דארב יעזור לבחור. זה מידע מעשי ולא ייעוץ רפואי.",
    },
    facts: [
      { value: "INF 672", label: { ar: "عنوان المستشفى الجامعي", en: "University hospital address", he: "כתובת בית החולים" } },
    ],
    photos: [
      photo(chirurgie.url, "Neue Chirurgische Klinik Heidelberg.jpg", "Jack7011", "CC BY-SA 4.0", {
        ar: "مبنى الجراحة الجديد في المستشفى الجامعي", en: "The new surgical clinic at the university hospital", he: "המרכז הכירורגי החדש",
      }),
      photo(krehl.url, "Krehl Klinik Universitätsklinikum Heidelberg von Westen.JPG", "3268zauber", "CC BY-SA 3.0", {
        ar: "عيادة Krehl في المستشفى الجامعي", en: "Krehl Klinik, university hospital", he: "מרפאת Krehl",
      }),
    ],
    sources: [{ url: "https://www.klinikum.uni-heidelberg.de/", verifiedAt: V }],
  },
  {
    id: "library",
    nav: { ar: "المكتبة", en: "Library", he: "ספרייה" },
    title: { ar: "المكتبة الجامعية", en: "The University Library", he: "הספרייה האוניברסיטאית" },
    body: {
      ar: "المكتبة الجامعية Universitätsbibliothek هي أقدم مكتبة جامعية في ألمانيا. قاعة القراءة في البلدة القديمة مفتوحة يوميًا من 8:30 صباحًا حتى 1:00 بعد منتصف الليل. لا تحتاج بطاقة منفصلة: بطاقة الطالب هي نفسها بطاقة المكتبة، وتفعّلها أونلاين بعد تفعيل حسابك الجامعي Uni-ID.",
      en: "The Universitätsbibliothek is Germany's oldest university library. The Old Town reading room is open every day from 8:30 to 1:00 at night. You don't need a separate card: your student ID is your library card, and you activate it online once your Uni-ID is active.",
      he: "Universitätsbibliothek היא הספרייה האוניברסיטאית הוותיקה בגרמניה. אולם הקריאה בעיר העתיקה פתוח כל יום מ-8:30 עד 1:00 בלילה. כרטיס הסטודנט הוא גם כרטיס הספרייה, ומפעילים אותו אונליין אחרי הפעלת ה-Uni-ID.",
    },
    facts: [
      { value: "8:30–1:00", label: { ar: "قاعة القراءة، يوميًا", en: "Reading room, daily", he: "אולם קריאה, כל יום" } },
      { value: "Mo–Fr 9–20", label: { ar: "الإعارة (السبت 13–17)", en: "Lending desk (Sat 13–17)", he: "השאלה (שבת 13–17)" } },
    ],
    photos: [
      photo(ub.url, "Heidelberg Universitätsbibliothek 2003.jpg", "Jan Beckendorf", "CC BY-SA 2.0", {
        ar: "مبنى المكتبة الجامعية في هايدلبرغ", en: "Heidelberg University Library building", he: "בניין הספרייה האוניברסיטאית",
      }),
      photo(ubInfo.url, "Infocenter Heidelberg Universitätsbibliothek P1100117.jpg", "Ribax", "CC BY 4.0", {
        ar: "مركز المعلومات داخل المكتبة", en: "Information centre inside the library", he: "מרכז המידע בספרייה",
      }),
    ],
    sources: [
      { url: "https://www.ub.uni-heidelberg.de/de/ueber-uns/ihre-ub/oeffnungszeiten", verifiedAt: V },
      { url: "https://www.ub.uni-heidelberg.de/de/service/ausleihe/anmeldung-und-nutzerkonto", verifiedAt: V },
    ],
  },
  {
    id: "housing",
    nav: { ar: "السكن والتكاليف", en: "Housing & costs", he: "מגורים ועלויות" },
    title: { ar: "السكن وتكاليف المعيشة", en: "Housing and cost of living", he: "מגורים ויוקר המחיה" },
    body: {
      ar: "سوق السكن في هايدلبرغ مزدحم جدًا. سكن الطلاب Wohnheim يديره Studierendenwerk Heidelberg (اتحاد خدمات الطلاب) وليس الجامعة، والقبول الجامعي لا يضمن لك غرفة. قدّم طلب السكن مبكرًا، حتى قبل أن يصلك القبول. البديل هو غرفة في شقة مشتركة WG في السوق الخاص، وكثير من الطلاب يسكنون في البلدات القريبة على خط الترام.",
      en: "Heidelberg's housing market is very tight. Dorms (Wohnheime) are run by the Studierendenwerk Heidelberg (student services), not the university, and admission does not guarantee a room. Apply early, even before your admission letter arrives. The alternative is a room in a shared flat (WG) on the private market, and many students live in nearby towns on a tram line.",
      he: "שוק הדיור בהיידלברג צפוף מאוד. המעונות מנוהלים על ידי Studierendenwerk Heidelberg ולא על ידי האוניברסיטה, וקבלה ללימודים לא מבטיחה חדר. הגישו בקשה מוקדם. החלופה היא חדר בדירה משותפת (WG).",
    },
    facts: [
      { value: "992 €", label: { ar: "الحد الأدنى للمعيشة للتأشيرة (صيف 2026)", en: "Visa minimum per month (summer 2026)", he: "מינימום לחודש לוויזה (קיץ 2026)" } },
      { value: "243–797 €", label: { ar: "إيجار سكن الطلاب شهريًا حسب السكن", en: "Dorm rent per month, depending on dorm", he: "שכר דירה במעונות לחודש" } },
    ],
    photos: [
      photo(altstadt.url, "Hauptstraße near Akademiestraße (Heidelberg), Sep 2019.jpg", "Eugene Alvin Villar (seav)", "CC BY-SA 4.0", {
        ar: "شارع سكني في البلدة القديمة", en: "A street in the Old Town", he: "רחוב בעיר העתיקה",
      }),
    ],
    sources: [
      { url: "https://www.stw.uni-heidelberg.de/wohnen/wohnheime/", verifiedAt: V },
      { url: "https://www.stw.uni-heidelberg.de/international/wohnheimbewerbung/", verifiedAt: V },
      { url: "https://www.uni-heidelberg.de/de/studienfinanzierung-fuer-internationale-studierende", verifiedAt: V },
      { url: "https://www.stura.uni-heidelberg.de/faqs/", verifiedAt: V },
    ],
  },
  {
    id: "transport",
    nav: { ar: "المواصلات", en: "Getting around", he: "תחבורה" },
    title: { ar: "التنقل في المدينة", en: "Getting around", he: "להתנייד בעיר" },
    body: {
      ar: "الترام والباص في هايدلبرغ جزء من شبكة VRN. تذكرة الفصل القديمة Semesterticket لم تعد موجودة في جامعة هايدلبرغ. البديل للطلاب تحت 27 عامًا هو D-Ticket JugendBW: اشتراك سنوي صالح لكل المواصلات المحلية في ألمانيا. ومن هم فوق 27 يستخدمون Deutschlandticket العادي. ورسوم الفصل تشمل أيضًا اشتراكًا في دراجات nextbike.",
      en: "Trams and buses in Heidelberg are part of the VRN network. The old Semesterticket no longer exists at Heidelberg University. Students under 27 can get the D-Ticket JugendBW, a yearly subscription valid on all local transport in Germany. Students over 27 use the regular Deutschlandticket. The semester fee also includes a nextbike bike-share contribution.",
      he: "החשמליות והאוטובוסים הם חלק מרשת VRN. ה-Semesterticket הישן כבר לא קיים באוניברסיטת היידלברג. סטודנטים מתחת לגיל 27 יכולים לקנות D-Ticket JugendBW, מנוי שנתי לכל התחבורה המקומית בגרמניה. מעל גיל 27 משתמשים ב-Deutschlandticket הרגיל.",
    },
    facts: [
      { value: "44.42 €", label: { ar: "D-Ticket JugendBW شهريًا من 1/2026 (تحت 27)", en: "D-Ticket JugendBW per month from Jan 2026 (under 27)", he: "D-Ticket JugendBW לחודש מינואר 2026 (מתחת ל-27)" } },
    ],
    photos: [
      photo(bismarckplatz.url, "Bismarckplatz looking towards Hauptstraße (Heidelberg), Sep 2019 - 1.jpg", "Eugene Alvin Villar (seav)", "CC BY-SA 4.0", {
        ar: "ساحة Bismarckplatz، محطة الترام الرئيسية", en: "Bismarckplatz, the main tram hub", he: "Bismarckplatz, צומת החשמליות המרכזי",
      }),
    ],
    sources: [
      { url: "https://www.stura.uni-heidelberg.de/angebote/semesterticket/", verifiedAt: V },
      { url: "https://www.ph-heidelberg.de/campus/heidelberg/wohnen-in-heidelberg/oepnv-tickets.html", verifiedAt: V },
    ],
  },
  {
    id: "sports",
    nav: { ar: "الرياضة", en: "Sports", he: "ספורט" },
    title: { ar: "الرياضة وكرة القدم", en: "Sports and football", he: "ספורט וכדורגל" },
    body: {
      ar: "قسم الرياضة الجامعية Hochschulsport يقدّم لطلاب الجامعة كرة القدم واللياقة والفنون القتالية واليوغا، وحتى التجديف وقوفًا SUP على نهر النيكار. الدورات التي تحتاج تسجيلًا تحجزها عبر نظام التسجيل الإلكتروني في بداية الفصل.",
      en: "University sports (Hochschulsport) offers football, fitness, martial arts, yoga and even stand-up paddling on the Neckar. Courses that need registration are booked through the online sign-up system at the start of each semester.",
      he: "ספורט אוניברסיטאי (Hochschulsport) מציע כדורגל, כושר, אומנויות לחימה, יוגה ואפילו חתירת SUP על הנקר. נרשמים לקורסים במערכת המקוונת בתחילת הסמסטר.",
    },
    items: [
      { name: "TSG Hoffenheim", text: { ar: "رحلة يوم: الفريق يلعب في Sinsheim، ليس في هايدلبرغ.", en: "Day trip: the club plays in Sinsheim, not in Heidelberg.", he: "טיול יום: הקבוצה משחקת ב-Sinsheim, לא בהיידלברג." } },
      { name: "SV Sandhausen", text: { ar: "نادٍ قريب في بلدة Sandhausen جنوب هايدلبرغ.", en: "A nearby club in Sandhausen, just south of Heidelberg.", he: "קבוצה קרובה ב-Sandhausen, דרומית להיידלברג." } },
    ],
    facts: [],
    photos: [
      photo(neckarwiese.url, "Die Neckarwiese Heidelberg Neuenheim BILD0973.jpg", "Ribax", "CC BY-SA 4.0", {
        ar: "مرج النيكار Neckarwiese، مكان الرياضة والنزهات", en: "The Neckarwiese, a favourite spot for sports and picnics", he: "Neckarwiese, מקום לספורט ופיקניקים",
      }),
    ],
    sources: [
      { url: "https://www.hochschulsport.uni-heidelberg.de/de", verifiedAt: V },
      { url: "https://onlineanmeldung.hochschulsport.uni-heidelberg.de/oa_oeff/index.php", verifiedAt: V },
    ],
  },
  {
    id: "life",
    nav: { ar: "حياة الطلاب", en: "Student life", he: "חיי סטודנטים" },
    title: { ar: "الأنشطة وحياة الطلاب", en: "Activities and student life", he: "פעילויות וחיי סטודנטים" },
    body: {
      ar: "في الصيف يجتمع الطلاب على ضفة النيكار Neckarwiese. للمشي هناك Philosophenweg، وللإطلالة جبل Königstuhl فوق القلعة. يدير Studierendenwerk مطاعم الطلاب Mensa بأسعار مخفّضة، ورسوم الفصل تشمل اشتراكًا في المسرح (Theaterflatrate). المكتب الدولي في الجامعة يربط الطلاب الجدد ببرامج المرافقة والأنشطة.",
      en: "In summer, students gather on the Neckarwiese by the river. Walk the Philosophenweg, or go up the Königstuhl above the castle for the view. The Studierendenwerk runs subsidised student canteens (Mensa), and the semester fee includes a theatre flat rate (Theaterflatrate). The university's international office connects new students with buddy and welcome programmes.",
      he: "בקיץ הסטודנטים מתאספים ב-Neckarwiese על גדת הנהר. אפשר ללכת ב-Philosophenweg או לעלות להר Königstuhl. ה-Studierendenwerk מפעיל מסעדות סטודנטים (Mensa) מסובסדות, ודמי הסמסטר כוללים מנוי תיאטרון.",
    },
    facts: [],
    photos: [
      photo(philosophenweg.url, "Heidelberg Philosophenweg Luftbild (cropped).JPG", "Schlurcher", "CC BY 4.0", {
        ar: "منظر جوي لدرب الفلاسفة Philosophenweg", en: "Aerial view of the Philosophenweg", he: "מבט אווירי על שביל הפילוסופים",
      }),
      photo(koenigstuhl.url, "20230315 Königstuhl Odenwald.jpg", "Flocci Nivis", "CC BY 4.0", {
        ar: "جبل Königstuhl فوق هايدلبرغ", en: "The Königstuhl above Heidelberg", he: "הר Königstuhl מעל היידלברג",
      }),
    ],
    sources: [{ url: "https://www.uni-heidelberg.de/de/studium/studienorganisation/beitraege-gebuehren/studienbeitraege", verifiedAt: V }],
  },
];

export const HEIDELBERG_COPY = {
  heroTitle: { ar: "تعرّف على هايدلبرغ", en: "Get to know Heidelberg", he: "הכירו את היידלברג" },
  heroSubtitle: {
    ar: "دليلك كطالب: أين ستدرس، أين ستسكن، كيف تتنقل وكيف تعيش حياتك الطلابية في هايدلبرغ.",
    en: "Your student guide: where you'll study, live, get around and enjoy student life in Heidelberg.",
    he: "המדריך שלך כסטודנט: איפה תלמד, תגור, תתנייד ותחיה בהיידלברג.",
  },
  ctaTitle: { ar: "ابدأ تقييم ملفك للدراسة في هايدلبرغ", en: "Start your Heidelberg study assessment", he: "התחילו הערכת תיק ללימודים בהיידלברג" },
  ctaBody: {
    ar: "فريق درب يراجع ملفك ويتواصل معك خلال 24 ساعة.",
    en: "The Darb team reviews your profile and contacts you within 24 hours.",
    he: "צוות דארב יבדוק את התיק ויחזור אליכם תוך 24 שעות.",
  },
  ctaButton: { ar: "ابدأ التقييم", en: "Start assessment", he: "התחילו הערכה" },
  sectionsLabel: { ar: "أقسام الصفحة", en: "Page sections", he: "חלקי העמוד" },
} satisfies Record<string, L10n>;

export const HEIDELBERG_SEO = {
  title: "تعرّف على هايدلبرغ | دليل الطالب من درب",
  description:
    "دليل الطالب للتعرّف على هايدلبرغ: الجامعات، المستشفى الجامعي، المكتبة، السكن، المواصلات والرياضة وحياة الطلاب. مع درب للتعليم الدولي.",
};
