import { ALPHA_AKTIV_LOGO_SRC } from "@/assets/alphaAktivLogo";
import heidelbergImage from "@/assets/destinations/heidelberg.jpg";
import dusseldorfImage from "@/assets/destinations/dusseldorf.jpg";
import dortmundImage from "@/assets/destinations/dortmund.jpg";
import munsterImage from "@/assets/destinations/munster.jpg";
import berlinImage from "@/assets/destinations/berlin.jpg";
import rwthLogo from "@/assets/universities/rwth.png.asset.json";
import tuBerlinLogo from "@/assets/universities/tu-berlin.svg.asset.json";
import tuBraunschweigLogo from "@/assets/universities/tu-braunschweig.svg.asset.json";
import tuDarmstadtLogo from "@/assets/universities/tu-darmstadt.svg.asset.json";
import tuDresdenLogo from "@/assets/universities/tu-dresden.svg.asset.json";
import leibnizLogo from "@/assets/universities/leibniz-hannover.png.asset.json";
import kitLogo from "@/assets/universities/kit.svg.asset.json";
import tumLogo from "@/assets/universities/tum.svg.asset.json";
import stuttgartLogo from "@/assets/universities/uni-stuttgart.svg.asset.json";

export interface LanguageSchoolDestination {
  name: string;
  city: "heidelberg" | "dusseldorf" | "dortmund" | "berlin" | "munster";
  location: string;
  descriptionKey: string;
  officialUrl: string;
  activityUrl?: string;
  logoUrl?: string;
  credentials: string[];
  credentialsNoteKey?: string;
  focusKeys: string[];
  examKeys: string[];
  serviceKeys: string[];
}

export interface LanguageYearCity {
  id: "heidelberg" | "dusseldorf" | "dortmund" | "berlin" | "munster";
  name: string;
  region: string;
  imageUrl: string;
  descriptionKey: string;
  highlights: string[];
  cityUrl: string;
  activityLinks: Array<{ labelKey: string; url: string }>;
  photoCredit?: { label: string; url: string };
}

