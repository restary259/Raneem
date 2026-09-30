import heidelbergImage from "@/assets/destinations/heidelberg.jpg";

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
  distance?: string;
  address?: string;
  mapQuery: string;
  imageUrl?: string;
  primary?: boolean;
  descriptionEn?: string;
  descriptionAr?: string;
  descriptionHe?: string;
}

export interface StudentCityGuideConfig {
  id: "heidelberg";
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

export const isHeidelberg = (value: string | null | undefined) =>
  normalizeResidentialCity(value) === "heidelberg";

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
      category: "school",
      nameEn: "F+U Academy of Languages",
      nameAr: "أكاديمية F+U للغات",
      nameHe: "F+U Academy of Languages",
      distance: "0 km",
      address: "Hauptstraße 1, 69117 Heidelberg",
      mapQuery: "F+U Academy of Languages, Hauptstraße 1, 69117 Heidelberg, Germany",
      imageUrl: "/lovable-uploads/schools/fu-academy/school/campus.jpg",
      primary: true,
    },
    {
      id: "fu-campus",
      category: "accommodation",
      nameEn: "F+U Campus Residence",
      nameAr: "سكن F+U Campus",
      nameHe: "מעונות F+U Campus",
      distance: "1 km",
      address: "Kurfürsten-Anlage 64–68, 69115 Heidelberg",
      mapQuery: "F+U Campus Heidelberg, Kurfürsten-Anlage 64-68, 69115 Heidelberg, Germany",
      imageUrl: "/lovable-uploads/schools/fu-academy/accommodations/category-e-bergheim-3.jpg",
      primary: true,
    },
    {
      id: "fu-maerzgasse",
      category: "accommodation",
      nameEn: "F+U Residence — Märzgasse",
      nameAr: "سكن F+U — ميرغاسه",
      nameHe: "מעונות F+U — Märzgasse",
      distance: "500 m",
      address: "Heidelberg Old Town",
      mapQuery: "Märzgasse Heidelberg F+U residence",
      imageUrl: "/lovable-uploads/schools/fu-academy/accommodations/category-e-maerzgasse-1.jpg",
      primary: true,
    },
    {
      id: "fu-concordia",
      category: "accommodation",
      nameEn: "F+U Residence — Concordia",
      nameAr: "سكن F+U — كونكورديا",
      nameHe: "מעונות F+U — Concordia",
      distance: "1.5 km",
      address: "Rohrbacher Straße 126, 69126 Heidelberg",
      mapQuery: "Concordia F+U, Rohrbacher Straße 126, 69126 Heidelberg, Germany",
      imageUrl: "/lovable-uploads/schools/fu-academy/accommodations/category-a-concordia-3.jpg",
    },
    {
      id: "kaufland-weststadt",
      category: "supermarkets",
      nameEn: "Kaufland Heidelberg-Weststadt",
      nameAr: "Kaufland هايدلبرغ - Weststadt",
      nameHe: "Kaufland Heidelberg-Weststadt",
      distance: "1.1 km",
      address: "Kurfürsten-Anlage 61, 69115 Heidelberg",
      mapQuery: "Kaufland Heidelberg-Weststadt, Kurfürsten-Anlage 61, 69115 Heidelberg, Germany",
    },
    {
      id: "lidl-heidelberg",
      category: "supermarkets",
      nameEn: "Lidl Heidelberg",
      nameAr: "Lidl هايدلبرغ",
      nameHe: "Lidl Heidelberg",
      mapQuery: "Lidl Heidelberg, Germany",
    },
    {
      id: "rewe-heidelberg",
      category: "supermarkets",
      nameEn: "REWE Heidelberg",
      nameAr: "REWE هايدلبرغ",
      nameHe: "REWE Heidelberg",
      mapQuery: "REWE Heidelberg, Germany",
    },
    {
      id: "venicebeach-bahnstadt",
      category: "gyms",
      nameEn: "VeniceBeach Heidelberg Bahnstadt",
      nameAr: "VeniceBeach Heidelberg Bahnstadt",
      nameHe: "VeniceBeach Heidelberg Bahnstadt",
      distance: "1.7 km",
      address: "Speyerer Straße 4+6, 69115 Heidelberg",
      mapQuery: "VeniceBeach Heidelberg Bahnstadt, Speyerer Straße 4+6, 69115 Heidelberg, Germany",
    },
    {
      id: "fitbase",
      category: "gyms",
      nameEn: "FitBase Heidelberg",
      nameAr: "FitBase Heidelberg",
      nameHe: "FitBase Heidelberg",
      distance: "4.0 km",
      address: "Kurpfalzring 120, 69123 Heidelberg",
      mapQuery: "FitBase Heidelberg, Kurpfalzring 120, 69123 Heidelberg, Germany",
    },
    {
      id: "hauptbahnhof",
      category: "transport",
      nameEn: "Heidelberg Hauptbahnhof",
      nameAr: "محطة هايدلبرغ الرئيسية",
      nameHe: "התחנה המרכזית היידלברג",
      distance: "1 km",
      mapQuery: "Heidelberg Hauptbahnhof, Germany",
      primary: true,
    },
    {
      id: "sportzentrum-mitte",
      category: "football",
      nameEn: "Sportzentrum Mitte",
      nameAr: "Sportzentrum Mitte — ملاعب رياضية",
      nameHe: "Sportzentrum Mitte",
      address: "Rohrbacher Str. 102, 69126 Heidelberg",
      mapQuery: "Sportzentrum Mitte, Rohrbacher Str. 102, 69126 Heidelberg, Germany",
    },
    {
      id: "hunters-training",
      category: "football",
      nameEn: "Heidelberg Hunters Training Field",
      nameAr: "ملعب تدريب Heidelberg Hunters",
      nameHe: "מגרש האימון Heidelberg Hunters",
      address: "Carl-Bosch-Straße, 69126 Heidelberg",
      mapQuery: "Trainingsplatz Heidelberg Hunters, Carl-Bosch-Straße, 69126 Heidelberg, Germany",
    },
    {
      id: "gloria-kino",
      category: "cinema",
      nameEn: "Gloria Kino Heidelberg",
      nameAr: "سينما Gloria",
      nameHe: "Gloria Kino Heidelberg",
      address: "Hauptstraße 146, 69117 Heidelberg",
      mapQuery: "Gloria Kino Heidelberg, Hauptstraße 146, 69117 Heidelberg, Germany",
    },
    {
      id: "university-hospital",
      category: "healthcare",
      nameEn: "University Hospital Heidelberg",
      nameAr: "المستشفى الجامعي في هايدلبرغ",
      nameHe: "בית החולים האוניברסיטאי היידלברג",
      address: "Im Neuenheimer Feld 672, 69120 Heidelberg",
      mapQuery: "University Hospital Heidelberg, Im Neuenheimer Feld 672, 69120 Heidelberg, Germany",
    },
    {
      id: "hof-apotheke",
      category: "pharmacy",
      nameEn: "Hof Apotheke Heidelberg",
      nameAr: "Hof Apotheke هايدلبرغ",
      nameHe: "Hof Apotheke Heidelberg",
      address: "Sofienstraße 11, 69115 Heidelberg",
      mapQuery: "Hof Apotheke Heidelberg, Sofienstraße 11, 69115 Heidelberg, Germany",
    },
    {
      id: "old-town",
      category: "studentLife",
      nameEn: "Heidelberg Old Town",
      nameAr: "المدينة القديمة",
      nameHe: "העיר העתיקה של היידלברג",
      distance: "500 m",
      mapQuery: "Heidelberg Old Town, Germany",
      primary: true,
    },
  ],
};

export const getCityGuide = (residentialCity: string | null | undefined) =>
  isHeidelberg(residentialCity) ? HEIDELBERG_CITY_GUIDE : null;
