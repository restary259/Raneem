/**
 * DARB Major Intelligence — ranked university recommendations.
 * TU9-first policy is applied only when the requested subject has a concrete TU9 route.
 * Related routes are explicitly labelled by the UI; recommendations are DARB guidance,
 * while the linked catalogue is the university's official source.
 */
import type { IntelSource } from './factTypes';
import type { MajorIntel, ProgramIntel, UniversityRecommendation, UniversityRecommendationCost, RecommendationMatch } from './types';

type UMeta = { name:string; nameAR:string; city:string; tu9:boolean; url:string };
const U: Record<string,UMeta> = {
  tum:{name:"Technical University of Munich (TUM)",nameAR:"الجامعة التقنية في ميونخ (TUM)",city:"Munich / Garching",tu9:true,url:"https://www.tum.de/en/studies/degree-programs"},
  rwth:{name:"RWTH Aachen University",nameAR:"جامعة RWTH آخن",city:"Aachen",tu9:true,url:"https://www.rwth-aachen.de/cms/root/studium/vor-dem-studium/studiengaenge/~cghw/studiengaenge-a-z/"},
  tu_berlin:{name:"TU Berlin",nameAR:"جامعة برلين التقنية",city:"Berlin",tu9:true,url:"https://www.tu.berlin/en/studying/study-programs/all-programs-offered"},
  tu_bs:{name:"TU Braunschweig",nameAR:"جامعة TU براونشفايغ",city:"Braunschweig",tu9:true,url:"https://www.tu-braunschweig.de/en/degree-programmes"},
  tu_darmstadt:{name:"TU Darmstadt",nameAR:"جامعة TU دارمشتات",city:"Darmstadt",tu9:true,url:"https://www.tu-darmstadt.de/studieren/studieninteressierte/studienangebot_und_bewerbung/index.en.jsp"},
  tu_dresden:{name:"TUD Dresden University of Technology",nameAR:"جامعة TU دريسدن",city:"Dresden",tu9:true,url:"https://tu-dresden.de/studium/vor-dem-studium/studienangebot/sins/sins_studiengang?set_language=en"},
  luh:{name:"Leibniz University Hannover",nameAR:"جامعة ليبنتس هانوفر",city:"Hannover",tu9:true,url:"https://www.uni-hannover.de/en/studium/studienangebot/"},
  kit:{name:"Karlsruhe Institute of Technology (KIT)",nameAR:"معهد كارلسروه للتقنية (KIT)",city:"Karlsruhe",tu9:true,url:"https://www.sle.kit.edu/english/studyprograms.php"},
  stuttgart:{name:"University of Stuttgart",nameAR:"جامعة شتوتغارت",city:"Stuttgart",tu9:true,url:"https://www.uni-stuttgart.de/en/study/bachelor-programs/"},
  saarland:{name:"Saarland University",nameAR:"جامعة سارلاند",city:"Saarbrücken",tu9:false,url:"https://www.uni-saarland.de/en/study/programmes.html"},
  mannheim:{name:"University of Mannheim",nameAR:"جامعة مانهايم",city:"Mannheim",tu9:false,url:"https://www.uni-mannheim.de/en/academics/before-your-studies/programs/"},
  freiburg:{name:"University of Freiburg",nameAR:"جامعة فرايبورغ",city:"Freiburg",tu9:false,url:"https://uni-freiburg.de/en/studies/"},
  hohenheim:{name:"University of Hohenheim",nameAR:"جامعة هوهنهايم",city:"Stuttgart",tu9:false,url:"https://dein-studium.uni-hohenheim.de/en/hauptmenue/find-your-degree-program"},
  bremen:{name:"University of Bremen",nameAR:"جامعة بريمن",city:"Bremen",tu9:false,url:"https://www.uni-bremen.de/en/studies"},
  hsb:{name:"Hochschule Bremen",nameAR:"جامعة بريمن للعلوم التطبيقية",city:"Bremen",tu9:false,url:"https://www.hs-bremen.de/en/studies/degree-programmes/"},
  bielefeld:{name:"Bielefeld University",nameAR:"جامعة بيليفيلد",city:"Bielefeld",tu9:false,url:"https://www.uni-bielefeld.de/en/studies/"},
  cologne:{name:"University of Cologne",nameAR:"جامعة كولونيا",city:"Cologne",tu9:false,url:"https://www.uni-koeln.de/en/students/degree-programs/"},
  heidelberg:{name:"Heidelberg University",nameAR:"جامعة هايدلبرغ",city:"Heidelberg",tu9:false,url:"https://www.uni-heidelberg.de/en/study"},
  lmu:{name:"LMU Munich",nameAR:"جامعة LMU ميونخ",city:"Munich",tu9:false,url:"https://www.lmu.de/en/study/all-degrees-and-programs/"},
  fau:{name:"FAU Erlangen-Nürnberg",nameAR:"جامعة FAU إرلانغن-نورنبيرغ",city:"Erlangen / Nürnberg",tu9:false,url:"https://www.fau.eu/education/degree-programmes/"},
  leipzig:{name:"Leipzig University",nameAR:"جامعة لايبزيغ",city:"Leipzig",tu9:false,url:"https://www.uni-leipzig.de/en/international/studying-at-leipzig-university"},
  potsdam:{name:"University of Potsdam",nameAR:"جامعة بوتسدام",city:"Potsdam",tu9:false,url:"https://www.uni-potsdam.de/de/studium/studienangebot"},
  tuebingen:{name:"University of Tübingen",nameAR:"جامعة توبنغن",city:"Tübingen",tu9:false,url:"https://uni-tuebingen.de/en/study/degree-programs/"},
  augsburg:{name:"University of Augsburg",nameAR:"جامعة أوغسبورغ",city:"Augsburg",tu9:false,url:"https://www.uni-augsburg.de/en/students/degree-programmes/"},
  osnabrueck:{name:"Osnabrück University of Applied Sciences",nameAR:"جامعة أوسنابروك للعلوم التطبيقية",city:"Osnabrück",tu9:false,url:"https://www.hs-osnabrueck.de/en/study/degree-programmes/"},
  th_koeln:{name:"TH Köln",nameAR:"TH Köln جامعة العلوم التطبيقية",city:"Cologne",tu9:false,url:"https://www.th-koeln.de/en/academics/degree-programmes_91.php"},
  harz:{name:"Harz University of Applied Sciences",nameAR:"جامعة هارتس للعلوم التطبيقية",city:"Wernigerode",tu9:false,url:"https://www.hs-harz.de/en/study/"},
  worms:{name:"Worms University of Applied Sciences",nameAR:"جامعة فورمز للعلوم التطبيقية",city:"Worms",tu9:false,url:"https://www.hs-worms.de/en/applying"},
  haw_hamburg:{name:"HAW Hamburg",nameAR:"جامعة HAW هامبورغ",city:"Hamburg",tu9:false,url:"https://www.haw-hamburg.de/en/study/"},
  hamburg:{name:"Universität Hamburg",nameAR:"جامعة هامبورغ",city:"Hamburg",tu9:false,url:"https://www.uni-hamburg.de/en/studium.html"},
  humboldt:{name:"Humboldt-Universität zu Berlin",nameAR:"جامعة هومبولت في برلين",city:"Berlin",tu9:false,url:"https://www.hu-berlin.de/en/studies/degree-programmes"},
  bonn:{name:"University of Bonn",nameAR:"جامعة بون",city:"Bonn",tu9:false,url:"https://www.uni-bonn.de/en/studying"},
  muenster:{name:"University of Münster",nameAR:"جامعة مونستر",city:"Münster",tu9:false,url:"https://www.uni-muenster.de/en/studying/"},
  goettingen:{name:"University of Göttingen",nameAR:"جامعة غوتينغن",city:"Göttingen",tu9:false,url:"https://www.uni-goettingen.de/en/study/"},
  eberswalde:{name:"Eberswalde University for Sustainable Development",nameAR:"جامعة إبرسفالده للتنمية المستدامة",city:"Eberswalde",tu9:false,url:"https://www.hnee.de/en/studies/"},
  kiel:{name:"Kiel University",nameAR:"جامعة كيل",city:"Kiel",tu9:false,url:"https://www.uni-kiel.de/en/studium"},
  rostock:{name:"University of Rostock",nameAR:"جامعة روستوك",city:"Rostock",tu9:false,url:"https://www.uni-rostock.de/en/study/"},
  oldenburg:{name:"University of Oldenburg",nameAR:"جامعة أولدنبورغ",city:"Oldenburg",tu9:false,url:"https://uol.de/en/study"},
  hm:{name:"Munich University of Applied Sciences",nameAR:"جامعة ميونخ للعلوم التطبيقية",city:"Munich",tu9:false,url:"https://hm.edu/studium_1/"},
  udk:{name:"Berlin University of the Arts (UdK Berlin)",nameAR:"جامعة برلين للفنون (UdK Berlin)",city:"Berlin",tu9:false,url:"https://www.udk-berlin.de/en/application/applicationguide/"},
  hfbk:{name:"HFBK Hamburg",nameAR:"كلية الفنون الجميلة هامبورغ",city:"Hamburg",tu9:false,url:"https://www.hfbk-hamburg.de/en/study/"},
  filmuni:{name:"Film University Babelsberg KONRAD WOLF",nameAR:"جامعة بابلسبيرغ للسينما KONRAD WOLF",city:"Potsdam",tu9:false,url:"https://www.filmuniversitaet.de/en/studies/"},
  hfm_berlin:{name:"Hanns Eisler School of Music Berlin",nameAR:"كلية هانس آيسلر للموسيقى برلين",city:"Berlin",tu9:false,url:"https://www.hfm-berlin.de/en/study/"},
  hmt_munich:{name:"University of Music and Theatre Munich",nameAR:"جامعة الموسيقى والمسرح ميونخ",city:"Munich",tu9:false,url:"https://hmtm.de/en/studies/"},
  hmt_leipzig:{name:"University of Music and Theatre Leipzig",nameAR:"جامعة الموسيقى والمسرح لايبزيغ",city:"Leipzig",tu9:false,url:"https://www.hmt-leipzig.de/en/home/"},
  bayreuth:{name:"University of Bayreuth",nameAR:"جامعة بايرويت",city:"Bayreuth",tu9:false,url:"https://www.uni-bayreuth.de/en/study"},
  frankfurt:{name:"Goethe University Frankfurt",nameAR:"جامعة غوته فرانكفورت",city:"Frankfurt",tu9:false,url:"https://www.uni-frankfurt.de/en/study"},
  reutlingen:{name:"Reutlingen University",nameAR:"جامعة روتلينغن",city:"Reutlingen",tu9:false,url:"https://www.reutlingen-university.de/en/study"},
  pforzheim:{name:"Pforzheim University",nameAR:"جامعة بفورتسهايم",city:"Pforzheim",tu9:false,url:"https://www.hs-pforzheim.de/en/study"},
  leuphana:{name:"Leuphana University Lüneburg",nameAR:"جامعة ليوبانا لونيبورغ",city:"Lüneburg",tu9:false,url:"https://www.leuphana.de/en/college/bachelor.html"},
  hildesheim:{name:"University of Hildesheim",nameAR:"جامعة هيلدسهايم",city:"Hildesheim",tu9:false,url:"https://www.uni-hildesheim.de/en/study/"},
  fulda:{name:"Hochschule Fulda",nameAR:"جامعة فولدا للعلوم التطبيقية",city:"Fulda",tu9:false,url:"https://www.hs-fulda.de/en/study"},
  fresenius:{name:"Hochschule Fresenius",nameAR:"جامعة Fresenius للعلوم التطبيقية",city:"Germany",tu9:false,url:"https://www.hs-fresenius.com/study-programs/"},
  mainz:{name:"Johannes Gutenberg University Mainz",nameAR:"جامعة يوهانس غوتنبرغ ماينز",city:"Mainz",tu9:false,url:"https://www.studium.uni-mainz.de/en/"},
  luebeck:{name:"University of Lübeck",nameAR:"جامعة لوبيك",city:"Lübeck",tu9:false,url:"https://www.uni-luebeck.de/en/studies/"},
  tiho:{name:"University of Veterinary Medicine Hannover (TiHo)",nameAR:"جامعة الطب البيطري هانوفر (TiHo)",city:"Hannover",tu9:false,url:"https://www.tiho-hannover.de/en/studies"},
  folkwang:{name:"Folkwang University of the Arts",nameAR:"جامعة فولكفانغ للفنون",city:"Essen",tu9:false,url:"https://www.folkwang-uni.de/en/studies"},
};