export const languageYearCities: LanguageYearCity[] = [
  {
    id: "heidelberg",
    name: "Heidelberg",
    region: "Baden-Württemberg",
    imageUrl: heidelbergImage,
    photoCredit: { label: "Photo: Christopher Politano / Unsplash", url: "https://unsplash.com/photos/heidelberg-castle-towers-over-the-historic-town-AWv1ymdCFIc" },
    descriptionKey: "destinations.cities.heidelberg.description",
    highlights: ["destinations.cities.heidelberg.highlight1", "destinations.cities.heidelberg.highlight2", "destinations.cities.heidelberg.highlight3"],
    cityUrl: "https://visit.heidelberg.de/en",
    activityLinks: [
      { labelKey: "destinations.sources.cityLife", url: "https://visit.heidelberg.de/en" },
      { labelKey: "destinations.sources.fuEvents", url: "https://www.fuu.de/events" },
      { labelKey: "destinations.sources.alphaAktiv", url: "https://www.alpha-heidelberg.de/" }
    ]
  },
  {
    id: "dusseldorf",
    name: "Düsseldorf",
    region: "North Rhine-Westphalia",
    imageUrl: dusseldorfImage,
    photoCredit: { label: "Photo: Markus Winkler / Unsplash", url: "https://unsplash.com/photos/the-rheinturm-tower-stands-tall-in-dusseldorf-0KQwbCNwIZo" },
    descriptionKey: "destinations.cities.dusseldorf.description",
    highlights: ["destinations.cities.dusseldorf.highlight1", "destinations.cities.dusseldorf.highlight2", "destinations.cities.dusseldorf.highlight3"],
    cityUrl: "https://www.visitduesseldorf.de/en",
    activityLinks: [
      { labelKey: "destinations.sources.cityLife", url: "https://www.visitduesseldorf.de/en" },
      { labelKey: "destinations.sources.schoolCulture", url: "https://goacademy.de/en/language-courses/german" },
      { labelKey: "destinations.sources.schoolHome", url: "https://goacademy.de/en/" }
    ]
  },
  {
    id: "dortmund",
    name: "Dortmund",
    region: "North Rhine-Westphalia",
    imageUrl: dortmundImage,
    descriptionKey: "destinations.cities.dortmund.description",
    highlights: ["destinations.cities.dortmund.highlight1", "destinations.cities.dortmund.highlight2", "destinations.cities.dortmund.highlight3"],
    cityUrl: "https://www.dortmund-tourismus.de/",
    photoCredit: { label: "Photo: Lucas Kaufmann / Wikimedia Commons (CC BY-SA 4.0)", url: "https://commons.wikimedia.org/wiki/File:Panorama_Skyline_Dortmund.jpg" },
    activityLinks: [
      { labelKey: "destinations.sources.cityLife", url: "https://www.dortmund-tourismus.de/" },
      { labelKey: "destinations.sources.schoolGallery", url: "https://www.perfekt-deutsch.de/sprachschule/galerie/" },
      { labelKey: "destinations.sources.schoolHome", url: "https://www.perfekt-deutsch.de/" }
    ]
  },
  {
    id: "munster",
    name: "Münster",
    region: "North Rhine-Westphalia",
    imageUrl: munsterImage,
    descriptionKey: "destinations.cities.munster.description",
    highlights: ["destinations.cities.munster.highlight1", "destinations.cities.munster.highlight2", "destinations.cities.munster.highlight3"],
    cityUrl: "https://www.stadt-muenster.de/tourismus/startseite",
    photoCredit: { label: "Photo: Rüdiger Wölk / Wikimedia Commons (CC BY-SA 2.5)", url: "https://commons.wikimedia.org/wiki/File:MuensterPanorama2856alt.jpg" },
    activityLinks: [
      { labelKey: "destinations.sources.cityLife", url: "https://www.stadt-muenster.de/tourismus/startseite" },
      { labelKey: "destinations.sources.schoolHome", url: "https://www.kapito.com/" },
      { labelKey: "destinations.sources.schoolKapitoCourses", url: "https://www.kapito.com/en/language-school-muenster/" }
    ]
  },
  {
    id: "berlin",
    name: "Berlin",
    region: "Berlin",
    imageUrl: berlinImage,
    photoCredit: { label: "Photo: Eugenia Pan'kiv / Unsplash", url: "https://unsplash.com/photos/brandenburg-gate-in-berlin-on-a-clear-day-AG1beo31e1M" },
    descriptionKey: "destinations.cities.berlin.description",
    highlights: ["destinations.cities.berlin.highlight1", "destinations.cities.berlin.highlight2", "destinations.cities.berlin.highlight3"],
    cityUrl: "https://www.visitberlin.de/en",
    activityLinks: [
      { labelKey: "destinations.sources.cityLife", url: "https://www.visitberlin.de/en" },
      { labelKey: "destinations.sources.schoolInfo", url: "https://www.victoria-languages.de/en/about-us/" },
      { labelKey: "destinations.sources.schoolHome", url: "https://www.victoria-languages.de/en/" }
    ]
  }
];

