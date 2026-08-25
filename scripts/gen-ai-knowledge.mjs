/**
 * Generates the AI assistant's knowledge module from the app's REAL datasets.
 *
 * Single source of truth: `src/data/majorsData.ts` and
 * `src/data/educationalDestinations.ts` are the authoritative public content.
 * The AI edge function must never carry a hand-maintained second copy of those
 * facts — that is exactly what drifted before. Re-run this script whenever the
 * datasets change:
 *
 *   bun run scripts/gen-ai-knowledge.mjs
 *
 * Output: supabase/functions/ai-chat/knowledge.generated.ts
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const { majorsData } = await import(resolve(root, "src/data/majorsData.ts"));
const { universities, languageSchools } = await import(
  resolve(root, "src/data/educationalDestinations.ts")
);

const categories = majorsData.map((c) => ({
  id: c.id,
  titleAR: c.title,
  titleEN: c.titleEN,
  majorIds: c.subMajors.map((m) => m.id),
}));

const majors = majorsData.flatMap((c) =>
  c.subMajors.map((m) => ({
    id: m.id,
    categoryId: c.id,
    categoryAR: c.title,
    categoryEN: c.titleEN,
    nameAR: m.nameAR,
    nameEN: m.nameEN,
    nameDE: m.nameDE ?? null,
    summaryAR: m.detailedDescription ?? m.description ?? null,
    summaryEN: m.detailedDescriptionEN ?? m.descriptionEN ?? null,
    durationAR: m.duration ?? null,
    durationEN: m.durationEN ?? null,
    languageAR: m.languageRequirements ?? null,
    languageEN: m.languageRequirementsEN ?? null,
    backgroundAR: m.requiredBackground ?? m.requirements ?? null,
    backgroundEN: m.requiredBackgroundEN ?? m.requirementsEN ?? null,
    careersAR: m.careerOpportunities ?? m.careerProspects ?? null,
    careersEN: m.careerOpportunitiesEN ?? m.careerProspectsEN ?? null,
    arab48AR: m.arab48Notes ?? null,
    arab48EN: m.arab48NotesEN ?? null,
  })),
);

const strip = (s) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : s);

const uniList = (universities.germany ?? []).map((u) => ({
  name: u.name,
  location: strip(u.location),
  focus: Array.isArray(u.majors) ? u.majors : [],
  ranking: strip(u.ranking) ?? null,
  officialUrl: u.officialUrl ?? null,
}));

const schoolList = (languageSchools.germany ?? []).map((s) => ({
  name: s.name,
  location: strip(s.location),
  programs: Array.isArray(s.programs) ? s.programs : [],
}));

const banner = `// AUTO-GENERATED — DO NOT EDIT BY HAND.
// Source of truth: src/data/majorsData.ts + src/data/educationalDestinations.ts
// Regenerate with: bun run scripts/gen-ai-knowledge.mjs
// Generated: ${new Date().toISOString().slice(0, 10)}
`;

const out = `${banner}
export interface KnownMajor {
  id: string;
  categoryId: string;
  categoryAR: string;
  categoryEN: string;
  nameAR: string;
  nameEN: string;
  nameDE: string | null;
  summaryAR: string | null;
  summaryEN: string | null;
  durationAR: string | null;
  durationEN: string | null;
  languageAR: string | null;
  languageEN: string | null;
  backgroundAR: string | null;
  backgroundEN: string | null;
  careersAR: string | null;
  careersEN: string | null;
  arab48AR: string | null;
  arab48EN: string | null;
}

export interface KnownCategory {
  id: string;
  titleAR: string;
  titleEN: string;
  majorIds: string[];
}

export interface KnownUniversity {
  name: string;
  location: string;
  focus: string[];
  ranking: string | null;
  officialUrl: string | null;
}

export interface KnownLanguageSchool {
  name: string;
  location: string;
  programs: string[];
}

export const CATEGORIES: KnownCategory[] = ${JSON.stringify(categories, null, 2)};

export const MAJORS: KnownMajor[] = ${JSON.stringify(majors, null, 2)};

export const UNIVERSITIES: KnownUniversity[] = ${JSON.stringify(uniList, null, 2)};

export const LANGUAGE_SCHOOLS: KnownLanguageSchool[] = ${JSON.stringify(schoolList, null, 2)};
`;

const target = resolve(root, "supabase/functions/ai-chat/knowledge.generated.ts");
writeFileSync(target, out, "utf8");
console.log(
  `Wrote ${target}\n  ${categories.length} categories, ${majors.length} majors, ${uniList.length} universities, ${schoolList.length} language schools`,
);
