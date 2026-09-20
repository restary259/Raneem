export interface LanguageSchoolDestination {
  name: string;
  city: "heidelberg" | "dusseldorf" | "dortmund" | "berlin";
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
  id: "heidelberg" | "dusseldorf" | "dortmund" | "berlin";
  name: string;
  region: string;
  imageUrl: string;
  descriptionKey: string;
  highlights: string[];
  cityUrl: string;
  activityLinks: Array<{ labelKey: string; url: string }>;
}

export const languageYearCities: LanguageYearCity[] = [
  {
    id: "heidelberg",
    name: "Heidelberg",
    region: "Baden-Württemberg",
    imageUrl: "https://images.unsplash.com/photo-1768691424328-da3c7b18f990?auto=format&fit=crop&w=1800&q=82",
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
    imageUrl: "https://images.unsplash.com/photo-1741342276667-4185aa6d95f1?auto=format&fit=crop&w=1800&q=82",
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
    imageUrl: "https://cdn.pixabay.com/photo/2020/07/12/16/44/aerial-view-5397894_1280.jpg",
    descriptionKey: "destinations.cities.dortmund.description",
    highlights: ["destinations.cities.dortmund.highlight1", "destinations.cities.dortmund.highlight2", "destinations.cities.dortmund.highlight3"],
    cityUrl: "https://www.dortmund-tourismus.de/",
    activityLinks: [
      { labelKey: "destinations.sources.cityLife", url: "https://www.dortmund-tourismus.de/" },
      { labelKey: "destinations.sources.schoolGallery", url: "https://www.perfekt-deutsch.de/sprachschule/galerie/" },
      { labelKey: "destinations.sources.schoolHome", url: "https://www.perfekt-deutsch.de/" }
    ]
  },
  {
    id: "berlin",
    name: "Berlin",
    region: "Berlin",
    imageUrl: "https://images.unsplash.com/photo-1775045309134-7525be4e2f2d?auto=format&fit=crop&w=1800&q=82",
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
    logoUrl: "/lovable-uploads/e7298181-bfde-4ee6-b5cb-a310ab735b61.png",
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
    logoUrl: "/lovable-uploads/171c7fae-8d36-4d06-a429-e3726c4417b8.webp",
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
    logoUrl: "/lovable-uploads/f66f6ad1-4686-44a0-8341-178c0bacebaf.webp",
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
    logoUrl: "https://www.perfekt-deutsch.de/wp-content/uploads/2022/02/sprachschule-dortmund-perfekt-deutsch-logo-768x432.jpg",
    credentials: ["Licensed telc examination centre", "Licensed TestDaF centre", "TestAS", "OnSET", "AZAV"],
    credentialsNoteKey: "destinations.schools.perfekt.credentialsNote",
    focusKeys: ["destinations.schools.perfekt.focusLocation", "destinations.schools.perfekt.focusStudy", "destinations.schools.perfekt.focusFlexibility"],
    examKeys: ["telc", "TestDaF", "TestAS", "DSH"],
    serviceKeys: ["destinations.schools.perfekt.serviceCity", "destinations.schools.perfekt.serviceAccommodation", "destinations.schools.perfekt.serviceGallery"]
  },
  {
    name: "VICTORIA | Academy of Languages",
    city: "berlin",
    location: "Berlin Mitte",
    descriptionKey: "destinations.schools.victoria.description",
    officialUrl: "https://www.victoria-languages.de/en/",
    activityUrl: "https://www.victoria-languages.de/en/about-us/",
    logoUrl: "https://www.victoria-languages.de/favicon.ico",
    credentials: ["telc Competence Center University", "TestDaF", "TOEFL", "OnSET", "International examination centre", "Certified quality management"],
    credentialsNoteKey: "destinations.schools.victoria.credentialsNote",
    focusKeys: ["destinations.schools.victoria.focusCampus", "destinations.schools.victoria.focusUniversity", "destinations.schools.victoria.focusModular"],
    examKeys: ["telc", "TestDaF", "TOEFL", "OnSET"],
    serviceKeys: ["destinations.schools.victoria.serviceHousing", "destinations.schools.victoria.serviceActivities", "destinations.schools.victoria.serviceUniversity"]
  }
];

export const tu9Universities = [
  { name: "RWTH Aachen University", city: "Aachen", url: "https://www.rwth-aachen.de/" },
  { name: "TU Berlin", city: "Berlin", url: "https://www.tu.berlin/" },
  { name: "TU Braunschweig", city: "Braunschweig", url: "https://www.tu-braunschweig.de/" },
  { name: "TU Darmstadt", city: "Darmstadt", url: "https://www.tu-darmstadt.de/" },
  { name: "TU Dresden", city: "Dresden", url: "https://tu-dresden.de/" },
  { name: "Leibniz University Hannover", city: "Hannover", url: "https://www.uni-hannover.de/" },
  { name: "Karlsruhe Institute of Technology (KIT)", city: "Karlsruhe", url: "https://www.kit.edu/" },
  { name: "Technical University of Munich (TUM)", city: "Munich", url: "https://www.tum.de/" },
  { name: "University of Stuttgart", city: "Stuttgart", url: "https://www.uni-stuttgart.de/" }
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
