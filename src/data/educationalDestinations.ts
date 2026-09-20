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
  photoCredit?: { label: string; url: string };
}

export const languageYearCities: LanguageYearCity[] = [
  {
    id: "heidelberg",
    name: "Heidelberg",
    region: "Baden-Württemberg",
    imageUrl: "https://images.unsplash.com/photo-1744049891187-99ce6f6bca57?auto=format&fit=crop&w=2400&q=88",
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
    imageUrl: "https://images.unsplash.com/photo-1741342276667-4185aa6d95f1?auto=format&fit=crop&w=2400&q=88",
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
    imageUrl: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Panorama%20Skyline%20Dortmund.jpg",
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
    id: "berlin",
    name: "Berlin",
    region: "Berlin",
    imageUrl: "https://images.unsplash.com/photo-1775045309134-7525be4e2f2d?auto=format&fit=crop&w=2400&q=88",
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
    logoUrl: "/lovable-uploads/e7298181-bfde-4ee6-b5cb-a310ab735b61.png",
    credentials: ["TestDaF", "telc", "TestAS", "IELTS", "TOEFL", "TOEIC", "LCCI", "Excellence Award 2019"],
    credentialsNoteKey: "destinations.schools.fu.credentialsNote",
    focusKeys: ["destinations.schools.fu.schoolFacts.focusYear", "destinations.schools.fu.schoolFacts.focusExams", "destinations.schools.fu.schoolFacts.focusSupport"],
    examKeys: ["TestDaF", "telc", "TestAS", "TOEFL", "TOEIC"],
    serviceKeys: ["destinations.schools.fu.schoolFacts.serviceHousing", "destinations.schools.fu.schoolFacts.serviceActivities", "destinations.schools.fu.schoolFacts.serviceAdvice"]
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
    focusKeys: ["destinations.schools.alpha.schoolFacts.focusLevels", "destinations.schools.alpha.schoolFacts.focusAcademic", "destinations.schools.alpha.schoolFacts.focusTesting"],
    examKeys: ["telc", "TestDaF", "TestAS", "IELTS", "TOEFL", "DSH preparation"],
    serviceKeys: ["destinations.schools.alpha.schoolFacts.serviceFoundation", "destinations.schools.alpha.schoolFacts.serviceExams", "destinations.schools.alpha.schoolFacts.serviceAdvice"]
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
    focusKeys: ["destinations.schools.goacademy.schoolFacts.focusLevels", "destinations.schools.goacademy.schoolFacts.focusPathway", "destinations.schools.goacademy.schoolFacts.focusAccommodation"],
    examKeys: ["telc", "TestDaF", "TestAS", "DSH preparation"],
    serviceKeys: ["destinations.schools.goacademy.schoolFacts.servicePathway", "destinations.schools.goacademy.schoolFacts.serviceHousing", "destinations.schools.goacademy.schoolFacts.serviceLms"]
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
    focusKeys: ["destinations.schools.perfekt.schoolFacts.focusLocation", "destinations.schools.perfekt.schoolFacts.focusStudy", "destinations.schools.perfekt.schoolFacts.focusFlexibility"],
    examKeys: ["telc", "TestDaF", "TestAS", "DSH"],
    serviceKeys: ["destinations.schools.perfekt.schoolFacts.serviceCity", "destinations.schools.perfekt.schoolFacts.serviceAccommodation", "destinations.schools.perfekt.schoolFacts.serviceGallery"]
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
    focusKeys: ["destinations.schools.victoria.schoolFacts.focusCampus", "destinations.schools.victoria.schoolFacts.focusUniversity", "destinations.schools.victoria.schoolFacts.focusModular"],
    examKeys: ["telc", "TestDaF", "TOEFL", "OnSET"],
    serviceKeys: ["destinations.schools.victoria.schoolFacts.serviceHousing", "destinations.schools.victoria.schoolFacts.serviceActivities", "destinations.schools.victoria.schoolFacts.serviceUniversity"]
  }
];

export const tu9Universities = [
  { name: "RWTH Aachen University", city: "Aachen", url: "https://www.rwth-aachen.de/", logoUrl: "https://commons.wikimedia.org/wiki/Special:Redirect/file/RWTH-logo.png" },
  { name: "TU Berlin", city: "Berlin", url: "https://www.tu.berlin/", logoUrl: "https://commons.wikimedia.org/wiki/Special:Redirect/file/LogoDerTechnischenUniversitätBerlin2020.svg" },
  { name: "TU Braunschweig", city: "Braunschweig", url: "https://www.tu-braunschweig.de/", logoUrl: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Siegel%20TU%20Braunschweig%20transparent.svg" },
  { name: "TU Darmstadt", city: "Darmstadt", url: "https://www.tu-darmstadt.de/", logoUrl: "https://commons.wikimedia.org/wiki/Special:Redirect/file/TU%20Darmstadt%20Logo.svg" },
  { name: "TU Dresden", city: "Dresden", url: "https://tu-dresden.de/", logoUrl: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Logo%20TU%20Dresden%202025.svg" },
  { name: "Leibniz University Hannover", city: "Hannover", url: "https://www.uni-hannover.de/", logoUrl: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Leibniz-Universität%20Hannover.png" },
  { name: "Karlsruhe Institute of Technology (KIT)", city: "Karlsruhe", url: "https://www.kit.edu/", logoUrl: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Logo%20KIT.svg" },
  { name: "Technical University of Munich (TUM)", city: "Munich", url: "https://www.tum.de/", logoUrl: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Logo%20of%20the%20Technical%20University%20of%20Munich.svg" },
  { name: "University of Stuttgart", city: "Stuttgart", url: "https://www.uni-stuttgart.de/", logoUrl: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Universität%20Stuttgart%20Logo.svg" }
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