export const TU9_IDS = new Set(Object.keys(U).filter(k=>U[k].tu9));

const R:Record<string,[string,string,string,string]>={
  "public-health":["bremen","bielefeld","fulda","hamburg"],
  "bioinformatics":["saarland","tuebingen","heidelberg","lmu"],
  "biomedical-engineering":["fau","tu_dresden","rwth","saarland"],
  "pharmacy":["lmu","heidelberg","freiburg","saarland"],
  "dentistry":["heidelberg","lmu","leipzig","freiburg"],
  "medicine":["tu_dresden","heidelberg","lmu","freiburg"],
  "physiotherapy":["fulda","osnabrueck","haw_hamburg","fresenius"],
  "veterinary":["tiho","lmu","leipzig","goettingen"],
  "nursing":["cologne","fulda","freiburg","osnabrueck"],
  "computer-engineering":["tu_berlin","tum","kit","tu_dresden"],
  "aerospace-engineering":["stuttgart","tum","tu_bs","rwth"],
  "renewable-energy":["stuttgart","tu_bs","kit","tum"],
  "software-engineering":["stuttgart","tu_berlin","tum","rwth"],
  "industrial-engineering":["kit","tu_dresden","tu_bs","rwth"],
  "space-engineering":["stuttgart","tum","tu_bs","rwth"],
  "chemical-engineering":["rwth","tu_bs","tu_dresden","tum"],
  "mechanical-engineering":["stuttgart","tum","rwth","tu_bs"],
  "civil-engineering":["stuttgart","tu_bs","rwth","tu_dresden"],
  "electrical-it":["kit","rwth","tum","tu_berlin"],
  "electrical-engineering":["kit","rwth","tum","tu_berlin"],
  "environmental-engineering":["tu_bs","tum","stuttgart","rwth"],
  "computer-science":["tum","rwth","tu_berlin","kit"],
  "artificial-intelligence":["tum","tu_darmstadt","tu_bs","kit"],
  "cybersecurity":["tu_darmstadt","saarland","tu_bs","tum"],
  "data-science":["tum","augsburg","tu_berlin","saarland"],
  "cloud-computing":["tu_berlin","tum","rwth","kit"],
  "game-development":["th_koeln","haw_hamburg","hm","fulda"],
  "information-management":["tu_berlin","tu_darmstadt","tu_bs","tu_dresden"],
  "environmental-science":["tu_bs","tu_dresden","freiburg","tum"],
  "mathematics":["tum","rwth","tu_berlin","kit"],
  "physics":["tum","rwth","kit","tu_dresden"],
  "chemistry":["tum","rwth","tu_dresden","kit"],
  "biology":["tu_dresden","tu_bs","tum","freiburg"],
  "psychology":["tu_dresden","tu_bs","freiburg","mannheim"],
  "sociology":["tu_dresden","tu_berlin","tu_darmstadt","mannheim"],
  "political-science":["tu_dresden","luh","tu_darmstadt","bonn"],
  "philosophy":["tu_dresden","luh","bonn","leipzig"],
  "social-work":["hsb","fulda","cologne","frankfurt"],
  "linguistics":["luh","tu_dresden","potsdam","leipzig"],
  "media-communication":["tu_dresden","tu_berlin","hohenheim","leipzig"],
  "history":["tu_dresden","luh","leipzig","bonn"],
  "business-administration":["tu_dresden","tu_berlin","mannheim","cologne"],
  "international-business":["tum","hsb","reutlingen","pforzheim"],
  "marketing":["tu_dresden","mannheim","hohenheim","hsb"],
  "finance-accounting":["tu_dresden","mannheim","muenster","frankfurt"],
  "entrepreneurship":["tum","leuphana","tu_dresden","pforzheim"],
  "supply-chain":["tu_dresden","tu_bs","kit","worms"],
  "human-resources":["tu_dresden","mannheim","cologne","hsb"],
  "economics":["tu_dresden","mannheim","bonn","tu_berlin"],
  "international-law":["leipzig","humboldt","heidelberg","muenster"],
  "criminal-law":["leipzig","humboldt","heidelberg","muenster"],
  "business-law":["mannheim","frankfurt","muenster","cologne"],
  "architecture":["tu_berlin","tu_bs","tu_darmstadt","stuttgart"],
  "fine-arts":["udk","hfbk","folkwang","hm"],
  "graphic-design":["th_koeln","haw_hamburg","hm","folkwang"],
  "music":["udk","hmt_munich","hfm_berlin","hmt_leipzig"],
  "theater":["leipzig","bayreuth","lmu","humboldt"],
  "film-media":["filmuni","hfbk","hm","tu_berlin"],
  "elementary-education":["tu_dresden","tu_bs","luh","leipzig"],
  "special-education":["tu_dresden","tu_bs","leipzig","potsdam"],
  "educational-psychology":["tu_bs","tu_dresden","potsdam","bielefeld"],
  "curriculum-instruction":["tu_dresden","tu_bs","potsdam","humboldt"],
  "educational-administration":["tu_dresden","tu_bs","potsdam","humboldt"],
  "agricultural-science":["tum","hohenheim","goettingen","bonn"],
  "environmental-management":["tu_berlin","tum","hohenheim","tu_dresden"],
  "forestry":["tu_dresden","goettingen","freiburg","eberswalde"],
  "marine-science":["bremen","kiel","hamburg","rostock"],
  "sustainable-development":["tu_berlin","tum","tu_dresden","hohenheim"],
  "tourism-management":["hsb","harz","worms","hm"],
  "hotel-management":["harz","hsb","hm","worms"],
  "culinary-arts":["hohenheim","fulda","hm","osnabrueck"],
  "event-management":["harz","hsb","osnabrueck","hm"],
  "travel-tourism":["worms","hsb","harz","hm"],
};