export const languageYearSchools: LanguageSchoolDestination[] = [
  {
    name: "F+U Academy of Languages",
    city: "heidelberg",
    location: "Heidelberg",
    descriptionKey: "destinations.schools.fu.description",
    officialUrl: "https://www.fuu.de/sprachen",
    activityUrl: "https://www.fuu.de/events",
    logoUrl: "https://www.fuu.de/f-u_fileadmin/Academy-of-languages/Academy-of-Languages-Heidelberg-Logo.png",
    credentials: ["TestDaF", "telc", "TestAS", "IELTS", "TOEFL", "TOEIC", "LCCI", "Excellence Award 2019"],
    credentialsNoteKey: "destinations.schools.fu.credentialsNote",
    focusKeys: ["destinations.schools.fu.focusYear", "destinations.schools.fu.focusExams", "destinations.schools.fu.focusSupport"],
    examKeys: ["TestDaF", "telc", "TestAS", "TOEFL", "TOEIC"],
    serviceKeys: ["destinations.schools.fu.serviceHousing", "destinations.schools.fu.serviceActivities", "destinations.schools.fu.serviceAdvice"]
  },
  {
    name: "Alpha Aktiv",
    city: "heidelberg",
    location: "Heidelberg",
    descriptionKey: "destinations.schools.alpha.description",
    officialUrl: "https://www.alpha-heidelberg.de/",
    activityUrl: "https://www.alpha-heidelberg.de/en/exams/",
    logoUrl: ALPHA_AKTIV_LOGO_SRC,
    credentials: ["telc Competence Center University", "TestDaF", "TestAS", "IELTS", "TOEFL", "AZAV", "DIN EN ISO 9001"],
    credentialsNoteKey: "destinations.schools.alpha.credentialsNote",
    focusKeys: ["destinations.schools.alpha.focusLevels", "destinations.schools.alpha.focusAcademic", "destinations.schools.alpha.focusTesting"],
    examKeys: ["telc", "TestDaF", "TestAS", "IELTS", "TOEFL", "DSH preparation"],
    serviceKeys: ["destinations.schools.alpha.serviceFoundation", "destinations.schools.alpha.serviceExams", "destinations.schools.alpha.serviceAdvice"]
  },
  {
    name: "GoAcademy! Düsseldorf – International House",
    city: "dusseldorf",
    location: "Düsseldorf",
    descriptionKey: "destinations.schools.goacademy.description",
    officialUrl: "https://goacademy.de/en/",
    activityUrl: "https://goacademy.de/en/language-courses/german/german-intensive-course",
    logoUrl: "https://fdsv.de/wp-content/uploads/2019/04/GoAcademy-GmbH-4000-x1488px.png",
    credentials: ["Study Travel Star Award Winner 2026", "International House", "IALC", "TÜV Rheinland / DIN ISO 9001:2015", "AZAV", "telc", "TestDaF", "TestAS", "TOEFL", "TOEIC"],
    credentialsNoteKey: "destinations.schools.goacademy.credentialsNote",
    focusKeys: ["destinations.schools.goacademy.focusLevels", "destinations.schools.goacademy.focusPathway", "destinations.schools.goacademy.focusAccommodation"],
    examKeys: ["telc", "TestDaF", "TestAS", "DSH preparation"],
    serviceKeys: ["destinations.schools.goacademy.servicePathway", "destinations.schools.goacademy.serviceHousing", "destinations.schools.goacademy.serviceLms"]
  },
  {
    name: "Perfekt Deutsch Sprachakademie",
    city: "dortmund",
    location: "Dortmund",
    descriptionKey: "destinations.schools.perfekt.description",
    officialUrl: "https://www.perfekt-deutsch.de/",
    activityUrl: "https://www.perfekt-deutsch.de/sprachschule/galerie/",
    logoUrl: "/lovable-uploads/schools/perfekt-deutsch/perfekt-deutsch-logo.svg",
    credentials: ["Licensed telc examination centre", "Licensed TestDaF centre", "TestAS", "OnSET", "AZAV"],
    credentialsNoteKey: "destinations.schools.perfekt.credentialsNote",
    focusKeys: ["destinations.schools.perfekt.focusLocation", "destinations.schools.perfekt.focusStudy", "destinations.schools.perfekt.focusFlexibility"],
    examKeys: ["telc", "TestDaF", "TestAS", "DSH"],
    serviceKeys: ["destinations.schools.perfekt.serviceCity", "destinations.schools.perfekt.serviceAccommodation", "destinations.schools.perfekt.serviceGallery"]
  },
  {
    name: "KAPITO Sprachschule",
    city: "munster",
    location: "Münster",
    descriptionKey: "destinations.schools.kapito.description",
    officialUrl: "https://www.kapito.com/",
    activityUrl: "https://www.kapito.com/en/language-school-muenster/",
    logoUrl: "/lovable-uploads/schools/kapito/kapito-logo.svg",
    credentials: ["Licensed telc test centre", "Licensed TestDaF centre"],
    credentialsNoteKey: "destinations.schools.kapito.credentialsNote",
    focusKeys: ["destinations.schools.kapito.focusLevels", "destinations.schools.kapito.focusUniversity", "destinations.schools.kapito.focusSupport"],
    examKeys: ["telc", "TestDaF", "DSH"],
    serviceKeys: ["destinations.schools.kapito.serviceHousing", "destinations.schools.kapito.serviceGuidance", "destinations.schools.kapito.serviceActivities"]
  },
  {
    name: "VICTORIA | Academy of Languages",
    city: "berlin",
    location: "Berlin Mitte",
    descriptionKey: "destinations.schools.victoria.description",
    officialUrl: "https://www.victoria-languages.de/en/",
    activityUrl: "https://www.victoria-languages.de/en/about-us/",
    logoUrl: "https://www.victoria-languages.de/wp-content/uploads/V_Academy_of_Languages_RGB.png",
    credentials: ["telc Competence Center University", "TestDaF", "TOEFL", "OnSET", "International examination centre", "Certified quality management"],
    credentialsNoteKey: "destinations.schools.victoria.credentialsNote",
    focusKeys: ["destinations.schools.victoria.focusCampus", "destinations.schools.victoria.focusUniversity", "destinations.schools.victoria.focusModular"],
    examKeys: ["telc", "TestDaF", "TOEFL", "OnSET"],
    serviceKeys: ["destinations.schools.victoria.serviceHousing", "destinations.schools.victoria.serviceActivities", "destinations.schools.victoria.serviceUniversity"]
  }
];

