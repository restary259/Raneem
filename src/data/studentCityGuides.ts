import heidelbergImage from "@/assets/destinations/heidelberg.jpg";
import regensburgImage from "@/assets/destinations/regensburg.jpg";

export type StudentCityGuideCategory =
  | "all"
  | "supermarkets"
  | "accommodation"
  | "school"
  | "gyms"
  | "transport"
  | "healthcare"
  | "football"
  | "cinema"
  | "studentLife"
  | "pharmacy";

export interface StudentCityGuideLocation {
  id: string;
  category: Exclude<StudentCityGuideCategory, "all">;
  nameEn: string;
  nameAr: string;
  nameHe: string;
  address?: string;
  mapQuery: string;
  /** Official provider/tourism page, shown as a separate action from the map link. */
  websiteUrl?: string;
  imageUrl?: string;
  primary?: boolean;
  descriptionEn?: string;
  descriptionAr?: string;
  descriptionHe?: string;
  /** Draft DARB team tips — pending team review. */
  tipEn?: string;
  tipAr?: string;
  tipHe?: string;
}

export interface StudentCityGuideConfig {
  id: "heidelberg" | "regensburg";
  nameEn: string;
  nameAr: string;
  nameHe: string;
  regionEn: string;
  regionAr: string;
  regionHe: string;
  heroImage: string;
  mapQuery: string;
  schoolName: string;
  locations: StudentCityGuideLocation[];
}

export const mapsSearchUrl = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

export const normalizeResidentialCity = (value: string | null | undefined) =>
  (value ?? "")
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");

const isCity = (value: string | null | undefined, city: string) =>
  normalizeResidentialCity(value) === city;

export const isHeidelberg = (value: string | null | undefined) =>
  isCity(value, "heidelberg");

export const isRegensburg = (value: string | null | undefined) =>
  isCity(value, "regensburg");