const CHECKED = '2026-09-19';

const SRC_BW_TUITION: IntelSource = {
  id: 'bw-non-eu-tuition',
  url: 'https://mwk.baden-wuerttemberg.de/en/higher-education/studying-in-bw/study-financing/tuition-fees-for-international-students',
  title: 'Baden-Württemberg Ministry — tuition fees for international students',
  titleAR: 'وزارة العلوم في بادن-فورتمبيرغ — الرسوم الدراسية للطلاب الدوليين',
  authority: 'government',
  checkedAt: CHECKED,
};
const SRC_TUM_TUITION: IntelSource = {
  id: 'tum-tuition',
  url: 'https://www.tum.de/en/studies/fees',
  title: 'TUM — Study fees and costs',
  titleAR: 'TUM — الرسوم وتكاليف الدراسة',
  authority: 'university',
  checkedAt: CHECKED,
};
const SRC_FRESENIUS_TUITION: IntelSource = {
  id: 'fresenius-tuition',
  url: 'https://www.hs-fresenius.com/faq/',
  title: 'Fresenius University of Applied Sciences — tuition FAQ',
  titleAR: 'جامعة Fresenius للعلوم التطبيقية — الأسئلة الشائعة حول الرسوم',
  authority: 'university',
  checkedAt: CHECKED,
};