export const tu9Universities = [
  { name: "RWTH Aachen University", city: "Aachen", url: "https://www.rwth-aachen.de/", logoUrl: rwthLogo.url },
  { name: "TU Berlin", city: "Berlin", url: "https://www.tu.berlin/", logoUrl: tuBerlinLogo.url },
  { name: "TU Braunschweig", city: "Braunschweig", url: "https://www.tu-braunschweig.de/", logoUrl: tuBraunschweigLogo.url },
  { name: "TU Darmstadt", city: "Darmstadt", url: "https://www.tu-darmstadt.de/", logoUrl: tuDarmstadtLogo.url },
  { name: "TU Dresden", city: "Dresden", url: "https://tu-dresden.de/", logoUrl: tuDresdenLogo.url },
  { name: "Leibniz University Hannover", city: "Hannover", url: "https://www.uni-hannover.de/", logoUrl: leibnizLogo.url },
  { name: "Karlsruhe Institute of Technology (KIT)", city: "Karlsruhe", url: "https://www.kit.edu/", logoUrl: kitLogo.url },
  { name: "Technical University of Munich (TUM)", city: "Munich", url: "https://www.tum.de/", logoUrl: tumLogo.url },
  { name: "University of Stuttgart", city: "Stuttgart", url: "https://www.uni-stuttgart.de/", logoUrl: stuttgartLogo.url }
];

// Backward-compatible exports for legacy tooling (including AI knowledge generation).
export const universities = {
  germany: tu9Universities.map((uni) => ({
    name: uni.name,
    location: uni.city + ", Germany",
    description: "",
    majors: [],
    ranking: "",
    students: "",
    officialUrl: uni.url,
  })),
};

export const languageSchools = {
  germany: languageYearSchools.map((school) => ({
    name: school.name,
    location: school.location,
    logoUrl: school.logoUrl ?? "",
    description: "",
    programs: school.examKeys,
  })),
};

export const services = {
  germany: [],
};

export const countries = [
  { code: "germany", name: "Germany", flag: "🇩🇪", color: "bg-red-600" }
];