export const HEIDELBERG_CITY_GUIDE: StudentCityGuideConfig = {
  id: "heidelberg",
  nameEn: "Heidelberg",
  nameAr: "هايدلبرغ",
  nameHe: "היידלברג",
  regionEn: "Baden-Württemberg",
  regionAr: "بادن-فورتمبيرغ",
  regionHe: "באדן-וירטמברג",
  heroImage: heidelbergImage,
  mapQuery: "Heidelberg, Germany",
  schoolName: "F+U Academy of Languages",
  locations: [
    {
      id: "fu-academy",
      tipEn:
        "Arrive 15 min early on day one for the placement test; bring your passport.",
      tipAr:
        "احضر قبل 15 دقيقة في اليوم الأول لامتحان تحديد المستوى، ولا تنسَ جواز السفر.",
      tipHe: "הגיעו 15 דקות מוקדם ביום הראשון למבחן הרמה, עם הדרכון.",
      category: "school",
      nameEn: "F+U Academy of Languages",
      nameAr: "أكاديمية F+U للغات",
      nameHe: "F+U Academy of Languages",
      address: "Hauptstraße 1, 69117 Heidelberg",
      mapQuery:
        "F+U Academy of Languages, Hauptstraße 1, 69117 Heidelberg, Germany",
      imageUrl: "/lovable-uploads/schools/fu-academy/school/campus.jpg",
      primary: true,
    },
    {
      id: "fu-campus",
      tipEn: "Register your address (Anmeldung) within 14 days of moving in.",
      tipAr: "سجّل عنوانك (Anmeldung) خلال 14 يومًا من الانتقال.",
      tipHe: "רשמו את הכתובת (Anmeldung) תוך 14 יום מהמעבר.",
      category: "accommodation",
      nameEn: "F+U Campus Residence",
      nameAr: "سكن F+U Campus",
      nameHe: "מעונות F+U Campus",
      address: "Kurfürsten-Anlage 64–68, 69115 Heidelberg",
      mapQuery:
        "F+U Campus Heidelberg, Kurfürsten-Anlage 64-68, 69115 Heidelberg, Germany",
      imageUrl:
        "/lovable-uploads/schools/fu-academy/accommodations/category-e-bergheim-3.jpg",
      primary: true,
    },
    {
      id: "fu-maerzgasse",
      tipEn:
        "Right in the Old Town: quiet hours start at 10pm, so keep noise low.",
      tipAr: "في قلب المدينة القديمة: ساعات الهدوء تبدأ الساعة 10 مساءً.",
      tipHe: "בלב העיר העתיקה: שעות השקט מתחילות ב-22:00.",
      category: "accommodation",
      nameEn: "F+U Residence — Märzgasse",
      nameAr: "سكن F+U — ميرغاسه",
      nameHe: "מעונות F+U — Märzgasse",
      address: "Heidelberg Old Town",
      mapQuery: "Märzgasse Heidelberg F+U residence",
      imageUrl:
        "/lovable-uploads/schools/fu-academy/accommodations/category-e-maerzgasse-1.jpg",
      primary: true,
    },
    {
      id: "fu-concordia",
      tipEn:
        "A short tram ride to school, so a Deutschlandticket pays off quickly.",
      tipAr:
        "المدرسة قريبة بالترام؛ اشتراك Deutschlandticket يوفّر عليك كثيرًا.",
      tipHe: "נסיעה קצרה בחשמלית לבית הספר, Deutschlandticket משתלם.",
      category: "accommodation",
      nameEn: "F+U Residence — Concordia",
      nameAr: "سكن F+U — كونكورديا",
      nameHe: "מעונות F+U — Concordia",
      address: "Rohrbacher Straße 126, 69126 Heidelberg",
      mapQuery:
        "Concordia F+U, Rohrbacher Straße 126, 69126 Heidelberg, Germany",
      imageUrl:
        "/lovable-uploads/schools/fu-academy/accommodations/category-a-concordia-3.jpg",
    },
    {
      id: "kaufland-weststadt",
      tipEn:
        "The big weekly shop, with a wide range and good prices. Bring your own bags.",
      tipAr: "مناسب للتسوّق الأسبوعي بأسعار جيدة. أحضر أكياسك معك.",
      tipHe: "מתאים לקנייה שבועית במחירים טובים. הביאו שקיות.",
      category: "supermarkets",
      nameEn: "Kaufland Heidelberg-Weststadt",
      nameAr: "Kaufland هايدلبرغ - Weststadt",
      nameHe: "Kaufland Heidelberg-Weststadt",
      address: "Kurfürsten-Anlage 61, 69115 Heidelberg",
      mapQuery:
        "Kaufland Heidelberg-Weststadt, Kurfürsten-Anlage 61, 69115 Heidelberg, Germany",
    },
    {
      id: "lidl-heidelberg",
      tipEn: "Cheapest basics. Check the app for weekly deals.",
      tipAr: "أرخص المواد الأساسية. تابع العروض الأسبوعية في التطبيق.",
      tipHe: "המוצרים הבסיסיים הזולים ביותר. בדקו מבצעים באפליקציה.",
      category: "supermarkets",
      nameEn: "Lidl Heidelberg",
      nameAr: "Lidl هايدلبرغ",
      nameHe: "Lidl Heidelberg",
      mapQuery: "Lidl Heidelberg, Germany",
    },
    {
      id: "rewe-heidelberg",
      tipEn:
        "Open late on most days, so it's good for evening shopping after class.",
      tipAr: "يفتح لوقت متأخر، مناسب للتسوّق بعد الدروس.",
      tipHe: "פתוח עד מאוחר, נוח לקניות אחרי השיעורים.",
      category: "supermarkets",
      nameEn: "REWE Heidelberg",
      nameAr: "REWE هايدلبرغ",
      nameHe: "REWE Heidelberg",
      mapQuery: "REWE Heidelberg, Germany",
    },
    {
      id: "venicebeach-bahnstadt",
      tipEn:
        "Ask about student rates and trial sessions before signing a long contract.",
      tipAr: "اسأل عن أسعار الطلاب والتجربة المجانية قبل توقيع عقد طويل.",
      tipHe: "שאלו על מחירי סטודנטים ואימון ניסיון לפני חוזה ארוך.",
      category: "gyms",
      nameEn: "VeniceBeach Heidelberg Bahnstadt",
      nameAr: "VeniceBeach Heidelberg Bahnstadt",
      nameHe: "VeniceBeach Heidelberg Bahnstadt",
      address: "Speyerer Straße 4+6, 69115 Heidelberg",
      mapQuery:
        "VeniceBeach Heidelberg Bahnstadt, Speyerer Straße 4+6, 69115 Heidelberg, Germany",
    },
    {
      id: "fitbase",
      tipEn:
        "Check the cancellation terms. Many German gyms require 3 months' notice.",
      tipAr: "انتبه لشروط الإلغاء؛ كثير من الصالات تطلب إشعارًا قبل 3 أشهر.",
      tipHe: "בדקו תנאי ביטול, הרבה מכונים דורשים 3 חודשי הודעה.",
      category: "gyms",
      nameEn: "FitBase Heidelberg",
      nameAr: "FitBase Heidelberg",
      nameHe: "FitBase Heidelberg",
      address: "Kurpfalzring 120, 69123 Heidelberg",
      mapQuery:
        "FitBase Heidelberg, Kurpfalzring 120, 69123 Heidelberg, Germany",
    },
    {
      id: "hauptbahnhof",
      tipEn:
        "Validate or show your ticket; inspectors fine people without one on the spot.",
      tipAr: "احمل تذكرة صالحة دائمًا؛ الغرامة فورية عند التفتيش.",
      tipHe: "החזיקו תמיד כרטיס תקף, הקנס מיידי בביקורת.",
      category: "transport",
      nameEn: "Heidelberg Hauptbahnhof",
      nameAr: "محطة هايدلبرغ الرئيسية",
      nameHe: "התחנה המרכזית היידלברג",
      mapQuery: "Heidelberg Hauptbahnhof, Germany",
      primary: true,
    },
    {
      id: "sportzentrum-mitte",
      tipEn: "Good for casual football. Evenings are busy, so go early.",
      tipAr: "مكان جيد لكرة القدم الودية؛ المساء مزدحم فاذهب باكرًا.",
      tipHe: "טוב לכדורגל חובבים; בערב עמוס, בואו מוקדם.",
      category: "football",
      nameEn: "Sportzentrum Mitte",
      nameAr: "Sportzentrum Mitte — ملاعب رياضية",
      nameHe: "Sportzentrum Mitte",
      address: "Rohrbacher Str. 102, 69126 Heidelberg",
      mapQuery:
        "Sportzentrum Mitte, Rohrbacher Str. 102, 69126 Heidelberg, Germany",
    },
    {
      id: "hunters-training",
      tipEn: "Great place to meet locals through team sports.",
      tipAr: "فرصة للتعرّف على السكان المحليين عبر الرياضة الجماعية.",
      tipHe: "הזדמנות להכיר מקומיים דרך ספורט קבוצתי.",
      category: "football",
      nameEn: "Heidelberg Hunters Training Field",
      nameAr: "ملعب تدريب Heidelberg Hunters",
      nameHe: "מגרש האימון Heidelberg Hunters",
      address: "Carl-Bosch-Straße, 69126 Heidelberg",
      mapQuery:
        "Trainingsplatz Heidelberg Hunters, Carl-Bosch-Straße, 69126 Heidelberg, Germany",
    },
    {
      id: "gloria-kino",
      tipEn:
        "Look for OmU screenings: original language with German subtitles, which help your German.",
      tipAr: "ابحث عن عروض OmU: لغة أصلية مع ترجمة ألمانية لتحسين لغتك.",
      tipHe: "חפשו הקרנות OmU: שפת מקור עם כתוביות בגרמנית.",
      category: "cinema",
      nameEn: "Gloria Kino Heidelberg",
      nameAr: "سينما Gloria",
      nameHe: "Gloria Kino Heidelberg",
      address: "Hauptstraße 146, 69117 Heidelberg",
      mapQuery:
        "Gloria Kino Heidelberg, Hauptstraße 146, 69117 Heidelberg, Germany",
    },
    {
      id: "university-hospital",
      tipEn:
        "In an emergency call 112. Carry your insurance card at all times.",
      tipAr: "في الطوارئ اتصل بـ 112، واحمل بطاقة التأمين دائمًا.",
      tipHe: "במקרה חירום חייגו 112, והחזיקו תמיד את כרטיס הביטוח.",
      category: "healthcare",
      nameEn: "University Hospital Heidelberg",
      nameAr: "المستشفى الجامعي في هايدلبرغ",
      nameHe: "בית החולים האוניברסיטאי היידלברג",
      address: "Im Neuenheimer Feld 672, 69120 Heidelberg",
      mapQuery:
        "University Hospital Heidelberg, Im Neuenheimer Feld 672, 69120 Heidelberg, Germany",
    },
    {
      id: "hof-apotheke",
      tipEn:
        "For minor illness, pharmacists can advise you before you see a doctor.",
      tipAr: "للأمراض البسيطة، يمكن للصيدلي نصحك قبل زيارة الطبيب.",
      tipHe: "למחלות קלות, הרוקח יכול לייעץ לפני רופא.",
      category: "pharmacy",
      nameEn: "Hof Apotheke Heidelberg",
      nameAr: "Hof Apotheke هايدلبرغ",
      nameHe: "Hof Apotheke Heidelberg",
      address: "Sofienstraße 11, 69115 Heidelberg",
      mapQuery:
        "Hof Apotheke Heidelberg, Sofienstraße 11, 69115 Heidelberg, Germany",
    },
    {
      id: "old-town",
      tipEn:
        "Walk up to the castle at sunset. Hauptstraße is busiest on weekends.",
      tipAr: "اصعد إلى القلعة وقت الغروب؛ شارع Hauptstraße مزدحم في العطل.",
      tipHe: "עלו לטירה בשקיעה; Hauptstraße עמוס בסופ״ש.",
      category: "studentLife",
      nameEn: "Heidelberg Old Town",
      nameAr: "المدينة القديمة",
      nameHe: "העיר העתיקה של היידלברג",
      mapQuery: "Heidelberg Old Town, Germany",
      primary: true,
    },
  ],
};