const BW_UNIVERSITIES = new Set([
  'stuttgart',
  'kit',
  'mannheim',
  'freiburg',
  'hohenheim',
  'tuebingen',
  'reutlingen',
  'pforzheim',
]);

function tuitionFor(universityId: string): UniversityRecommendationCost {
  if (BW_UNIVERSITIES.has(universityId)) {
    return {
      kind: 'bw_non_eu',
      label: 'Baden-Württemberg: €1,500/semester tuition for non-EU international students; exemptions can apply.',
      labelAR: 'بادن-فورتمبيرغ: رسوم دراسية €1,500 للفصل للطلاب الدوليين من خارج EU؛ قد تنطبق إعفاءات.',
      amount: '€1,500 / semester',
      source: SRC_BW_TUITION,
    };
  }

  if (universityId === 'tum') {
    return {
      kind: 'programme_specific',
      label: 'TUM charges tuition for students from non-EU/EEA countries; the amount is programme-specific.',
      labelAR: 'TUM تفرض رسوماً دراسية على الطلاب من خارج EU/EEA؛ المبلغ يختلف حسب البرنامج.',
      source: SRC_TUM_TUITION,
    };
  }

  if (universityId === 'fresenius') {
    return {
      kind: 'private',
      label: 'Private university: tuition fees apply and vary by programme.',
      labelAR: 'جامعة خاصة: تُفرض رسوم دراسية وتختلف حسب البرنامج.',
      source: SRC_FRESENIUS_TUITION,
    };
  }

  return {
    kind: 'verify',
    label: 'Tuition status: verify the current university/programme fee schedule before advising.',
    labelAR: 'حالة الرسوم: تحقّق من جدول رسوم الجامعة/البرنامج الحالي قبل تقديم النصيحة.',
    source: {
      id: `recommendation-fees-${universityId}`,
      url: U[universityId].url,
      title: `${U[universityId].name} — official study catalogue`,
      titleAR: `${U[universityId].nameAR} — دليل الدراسة الرسمي`,
      authority: 'university',
      checkedAt: CHECKED,
    },
  };
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu, ' ').trim();
}

