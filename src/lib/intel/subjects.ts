/**
 * Flat subject index for the internal major lookup.
 *
 * The subject list itself comes from the public majors dataset (so every
 * subject the agency talks about is searchable). Verified intelligence, when a
 * subject has any, is attached from `@/data/intel`. Nothing is invented here.
 */
import { majorsData } from '@/data/majorsData';
import { getMajorIntel } from '@/data/intel/majorIntel';
import type { MajorIntel } from '@/data/intel/types';

export interface SubjectEntry {
  id: string;
  nameAR: string;
  nameEN: string;
  nameDE: string;
  categoryAR: string;
  categoryEN: string;
  intel?: MajorIntel;
}

function intelFor(id: string): MajorIntel | undefined {
  const direct = getMajorIntel(id);
  if (direct && direct.status === 'verified') return direct;
  return direct;
}

export const SUBJECTS: SubjectEntry[] = majorsData.flatMap((category) =>
  category.subMajors.map<SubjectEntry>((subject) => ({
    id: subject.id,
    nameAR: subject.nameAR,
    nameEN: subject.nameEN,
    nameDE: subject.nameDE ?? '',
    categoryAR: category.title,
    categoryEN: category.titleEN,
    intel: intelFor(subject.id),
  })),
);

export function getSubject(id: string): SubjectEntry | undefined {
  return SUBJECTS.find((s) => s.id === id);
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

function haystack(subject: SubjectEntry): string {
  const aliases = subject.intel
    ? [...subject.intel.aliases.ar, ...subject.intel.aliases.he, ...subject.intel.aliases.en, ...subject.intel.aliases.de]
    : [];
  return normalize([subject.nameAR, subject.nameEN, subject.nameDE, ...aliases].filter(Boolean).join(' '));
}

/** Arabic / Hebrew / English / German search over the subject list. */
export function searchSubjects(query: string): SubjectEntry[] {
  const q = normalize(query);
  if (!q) return [];
  return SUBJECTS.filter((subject) => haystack(subject).includes(q));
}
