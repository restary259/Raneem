/**
 * Official university homepages for Major Intelligence cards.
 * Source: DARB_Intel_Universities_Official_Websites.pdf (56 institutions).
 * Programme-level URLs stay on the programme/recommendation data as evidence.
 */
const SITES: Record<string, string> = {
  'Berlin University of the Arts (UdK Berlin)': 'www.udk-berlin.de/en',
  'Bielefeld University': 'www.uni-bielefeld.de/en',
  'Eberswalde University for Sustainable Development': 'www.hnee.de/en',
  'FAU Erlangen-Nürnberg': 'www.fau.eu',
  'Film University Babelsberg KONRAD WOLF': 'www.filmuniversitaet.de/en',
  'Folkwang University of the Arts': 'www.folkwang-uni.de/en',
  'Goethe University Frankfurt': 'www.uni-frankfurt.de/en',
  'Hanns Eisler School of Music Berlin': 'www.hfm-berlin.de/en',
  'Harz University of Applied Sciences': 'www.hs-harz.de/en',
  'HAW Hamburg': 'www.haw-hamburg.de/en',
  'Heidelberg University': 'www.uni-heidelberg.de/en',
  'HFBK Hamburg': 'www.hfbk-hamburg.de/en',
  'Hochschule Bremen': 'www.hs-bremen.de/en',
  'Hochschule Fresenius': 'www.hs-fresenius.com',
  'Hochschule Fulda': 'www.hs-fulda.de/en',
  'HTW Berlin': 'www.htw-berlin.de/en',
  'Humboldt-Universität zu Berlin': 'www.hu-berlin.de/en',
  'Johannes Gutenberg University Mainz': 'www.uni-mainz.de/en',
  'Karlsruhe Institute of Technology (KIT)': 'www.kit.edu',
  'Kiel University': 'www.uni-kiel.de/en',
  'Leibniz University Hannover': 'www.uni-hannover.de/en',
  'Leipzig University': 'www.uni-leipzig.de/en',
  'Leuphana University Lüneburg': 'www.leuphana.de/en',
  'LMU Munich': 'www.lmu.de/en',
  'Munich University of Applied Sciences': 'hm.edu/en',
  'Osnabrück University of Applied Sciences': 'www.hs-osnabrueck.de/en',
  'Pforzheim University': 'www.hs-pforzheim.de/en',
  'Reutlingen University': 'www.reutlingen-university.de/en',
  'RWTH Aachen University': 'www.rwth-aachen.de',
  'Saarland University': 'www.uni-saarland.de/en',
  'Technical University of Munich (TUM)': 'www.tum.de/en',
  'TH Köln': 'www.th-koeln.de/en',
  'TU Berlin': 'www.tu.berlin/en',
  'TU Braunschweig': 'www.tu-braunschweig.de/en',
  'TU Darmstadt': 'www.tu-darmstadt.de',
  'TU Dortmund University': 'www.tu-dortmund.de/en',
  'TUD Dresden University of Technology': 'tu-dresden.de',
  'University of Augsburg': 'www.uni-augsburg.de/en',
  'University of Bayreuth': 'www.uni-bayreuth.de/en',
  'University of Bonn': 'www.uni-bonn.de/en',
  'University of Bremen': 'www.uni-bremen.de/en',
  'University of Cologne': 'uni-koeln.de/en',
  'University of Freiburg': 'uni-freiburg.de/en',
  'University of Göttingen': 'www.uni-goettingen.de/en',
  'University of Hohenheim': 'www.uni-hohenheim.de/en',
  'University of Mannheim': 'www.uni-mannheim.de/en',
  'University of Music and Theatre Leipzig': 'www.hmt-leipzig.de/en',
  'University of Music and Theatre Munich': 'hmtm.de/en',
  'University of Münster': 'www.uni-muenster.de/en',
  'University of Potsdam': 'www.uni-potsdam.de/en',
  'University of Rostock': 'www.uni-rostock.de/en',
  'University of Stuttgart': 'www.uni-stuttgart.de/en',
  'University of Tübingen': 'uni-tuebingen.de/en',
  'University of Veterinary Medicine Hannover (TiHo)': 'www.tiho-hannover.de/en',
  'Universität Hamburg': 'www.uni-hamburg.de/en',
  'Worms University of Applied Sciences': 'www.hs-worms.de/en',
  'University of Oldenburg': 'uol.de/en/',
  'Hochschule Ansbach': 'www.hs-ansbach.de/en/',
  'University of Bamberg': 'www.uni-bamberg.de/en/',
};

/** Alternate spellings used in programme data → canonical list name. */
const ALIASES: Record<string, string> = {
  'Friedrich-Alexander-Universität Erlangen-Nürnberg (FAU)': 'FAU Erlangen-Nürnberg',
  'Technische Universität Darmstadt': 'TU Darmstadt',
  'Technische Universität München (TUM)': 'Technical University of Munich (TUM)',
  'Universität Stuttgart': 'University of Stuttgart',
  'Ansbach University of Applied Sciences': 'Hochschule Ansbach',
};

export const UNIVERSITY_WEBSITES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(SITES).map(([name, host]) => [name, `https://${host}`]),
);

export function getUniversityWebsite(name: string | undefined | null): string | undefined {
  if (!name) return undefined;
  return UNIVERSITY_WEBSITES[ALIASES[name] ?? name];
}