function sameUniversity(universityId: string, program: ProgramIntel): boolean {
  const u = U[universityId];
  const university = normalizeName(program.universityName);
  const configured = normalizeName(u.name);
  if (university === configured || university.includes(configured) || configured.includes(university)) return true;

  const city = normalizeName(u.city.split('/')[0]);
  const programCity = normalizeName(program.city.split('/')[0]);
  if (!city || city !== programCity) return false;

  const ignored = new Set(['university', 'universitat', 'technical', 'technische', 'of', 'the', 'and', 'für', 'applied', 'sciences']);
  const distinctive = configured
    .split(' ')
    .filter((token) => token.length >= 5 && !ignored.has(token))
    .sort((a, b) => b.length - a.length)
    .slice(0, 2);

  return distinctive.some((token) => university.includes(token));
}

function officialProgramFor(universityId: string, programs: ProgramIntel[]): ProgramIntel | undefined {
  return programs.find((program) => sameUniversity(universityId, program));
}

function build(
  majorId: string,
  uid: string,
  rank: 1 | 2 | 3 | 4,
  programs: ProgramIntel[],
): UniversityRecommendation {
  const u = U[uid];
  const matchedProgram = officialProgramFor(uid, programs);
  const match: RecommendationMatch = matchedProgram ? 'exact' : 'related';
  const programUrl = matchedProgram?.programUrl ?? u.url;
  const programName = matchedProgram?.programName ?? u.name;
  const programNameAR = matchedProgram?.programNameAR ?? u.nameAR;
  const source: IntelSource = matchedProgram
    ? {
        id: `major-rec-${majorId}-${uid}-programme`,
        url: matchedProgram.programUrl,
        title: `${matchedProgram.universityName} — ${matchedProgram.programName}`,
        titleAR: `${matchedProgram.universityNameAR} — ${matchedProgram.programNameAR}`,
        authority: 'university',
        checkedAt: matchedProgram.lastVerified,
      }
    : {
        id: `major-rec-${majorId}-${uid}-catalogue`,
        url: u.url,
        title: `${u.name} — official degree-programme catalogue`,
        titleAR: `${u.nameAR} — دليل البرامج الرسمي`,
        authority: 'university',
        checkedAt: CHECKED,
      };

  return {
    universityId: uid,
    rank,
    primary: rank === 1,
    tu9: u.tu9,
    match,
    focus: matchedProgram?.programName ?? '',
    focusAR: matchedProgram?.programNameAR ?? '',
    programName,
    programNameAR,
    programUrl,
    linkKind: matchedProgram ? 'programme' : 'catalogue',
    linkCheckedAt: matchedProgram ? matchedProgram.lastVerified : null,
    tuition: tuitionFor(uid),
    source,
  };
}

export function getUniversityRecommendations(
  majorId: string,
  programs: ProgramIntel[] = [],
): UniversityRecommendation[] {
  const ids = R[majorId];
  if (!ids) return [];

  const candidates = ids.map((uid, index) =>
    build(majorId, uid, (index + 1) as 1 | 2 | 3 | 4, programs),
  );

  const score = (recommendation: UniversityRecommendation) =>
    (recommendation.tu9 ? 100 : 0) + (recommendation.match === 'exact' ? 10 : 0);

  return candidates
    .sort((a, b) => score(b) - score(a))
    .map((recommendation, index) => ({
      ...recommendation,
      rank: (index + 1) as 1 | 2 | 3 | 4,
      primary: index === 0,
    }));
}

export function attachUniversityRecommendations(major: MajorIntel): MajorIntel {
  return {
    ...major,
    universityRecommendations: getUniversityRecommendations(major.id, major.programs),
  };
}

export function recommendationIntegrity(publicMajorIds: string[]): string[] {
  return publicMajorIds.filter((id) => getUniversityRecommendations(id).length < 4);
}

export function getRecommendedUniversityMeta(universityId:string):UMeta|undefined{
  return U[universityId];
}
