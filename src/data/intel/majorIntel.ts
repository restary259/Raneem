/**
 * DARB Major Intelligence — registry + alias search.
 *
 * Verified majors are hand-written intelligence entries. Every other major from
 * the public dataset is exposed as an honest stub (`status: 'not_verified'`) so
 * a team member searching for it gets "not verified yet", never public prose
 * dressed up as an internal requirement.
 */
import { majorsData } from '@/data/majorsData';
import type { MajorIntel } from './types';
import { COMPUTER_SCIENCE_INTEL } from './computerScience';
import { ENGINEERING_TECHNOLOGY_MAJORS } from './engineeringTechnology';
import { COMPUTER_IT_MAJORS } from './computerIt';
import { REMAINING_MAJOR_INTEL } from './remainingMajorIntel';
import { attachUniversityRecommendations } from './universityRecommendations';

export const VERIFIED_MAJORS: MajorIntel[] = [
  COMPUTER_SCIENCE_INTEL,
  ...ENGINEERING_TECHNOLOGY_MAJORS,
  ...COMPUTER_IT_MAJORS,
  ...REMAINING_MAJOR_INTEL,
];

const VERIFIED_IDS = new Set(VERIFIED_MAJORS.map((m) => m.id));
/** Public-dataset ids that the verified entries already cover. */
const COVERED_PUBLIC_IDS = new Set(['computer-science', 'informatik', 'software-engineering']);

const STUBS: MajorIntel[] = majorsData.flatMap((category) =>
  category.subMajors
    .filter((m) => !VERIFIED_IDS.has(m.id) && !COVERED_PUBLIC_IDS.has(m.id))
    .map<MajorIntel>((m) => ({
      id: m.id,
      canonicalEN: m.nameEN,
      canonicalAR: m.nameAR,
      nameDE: m.nameDE ?? '',
      degreeLevel: 'bachelor',
      aliases: {
        ar: [m.nameAR],
        he: [],
        en: [m.nameEN],
        de: m.nameDE ? [m.nameDE] : [],
      },
      status: 'not_verified',
      programs: [],
      sources: [],
    })),
);

export const ALL_MAJOR_INTEL: MajorIntel[] = [...VERIFIED_MAJORS, ...STUBS].map(attachUniversityRecommendations);

export function getMajorIntel(id: string): MajorIntel | undefined {
  return ALL_MAJOR_INTEL.find((m) => m.id === id);
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, '') // Arabic diacritics
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

function haystack(m: MajorIntel): string {
  return normalize(
    [
      m.canonicalEN,
      m.canonicalAR,
      m.nameDE,
      ...m.aliases.ar,
      ...m.aliases.he,
      ...m.aliases.en,
      ...m.aliases.de,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

/**
 * Resolves an Arabic / Hebrew / English / German query onto canonical majors.
 * Verified entries always rank first.
 */
export function searchMajors(query: string, limit = 12): MajorIntel[] {
  const q = normalize(query);
  if (!q) return VERIFIED_MAJORS.slice(0, limit);

  const scored = ALL_MAJOR_INTEL.map((m) => {
    const hay = haystack(m);
    let score = 0;
    if (hay.split(' ').includes(q)) score = 3;
    else if (hay.includes(q)) score = 2;
    else if (q.length >= 3 && hay.split(' ').some((w) => w.startsWith(q))) score = 1;
    if (score && m.status === 'verified') score += 5;
    return { m, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((x) => x.m);
}
