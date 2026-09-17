import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { MajorIntel, ProgramIntel } from '@/data/intel/types';
import type { IntelSource } from '@/data/intel/factTypes';
import { evaluateProgram, type CheckRow, type StudentIntake } from '@/lib/eligibility/engine';
import { CheckBadge, FactLine, VerificationBadge } from './FactBadge';

const ROW_LABEL: Record<string, string> = {
  math: 'Mathematics units',
  english: 'English units',
  further: 'Further subject units',
  fullBagrut: 'Full Bagrut certificate',
  'subject.programme': 'Programme subject requirements',
  language: 'German language requirement',
  grade: 'Converted grade vs published threshold',
  channel: 'Application channel',
  deadline: 'Application deadline',
};

export function RowLine({ row }: { row: CheckRow }) {
  const { t, i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';
  const note = isAr ? (row.noteAR ?? row.note) : row.note;
  const requirement = isAr ? (row.requirementAR ?? row.requirement) : row.requirement;

  return (
    <div className="grid grid-cols-1 gap-1 border-b border-border/40 py-2 last:border-0 sm:grid-cols-[1fr_auto]">
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">
            {t(`intel.row.${row.key}`, ROW_LABEL[row.key] ?? row.key)}
          </span>
          {row.calculated && (
            <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400">
              {t('intel.calculatedOnly', 'Calculated — not an admission decision')}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          <span>
            {t('intel.official', 'Official')}: {requirement ?? t('intel.none', 'none published')}
          </span>
          <span className="mx-2">·</span>
          <span>
            {t('intel.student', 'Student')}: {row.studentValue ?? t('intel.notAsked', 'not asked yet')}
          </span>
        </div>
        {note && <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">{note}</p>}
      </div>
      <div className="sm:self-center">
        <CheckBadge status={row.status} />
      </div>
    </div>
  );
}

export default function ProgramCard({
  major,
  program,
  intake,
  sources,
}: {
  major: MajorIntel;
  program: ProgramIntel;
  intake: StudentIntake;
  sources: IntelSource[];
}) {
  const { t, i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';
  const assessment = evaluateProgram(major, program, intake);
  const srcUrl = (id?: string | null) => sources.find((s) => s.id === id)?.url;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{isAr ? program.universityNameAR : program.universityName}</h2>
          <p className="text-sm text-muted-foreground">{isAr ? program.programNameAR : program.programName} · {isAr ? program.cityAR : program.city}</p>
        </div>
        <div className="flex items-center gap-2">
          <VerificationBadge status="verified" checkedAt={program.lastVerified} />
          <CheckBadge status={assessment.overall} />
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-3">
        <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{t('intel.teamAction', 'Team action')}</p>
        <p className="text-sm">
          {assessment.missing.length > 0
            ? `${t('intel.actionBlocked', 'Do not present this programme as available until these are resolved')}: ${assessment.missing.map((k) => t(`intel.row.${k}`, ROW_LABEL[k] ?? k)).join(' · ')}`
            : assessment.toVerify.length > 0
              ? `${t('intel.actionVerify', 'Verify or ask the student before advising')}: ${assessment.toVerify.map((k) => t(`intel.row.${k}`, ROW_LABEL[k] ?? k)).join(' · ')}`
              : t('intel.actionClear', 'Every checked requirement is met on the recorded evidence.')}
        </p>
      </div>

      <Tabs defaultValue="requirements" className="min-w-0">
        <TabsList className="grid h-auto w-full grid-cols-4">
          <TabsTrigger value="requirements" className="px-1 text-xs">{t('intel.tab.requirements', 'Requirements')}</TabsTrigger>
          <TabsTrigger value="application" className="px-1 text-xs">{t('intel.tab.application', 'Application')}</TabsTrigger>
          <TabsTrigger value="documents" className="px-1 text-xs">{t('intel.tab.documents', 'Documents')}</TabsTrigger>
          <TabsTrigger value="sources" className="px-1 text-xs">{t('intel.tab.sources', 'Sources')}</TabsTrigger>
        </TabsList>
        <TabsContent value="requirements" className="mt-3">
          {assessment.rows.map((r) => (
            <RowLine key={r.key} row={r} />
          ))}
        </TabsContent>
        <TabsContent value="application" className="mt-3">
          <FactLine
            label={t('intel.fact.teachingLanguage', 'Teaching language')}
            f={program.teachingLanguage}
            render={(v) => (v as string[]).join(', ')}
            sourceUrl={srcUrl(program.teachingLanguage.sourceId)}
          />
          <FactLine
            label={t('intel.fact.admissionMode', 'Admission mode')}
            f={program.admissionMode}
            render={(v) => t(`intel.admission.${v as string}`, String(v))}
            sourceUrl={srcUrl(program.admissionMode.sourceId)}
          />
          <FactLine
            label={t('intel.fact.channel', 'Application channel')}
            f={program.applicationChannel}
            render={(v) => t(`intel.channel.${v as string}`, String(v))}
            sourceUrl={srcUrl(program.applicationChannel.sourceId)}
          />
          <FactLine
            label={t('intel.fact.foreignQualification', 'Foreign qualification route')}
            f={program.foreignQualification}
            sourceUrl={srcUrl(program.foreignQualification.sourceId)}
          />
          <FactLine
            label={t('intel.fact.entrance', 'Entrance procedure')}
            f={program.entranceRequirement}
            sourceUrl={srcUrl(program.entranceRequirement.sourceId)}
          />
          <FactLine
            label={t('intel.fact.deadline', 'Deadline')}
            f={program.deadline}
            render={(v) => {
              const d = v as { semester: string; semesterAR: string; deadline: string };
              return `${isAr ? d.semesterAR : d.semester} — ${d.deadline}`;
            }}
            sourceUrl={srcUrl(program.deadline.sourceId)}
          />
          {program.deadline.status === 'conflicting' &&
            program.deadline.conflict?.map((c, i) => {
              const s = sources.find((x) => x.id === c.sourceId);
              return (
                <div key={i} className="ms-3 border-s-2 border-orange-500/40 ps-3 text-xs">
                  <span className="font-medium">{c.value.deadline}</span>{' '}
                  <a href={s?.url} target="_blank" rel="noreferrer" className="text-brand underline">
                    {s?.title}
                  </a>
                </div>
              );
            })}
        </TabsContent>
        <TabsContent value="documents" className="mt-3">
          <FactLine
            label={t('intel.fact.documents', 'Documents')}
            f={program.documents}
            render={(v) => (v as string[]).join(' · ')}
            sourceUrl={srcUrl(program.documents.sourceId)}
          />
          {program.fees && (
            <FactLine
              label={t('intel.fact.fees', 'Fees')}
              f={program.fees}
              sourceUrl={srcUrl(program.fees.sourceId)}
            />
          )}
        </TabsContent>
        <TabsContent value="sources" className="mt-3 space-y-2">
          {[program.teachingLanguage, program.admissionMode, program.applicationChannel, program.foreignQualification, program.entranceRequirement, program.deadline, program.documents, program.fees]
            .filter((fact) => fact?.sourceId)
            .map((fact) => sources.find((source) => source.id === fact?.sourceId))
            .filter((source, index, all) => source && all.findIndex((item) => item?.id === source.id) === index)
            .map((source) => source && (
              <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="flex items-start gap-2 rounded-md border border-border p-3 text-sm hover:bg-accent">
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>{isAr ? (source.titleAR ?? source.title) : source.title}</span>
              </a>
            ))}
        </TabsContent>
      </Tabs>
        <a
          href={program.programUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-brand underline underline-offset-2"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          {t('intel.openProgramPage', 'Open the official programme page')}
        </a>
    </div>
  );
}
