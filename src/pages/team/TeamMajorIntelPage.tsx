import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ShieldCheck, ExternalLink } from 'lucide-react';
import { PageHeader, SectionCard, EmptyState } from '@/components/shell';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AUTHORITY_TIER } from '@/data/intel/factTypes';
import { searchMajors } from '@/data/intel/majorIntel';
import { CS_GUIDANCE } from '@/data/intel/computerScience';
import type { MajorIntel } from '@/data/intel/types';
import { EMPTY_INTAKE, missingIntakeFields, calculateGermanGrade, type StudentIntake } from '@/lib/eligibility/engine';
import IntakeForm from '@/components/team/intel/IntakeForm';
import ProgramCard from '@/components/team/intel/ProgramCard';
import { FactLine, VerificationBadge } from '@/components/team/intel/FactBadge';

const QUESTIONS: { key: string; fallback: string; why: string }[] = [
  { key: 'mathUnits', fallback: 'Maths units and grade', why: 'Programme prerequisite and access rule' },
  { key: 'englishUnits', fallback: 'English units and grade', why: 'Access rule for direct university entry' },
  { key: 'furtherSubject', fallback: 'One further subject at 4 units and its grade', why: 'Access rule for direct university entry' },
  { key: 'bagrutAverage', fallback: 'Overall Bagrut result', why: 'Needed for the grade conversion' },
  { key: 'fullBagrut', fallback: 'Is the Bagrut certificate complete?', why: 'Higher-education eligibility' },
  { key: 'germanLevel', fallback: 'Current German level', why: 'Language requirement per programme' },
  { key: 'germanCertificate', fallback: 'Certificate held or expected, and its date', why: 'Only a certificate proves the level' },
  { key: 'documents', fallback: 'Passport and document route', why: 'Application and visa handling' },
];