export const REGENSBURG_CITY_GUIDE: StudentCityGuideConfig = {
  id: "regensburg",
  nameEn: "Regensburg",
  nameAr: "ريغنسبورغ",
  nameHe: "רגנסבורג",
  regionEn: "Bavaria",
  regionAr: "بافاريا",
  regionHe: "בוואריה",
  heroImage: regensburgImage,
  mapQuery: "Regensburg, Germany",
  schoolName: "HORIZONTE German Language School",
  locations: [
    {
      id: "horizonte",
      tipEn:
        "The school and the residence are in the same building; the teaching floor is on the 4th floor.",
      tipAr: "المدرسة والسكن في المبنى نفسه، وقاعات التدريس في الطابق الرابع.",
      tipHe: "בית הספר והמעונות באותו בניין, וכיתות הלימוד בקומה הרביעית.",
      category: "school",
      nameEn: "HORIZONTE German Language School",
      nameAr: "هوريزونتي - مدرسة اللغة الألمانية",
      nameHe: "HORIZONTE בית הספר לשפה הגרמנית",
      address: "Rote-Hahnen-Gasse 12, 93047 Regensburg",
      mapQuery: "HORIZONTE, Rote-Hahnen-Gasse 12, 93047 Regensburg, Germany",
      websiteUrl: "https://www.horizonte.com/en-german-courses/regensburg",
      primary: true,
    },
    {
      id: "horizonte-residence",
      tipEn:
        "Check-in is on Sunday 17:00–19:00 and check-out on Saturday by 10:00. Towels are not provided.",
      tipAr:
        "تسجيل الوصول الأحد 17:00–19:00 والمغادرة السبت قبل الساعة 10:00. المناشف غير مشمولة.",
      tipHe:
        "הצ׳ק-אין ביום ראשון 17:00–19:00 והצ׳ק-אאוט בשבת עד 10:00. מגבות אינן מסופקות.",
      category: "accommodation",
      nameEn: "HORIZONTE Residence",
      nameAr: "سكن هوريزونتي",
      nameHe: "מעונות HORIZONTE",
      address: "Rote-Hahnen-Gasse 12, 93047 Regensburg",
      mapQuery:
        "HORIZONTE Residence, Rote-Hahnen-Gasse 12, 93047 Regensburg, Germany",
      websiteUrl: "https://www.horizonte.com/en-german-courses/en-accomodation",
      primary: true,
    },
    {
      id: "regensburg-arcaden",
      tipEn:
        "The city's main shopping centre, with shops, services and food under one roof.",
      tipAr:
        "أكبر مركز تسوق في المدينة، يضم المتاجر والخدمات والمطاعم تحت سقف واحد.",
      tipHe:
        "מרכז הקניות המרכזי של העיר, עם חנויות, שירותים ואוכל תחת קורת גג אחת.",
      category: "supermarkets",
      nameEn: "Regensburg Arcaden",
      nameAr: "ريغنسبورغ أركادن",
      nameHe: "Regensburg Arcaden",
      address: "Friedenstraße 23, 93053 Regensburg",
      mapQuery:
        "Regensburg Arcaden, Friedenstraße 23, 93053 Regensburg, Germany",
      websiteUrl: "https://www.regensburg-arcaden.de/",
    },
    {
      id: "regensburg-hauptbahnhof",
      tipEn:
        "About 15 minutes on foot from the school, in the historic city centre.",
      tipAr:
        "تبعد نحو 15 دقيقة سيرًا على الأقدام عن المدرسة في وسط المدينة التاريخي.",
      tipHe: "כ-15 דקות הליכה מבית הספר, במרכז העיר ההיסטורי.",
      category: "transport",
      nameEn: "Regensburg Hauptbahnhof",
      nameAr: "محطة ريغنسبورغ الرئيسية",
      nameHe: "התחנה המרכזית רגנסבורג",
      mapQuery: "Regensburg Hauptbahnhof, Germany",
      primary: true,
    },
    {
      id: "university-hospital-regensburg",
      tipEn:
        "In an emergency call 112. Carry your insurance card at all times.",
      tipAr: "في الطوارئ اتصل بـ 112، واحمل بطاقة التأمين دائمًا.",
      tipHe: "במקרה חירום חייגו 112, והחזיקו תמיד את כרטיס הביטוח.",
      category: "healthcare",
      nameEn: "University Hospital Regensburg",
      nameAr: "المستشفى الجامعي في ريغنسبورغ",
      nameHe: "בית החולים האוניברסיטאי רגנסבורג",
      address: "Franz-Josef-Strauß-Allee 11, 93053 Regensburg",
      mapQuery:
        "Universitätsklinikum Regensburg, Franz-Josef-Strauß-Allee 11, 93053 Regensburg, Germany",
      websiteUrl: "https://www.ukr.de/en",
    },
    {
      id: "clever-fit-regensburg",
      tipEn:
        "Open daily 06:00–00:00. Ask about student rates and trial sessions before signing a long contract.",
      tipAr:
        "يفتح يوميًا 06:00–00:00. اسأل عن أسعار الطلاب والتجربة المجانية قبل توقيع عقد طويل.",
      tipHe:
        "פתוח מדי יום 06:00–00:00. שאלו על מחירי סטודנטים ואימון ניסיון לפני חוזה ארוך.",
      category: "gyms",
      nameEn: "clever fit Regensburg",
      nameAr: "كليفر فيت ريغنسبورغ",
      nameHe: "clever fit Regensburg",
      address: "Merianweg 4, 93051 Regensburg",
      mapQuery: "clever fit Regensburg, Merianweg 4, 93051 Regensburg, Germany",
      websiteUrl: "https://www.clever-fit.com/de/fitnessstudio/regensburg/",
    },
    {
      id: "stadtbuecherei-haidplatz",
      tipEn:
        "The city library at Haidplatz is a quiet place to study between lessons.",
      tipAr: "مكتبة المدينة في Haidplatz مكان هادئ للدراسة بين الدروس.",
      tipHe: "ספריית העיר ב-Haidplatz היא מקום שקט ללימוד בין השיעורים.",
      category: "studentLife",
      nameEn: "Stadtbücherei am Haidplatz",
      nameAr: "مكتبة المدينة في هايدبلاتس",
      nameHe: "ספריית העיר ב-Haidplatz",
      address: "Haidplatz 8, 93047 Regensburg",
      mapQuery:
        "Stadtbücherei am Haidplatz, Haidplatz 8, 93047 Regensburg, Germany",
      websiteUrl: "https://www.regensburg.de/stadtbuecherei",
    },
    {
      id: "st-peters-cathedral",
      tipEn:
        "Regensburg's best-known landmark, in the middle of the historic old town.",
      tipAr: "أشهر معلم في ريغنسبورغ، في وسط البلدة القديمة التاريخية.",
      tipHe: "האתר המוכר ביותר של רגנסבורג, במרכז העיר העתיקה.",
      category: "studentLife",
      nameEn: "St. Peter's Cathedral",
      nameAr: "كاتدرائية القديس بطرس",
      nameHe: "קתדרלת פטרוס הקדוש",
      mapQuery: "Regensburg Cathedral, Germany",
      websiteUrl:
        "https://tourismus.regensburg.de/en/experience-discover/sightseeing-unesco-world-heritage/st-peters-cathedral",
    },
    {
      id: "stone-bridge",
      tipEn:
        "Walk across the Stone Bridge at sunset for the classic view of the old town.",
      tipAr:
        "اعبر الجسر الحجري وقت الغروب للحصول على المنظر الكلاسيكي للبلدة القديمة.",
      tipHe: "חצו את גשר האבן בשקיעה לנוף הקלאסי של העיר העתיקה.",
      category: "studentLife",
      nameEn: "Stone Bridge (Steinerne Brücke)",
      nameAr: "الجسر الحجري",
      nameHe: "גשר האבן",
      mapQuery: "Steinerne Brücke, Regensburg, Germany",
      websiteUrl:
        "https://tourismus.regensburg.de/en/experience-discover/sightseeing-unesco-world-heritage/stone-bridge",
    },
    {
      id: "old-town-hall",
      tipEn:
        "The historic Old Town Hall is one of the city's UNESCO World Heritage sights.",
      tipAr:
        "دار البلدية القديمة من معالم المدينة المسجلة في قائمة اليونسكو للتراث العالمي.",
      tipHe: "בית העירייה הישן הוא אחד מאתרי המורשת העולמית של אונסק״ו בעיר.",
      category: "studentLife",
      nameEn: "Old Town Hall (Altes Rathaus)",
      nameAr: "دار البلدية القديمة",
      nameHe: "בית העירייה הישן",
      mapQuery: "Altes Rathaus, Regensburg, Germany",
      websiteUrl:
        "https://tourismus.regensburg.de/en/experience-discover/sightseeing-unesco-world-heritage/old-town-hall",
    },
    {
      id: "world-heritage-visitor-center",
      tipEn:
        "Start here for the UNESCO World Heritage exhibition and old-town orientation.",
      tipAr:
        "ابدأ من هنا لمعرض اليونسكو للتراث العالمي والتعرف على البلدة القديمة.",
      tipHe:
        "התחילו כאן לתערוכת המורשת העולמית של אונסק״ו ולהתמצאות בעיר העתיקה.",
      category: "studentLife",
      nameEn: "World Heritage Visitor Center",
      nameAr: "مركز زوار التراث العالمي",
      nameHe: "מרכז המבקרים למורשת עולמית",
      mapQuery: "World Heritage Visitor Center, Regensburg, Germany",
      websiteUrl:
        "https://tourismus.regensburg.de/en/experience-discover/sightseeing-unesco-world-heritage/world-heritage-visitor-center",
    },
    {
      id: "stadtpark-regensburg",
      tipEn:
        "The largest park in the old town, good for a run or a study break outdoors.",
      tipAr:
        "أكبر حديقة في البلدة القديمة، مناسبة للجري أو استراحة دراسية في الهواء الطلق.",
      tipHe:
        "הפארק הגדול בעיר העתיקה, מתאים לריצה או להפסקת לימודים באוויר הפתוח.",
      category: "studentLife",
      nameEn: "Stadtpark Regensburg",
      nameAr: "حديقة المدينة في ريغنسبورغ",
      nameHe: "הפארק העירוני רגנסבורג",
      mapQuery: "Stadtpark Regensburg, Germany",
      websiteUrl:
        "https://tourismus.regensburg.de/en/experience-discover/leisure-sport/parks-gardens",
    },
    {
      id: "herzogspark-regensburg",
      tipEn: "A quiet botanical garden near the Danube, free to enter.",
      tipAr: "حديقة نباتية هادئة قرب نهر الدانوب، والدخول إليها مجاني.",
      tipHe: "גן בוטני שקט ליד הדנובה, הכניסה חופשית.",
      category: "studentLife",
      nameEn: "Herzogspark",
      nameAr: "حديقة هيرتزوغ",
      nameHe: "פארק הרצוג",
      mapQuery: "Herzogspark Regensburg, Germany",
      websiteUrl:
        "https://tourismus.regensburg.de/en/experience-discover/leisure-sport/parks-gardens",
    },
    {
      id: "villapark-regensburg",
      tipEn:
        "A green riverside park on the Danube, popular for walking and cycling.",
      tipAr: "حديقة خضراء على ضفاف نهر الدانوب، مشهورة بالمشي وركوب الدراجات.",
      tipHe: "פארק ירוק על גדות הדנובה, פופולרי להליכה ולרכיבה.",
      category: "studentLife",
      nameEn: "Villapark",
      nameAr: "حديقة فيلا",
      nameHe: "וילהפארק",
      mapQuery: "Villapark Regensburg, Germany",
      websiteUrl:
        "https://tourismus.regensburg.de/en/experience-discover/leisure-sport/parks-gardens",
    },
    {
      id: "donaupark-regensburg",
      tipEn:
        "A riverside park along the Danube, an easy walk from the old town.",
      tipAr:
        "حديقة على ضفاف نهر الدانوب، على مسافة قصيرة سيرًا من البلدة القديمة.",
      tipHe: "פארק על גדות הדנובה, הליכה קצרה מהעיר העתיקה.",
      category: "studentLife",
      nameEn: "Donaupark",
      nameAr: "حديقة الدانوب",
      nameHe: "פארק הדנובה",
      mapQuery: "Donaupark Regensburg, Germany",
      websiteUrl:
        "https://tourismus.regensburg.de/en/experience-discover/leisure-sport/parks-gardens",
    },
  ],
};

export const CITY_GUIDES: StudentCityGuideConfig[] = [
  HEIDELBERG_CITY_GUIDE,
  REGENSBURG_CITY_GUIDE,
];

export const getCityGuide = (residentialCity: string | null | undefined) =>
  isHeidelberg(residentialCity)
    ? HEIDELBERG_CITY_GUIDE
    : isRegensburg(residentialCity)
      ? REGENSBURG_CITY_GUIDE
      : null;
