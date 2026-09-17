/**
 * The left-hand journey steps and what each one points at inside the
 * programme pane. A step is only clickable when the selected programme
 * actually carries content for it.
 */
import type { MajorIntel, ProgramIntel } from '@/data/intel/types';
import type { VerifiedFact } from '@/data/intel/factTypes';

export type JourneyId =
  | 'major'
  | 'bagrut'
  | 'german'
  | 'universities'
  | 'application'
  | 'documents'
  | 'deadlines'
  | 'after';

export type ProgramTab = 'requirements' | 'application' | 'documents' | 'sources';

export interface JourneyTarget {
  tab: ProgramTab;
  /** DOM id of the section to scroll to and highlight. */
  section: string;
}

export const JOURNEY_TARGET: Record<JourneyId, JourneyTarget> = {
  major: { tab: 'sources', section: 'intel-sec-sources' },
  bagrut: { tab: 'requirements', section: 'intel-sec-bagrut' },
  german: { tab: 'requirements', section: 'intel-sec-german' },
  universities: { tab: 'requirements', section: 'intel-sec-overview' },
  application: { tab: 'application', section: 'intel-sec-application' },
  documents: { tab: 'documents', section: 'intel-sec-documents' },
  deadlines: { tab: 'application', section: 'intel-sec-deadline' },
  after: { tab: 'requirements', section: 'intel-sec-after' },
};

const hasFact = (f?: VerifiedFact<unknown> | null) =>
  Boolean(f && (f.value !== null || f.status === 'conflicting' || Boolean(f.note)));

export function journeyAvailability(
  major: MajorIntel | null,
  program: ProgramIntel | undefined,
  hasGuidance = false,
): Record<JourneyId, boolean> {
  const verified = Boolean(major && major.status === 'verified');
  return {
    major: Boolean(major && major.sources.length > 0),
    bagrut: Boolean(verified && program && (hasFact(program.subjectRequirements) || hasFact(program.gradeRequirement))),
    german: Boolean(verified && program && hasFact(program.languageRequirement)),
    universities: Boolean(verified && program),
    application: Boolean(
      verified && program && (hasFact(program.applicationChannel) || hasFact(program.admissionMode)),
    ),
    documents: Boolean(verified && program && hasFact(program.documents)),
    deadlines: Boolean(verified && program && hasFact(program.deadline)),
    after: Boolean(verified && hasGuidance),
  };
}