export default function TeamMajorIntelPage() {
  const { t, i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<MajorIntel | null>(null);
  const [intake, setIntake] = useState<StudentIntake>(EMPTY_INTAKE);

  const results = useMemo(() => searchMajors(query), [query]);
  const major = selected;
  const calc = calculateGermanGrade(intake);
  const stillMissing = missingIntakeFields(intake);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('intel.title', 'Major Intelligence')}
        subtitle={t(
          'intel.subtitle',
          'Verified admission facts for Arab 48 applicants with an Israeli Bagrut. No source, no fact.',
        )}
      />

      <SectionCard title={t('intel.search', 'Search a major')} icon={Search}>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('intel.searchPlaceholder', 'علوم الحاسوب · מדעי המחשב · Computer Science · Informatik')}
          className="mb-3"
        />
        <div className="flex flex-wrap gap-2">
          {results.map((m) => (
            <Button
              key={m.id}
              size="sm"
              variant={major?.id === m.id ? 'default' : 'outline'}
              onClick={() => setSelected(m)}
              className="gap-2"
            >
              {isAr ? m.canonicalAR : m.canonicalEN}
              {m.status === 'verified' ? (
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
              ) : (
                <span className="text-[10px] opacity-70">{t('intel.status.unverified', 'not verified')}</span>
              )}
            </Button>
          ))}
          {results.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('intel.noMatch', 'No major matches this search.')}</p>
          )}
        </div>
      </SectionCard>

      {!major && (
        <EmptyState
          title={t('intel.pickTitle', 'Select a major to start')}
          description={t(
            'intel.pickBody',
            'The tool answers one question: can this student proceed, and what must we check first.',
          )}
        />
      )}

      {major && major.status !== 'verified' && (
        <SectionCard title={isAr ? major.canonicalAR : major.canonicalEN}>
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {t(
              'intel.notVerifiedBody',
              'This major has not been verified against official sources yet. Do not advise the student from the public page — escalate for verification.',
            )}
          </p>
        </SectionCard>
      )}

      {major && major.status === 'verified' && (
        <>
          <SectionCard
            title={`${isAr ? major.canonicalAR : major.canonicalEN} · ${major.nameDE}`}
            description={t('intel.profile', 'Israeli Bagrut · Israeli passport · Arab 48 applicant')}
            actions={<VerificationBadge status="verified" checkedAt={major.lastVerified ?? null} />}
          >
            {major.bagrutAccess && (
              <FactLine
                label={t('intel.fact.access', 'University access rule')}
                f={major.bagrutAccess}
                render={(v) => {
                  const a = v as { mathUnits: number; englishUnits: number; furtherUnits: number };
                  return `${t('intel.row.math', 'Mathematics units')} ${a.mathUnits} · ${t('intel.row.english', 'English units')} ${a.englishUnits} · ${t('intel.row.further', 'Further subject units')} ${a.furtherUnits}`;
                }}
                sourceUrl={major.sources.find((s) => s.id === major.bagrutAccess?.sourceId)?.url}
              />
            )}
            {major.gradeConversion && (
              <FactLine
                label={t('intel.fact.conversion', 'Grade conversion procedure')}
                f={major.gradeConversion}
                sourceUrl={major.sources.find((s) => s.id === major.gradeConversion?.sourceId)?.url}
              />
            )}
            {major.language && <FactLine label={t('intel.fact.language', 'Language')} f={major.language} />}
          </SectionCard>

          <SectionCard title={t('intel.intake', 'Student intake')} collapsible defaultOpen>
            <IntakeForm intake={intake} onChange={setIntake} />
            <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
              {calc ? (
                <p>
                  <span className="font-semibold">{t('intel.calculatedGrade', 'Calculated German grade')}: </span>
                  {calc.german.toFixed(2)} —{' '}
                  <span className="text-sky-700 dark:text-sky-400">
                    {t('intel.calculatedOnly', 'Calculated — not an admission decision')}
                  </span>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  {t('intel.noGradeYet', 'Enter the overall Bagrut result to calculate the German grade.')}
                </p>
              )}
              {stillMissing.length > 0 && (
                <p className="mt-1 text-amber-700 dark:text-amber-400">
                  {t('intel.stillMissing', 'Still unanswered')}: {stillMissing.length}
                </p>
              )}
            </div>
          </SectionCard>

          <SectionCard title={t('intel.questions', 'What the team must ask')} collapsible defaultOpen={false}>
            <ul className="space-y-2">
              {QUESTIONS.map((q) => (
                <li key={q.key} className="text-sm">
                  <span className="font-medium">{t(`intel.q.${q.key}`, q.fallback)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t(`intel.qWhy.${q.key}`, q.why)}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>

          <div className="space-y-4">
            {major.programs.map((p) => (
              <ProgramCard key={p.id} major={major} program={p} intake={intake} sources={major.sources} />
            ))}
          </div>

          <SectionCard title={t('intel.guidance', 'DARB operational guidance')} collapsible defaultOpen={false}>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {CS_GUIDANCE.map((g, i) => (
                <li key={i}>{isAr ? g.noteAR : g.value}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('intel.guidanceNote', 'Internal guidance — never presented to a student as an official rule.')}
            </p>
          </SectionCard>

          <SectionCard title={t('intel.sources', 'Verified sources')} collapsible defaultOpen={false}>
            <ul className="space-y-2">
              {major.sources.map((s) => (
                <li key={s.id} className="text-sm">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-brand underline underline-offset-2"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    {isAr ? (s.titleAR ?? s.title) : s.title}
                  </a>
                  <Badge variant="outline" className="ms-2 text-[10px]">
                    {t('intel.tier', 'Tier')} {AUTHORITY_TIER[s.authority]} · {s.authority}
                  </Badge>
                  <span className="ms-2 text-xs text-muted-foreground">
                    {new Date(s.checkedAt).toLocaleDateString('en-US')}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </>
      )}
    </div>
  );
}
