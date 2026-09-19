/**
 * The internal major card: one subject, five tabs.
 *
 * Every line either comes from verified intelligence (`@/data/intel`), from the
 * agency catalog (`schools`), or is an explicit calculation / internal guidance
 * that is labelled as such. Subjects without verified content show an honest
 * "not filled in yet" line — never public marketing prose.
 */
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink, Globe, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTeamCatalog } from '@/hooks/useTeamCatalog';
import { bagrutToGermanGrade } from '@/utils/gradeConverter';
import type { SubjectEntry } from '@/lib/intel/subjects';
import type { ProgramIntel } from '@/data/intel/types';

const GRADE_SCALE = [95, 90, 85, 80, 75, 70, 65, 60, 55];

function Empty() {
  const { t } = useTranslation('dashboard');
  return (
    <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
      {t('intel.card.empty', 'Not filled in yet.')}
    </p>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-border/50 py-2.5 last:border-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

export default function MajorCard({ subject, onBack }: { subject: SubjectEntry; onBack: () => void }) {
  const { t, i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';
  const { data } = useTeamCatalog();
  const intel = subject.intel?.status === 'verified' ? subject.intel : undefined;
  const programs: ProgramIntel[] = intel?.programs ?? [];

  const schools = useMemo(() => data?.schools ?? [], [data]);
  const cities = useMemo(
    () => Array.from(new Set(schools.map((s) => s.city).filter((c): c is string => Boolean(c)))).sort(),
    [schools],
  );

  const name = isAr ? subject.nameAR : subject.nameEN;
  const category = isAr ? subject.categoryAR : subject.categoryEN;
  const languageLabel = (language: 'German' | 'English') =>
    t('intel.language.' + language.toLowerCase(), language);

  return (
    <Card className="border-border">
      <CardHeader className="gap-3 border-b border-border">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="h-8 w-fit gap-1.5 px-2">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          {t('intel.card.back', 'All subjects')}
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">{name}</h2>
            <p className="text-sm text-muted-foreground">
              {isAr ? subject.nameEN : subject.nameAR}
              {subject.nameDE && ` · ${subject.nameDE}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{category}</Badge>
            {intel ? (
              <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400">
                {t('intel.status.verified', 'Verified')}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                {t('intel.card.notFilled', 'No content yet')}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <Tabs defaultValue="language">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5">
            <TabsTrigger value="language" className="px-1 text-xs">{t('intel.card.tabLanguage', 'Language')}</TabsTrigger>
            <TabsTrigger value="bagrut" className="px-1 text-xs">{t('intel.card.tabBagrut', 'Bagrut')}</TabsTrigger>
            <TabsTrigger value="schools" className="px-1 text-xs">{t('intel.card.tabSchools', 'Our schools')}</TabsTrigger>
            <TabsTrigger value="deadlines" className="px-1 text-xs">{t('intel.card.tabDeadlines', 'Deadlines')}</TabsTrigger>
            <TabsTrigger value="universities" className="px-1 text-xs">{t('intel.card.tabUniversities', 'Universities')}</TabsTrigger>
          </TabsList>

          {/* Language ------------------------------------------------------ */}
          <TabsContent value="language" className="mt-4 space-y-3">
            {programs.length === 0 ? (
              <Empty />
            ) : (
              programs.map((program) => {
                const req = program.languageRequirement;
                const value = req.status === 'verified' ? req.value : null;
                const teaching =
                  program.teachingLanguage.status === 'verified' ? program.teachingLanguage.value.join(' / ') : null;
                return (
                  <div key={program.id} className="space-y-2 rounded-md border border-border p-3">
                    <Row label={isAr ? program.universityNameAR : program.universityName}>
                      {teaching ? (
                        <span className="font-medium">
                          {t('intel.card.teachingLanguage', 'Teaching language')}: {teaching
                            .split(' / ')
                            .map((language) => languageLabel(language as 'German' | 'English'))
                            .join(' / ')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {t('intel.none', 'none published')}
                        </span>
                      )}
                    </Row>
                    {value ? (
                      <>
                        <Row label={t('intel.card.requiredLevel', 'Required CEFR level')}>
                          <span className="font-semibold">
                            {languageLabel(value.language)} {value.minimumLevel}
                          </span>
                        </Row>
                        <div>
                          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                            {t('intel.card.levelMap', 'CEFR level map')}
                          </p>
                          <div className="grid grid-cols-6 gap-1">
                            {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((level) => {
                              const requiredIndex = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].indexOf(value.minimumLevel);
                              const levelIndex = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].indexOf(level);
                              const isRequired = level === value.minimumLevel;
                              const isBelow = levelIndex < requiredIndex;
                              return (
                                <div
                                  key={level}
                                  className={`rounded-md border px-1.5 py-2 text-center text-xs ${isRequired ? 'border-primary bg-primary/10 font-semibold text-primary' : isBelow ? 'opacity-45' : ''}`}
                                >
                                  <div>{level}</div>
                                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                                    {isRequired
                                      ? t('intel.card.required', 'required')
                                      : isBelow
                                        ? t('intel.card.below', 'below')
                                        : t('intel.card.above', 'meets')}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {value.certificates.length > 0 && (
                          <Row label={t('intel.card.acceptedProof', 'Accepted proof')}>
                            <span className="text-muted-foreground">{value.certificates.join(' · ')}</span>
                          </Row>
                        )}
                        {value.additionalLanguage && (
                          <Row label={t('intel.card.additionalLanguage', 'Additional language')}>
                            <span className="font-medium">
                              {languageLabel(value.additionalLanguage.language)} {value.additionalLanguage.minimumLevel}
                            </span>
                            {value.additionalLanguage.certificates.length > 0 && (
                              <span className="text-muted-foreground"> · {value.additionalLanguage.certificates.join(' · ')}</span>
                            )}
                          </Row>
                        )}
                      </>
                    ) : (
                      <Row label={t('intel.card.requiredLevel', 'Required CEFR level')}>
                        <span className="text-muted-foreground">{t('intel.none', 'none published')}</span>
                      </Row>
                    )}
                  </div>
                );
              })
            )}
            <p className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              {t(
                'intel.card.languageTiming',
                'German-course planning only: reaching B2 takes about 10 months of full-time study, and about 12 months including a Telc, TestDaF or DSH exam.',
              )}
            </p>
          </TabsContent>

          {/* Bagrut -------------------------------------------------------- */}
          <TabsContent value="bagrut" className="mt-4 space-y-3">
            {intel?.bagrutAccess?.status === 'verified' ? (
              <div>
                <Row label={t('intel.row.math', 'Mathematics units')}>{intel.bagrutAccess.value.mathUnits}</Row>
                <Row label={t('intel.row.english', 'English units')}>{intel.bagrutAccess.value.englishUnits}</Row>
                <Row label={t('intel.row.further', 'Further subject units')}>{intel.bagrutAccess.value.furtherUnits}</Row>
              </div>
            ) : (
              <Empty />
            )}
            <div className="rounded-md border border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                {t('intel.card.gradeTable', 'Bagrut average → German grade')}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {GRADE_SCALE.map((score) => (
                  <div key={score} className="rounded-md bg-muted/40 px-2 py-1.5 text-center">
                    <p className="text-sm font-semibold">{score}</p>
                    <p className="text-xs text-muted-foreground">{bagrutToGermanGrade(score).german.toFixed(2)}</p>
                  </div>
                ))}
              </div>
              {intel?.gradeConversion?.status === 'verified' && intel.gradeConversion.value && (
                <div className="mt-3 rounded-md border border-border/70 bg-background/70 p-2.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('intel.card.conversionFormula', 'Official conversion procedure')}
                  </p>
                  <p className="mt-1 overflow-x-auto text-xs font-mono">
                    {isAr ? intel.gradeConversion.noteAR ?? intel.gradeConversion.value : intel.gradeConversion.value}
                  </p>
                </div>
              )}
              <p className="mt-2 text-xs text-sky-700 dark:text-sky-400">
                {t('intel.calculatedOnly', 'Calculated — not an admission decision')}
              </p>
            </div>
            {programs.map((program) => {
              const grade = program.gradeRequirement;
              if (grade.status !== 'verified' || !grade.value?.maximumGermanGrade) return null;
              return (
                <div key={program.id} className="rounded-md border border-border p-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {isAr ? program.universityNameAR : program.universityName}
                  </p>
                  <Row label={t('intel.card.publishedThreshold', 'Published grade threshold')}>
                    ≤ {grade.value.maximumGermanGrade.toFixed(1)}
                  </Row>
                  {grade.value.compensation && (
                    <Row label={t('intel.card.compensation', 'Alternative route')}>
                      {isAr ? grade.value.compensationAR ?? grade.value.compensation : grade.value.compensation}
                    </Row>
                  )}
                </div>
              );
            })}
          </TabsContent>

          {/* Our schools & cities ------------------------------------------ */}
          <TabsContent value="schools" className="mt-4 space-y-3">
            {schools.length === 0 ? (
              <Empty />
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {cities.map((city) => (
                    <Badge key={city} variant="outline" className="gap-1">
                      <MapPin className="h-3 w-3" aria-hidden />
                      {city}
                    </Badge>
                  ))}
                </div>
                <div>
                  {schools.map((school) => (
                    <Row key={school.id} label={isAr ? school.name_ar : school.name_en}>
                      <span className="text-muted-foreground">{school.city ?? '—'}</span>
                      {school.website && (
                        <a
                          href={school.website}
                          target="_blank"
                          rel="noreferrer"
                          className="ms-2 inline-flex items-center gap-1 text-primary underline underline-offset-2"
                        >
                          <Globe className="h-3.5 w-3.5" aria-hidden />
                          {t('intel.card.website', 'Website')}
                        </a>
                      )}
                    </Row>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* Deadlines ----------------------------------------------------- */}
          <TabsContent value="deadlines" className="mt-4 space-y-3">
            {programs.length === 0 ? (
              <Empty />
            ) : (
              <div>
                {programs.map((program) => {
                  const value = program.deadline.status === 'verified' ? program.deadline.value : null;
                  const mode = program.admissionMode.status === 'verified' ? program.admissionMode.value : null;
                  const channel = program.applicationChannel.status === 'verified' ? program.applicationChannel.value : null;
                  const entrance = program.entranceRequirement.status === 'verified' ? program.entranceRequirement.value : null;
                  return (
                    <div key={program.id} className="rounded-md border border-border p-3">
                      <Row label={isAr ? program.universityNameAR : program.universityName}>
                        <span className="font-medium">{isAr ? program.programNameAR : program.programName}</span>
                      </Row>
                      <Row label={t('intel.card.admissionMode', 'Admission mode')}>
                        {mode ? t('intel.admission.' + mode, mode) : <span className="text-muted-foreground">{t('intel.none', 'none published')}</span>}
                      </Row>
                      <Row label={t('intel.card.applicationChannel', 'Application channel')}>
                        {channel ? t('intel.channel.' + channel, channel) : <span className="text-muted-foreground">{t('intel.none', 'none published')}</span>}
                      </Row>
                      <Row label={t('intel.row.deadline', 'Application deadline')}>
                        {value ? (isAr ? value.semesterAR : value.semester) + ' — ' + value.deadline : <span className="text-muted-foreground">{t('intel.none', 'none published')}</span>}
                      </Row>
                      {entrance && (
                        <Row label={t('intel.card.entranceProcedure', 'Entrance procedure')}>
                          {isAr
                            ? program.entranceRequirement.noteAR ?? entrance
                            : program.entranceRequirement.note ?? entrance}
                        </Row>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              {t(
                'intel.card.startTiming',
                'German-route planning only: begin the language course about 12 months before the application deadline — roughly 10 months of study plus the language exam and result.',
              )}
            </p>
          </TabsContent>

          {/* Universities --------------------------------------------------- */}
          <TabsContent value="universities" className="mt-4 space-y-2">
            {programs.length === 0 ? (
              <Empty />
            ) : (
              programs.slice(0, 4).map((program) => (
                <a
                  key={program.id}
                  href={program.programUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start justify-between gap-3 rounded-md border border-border p-3 text-sm hover:bg-accent"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{isAr ? program.universityNameAR : program.universityName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {isAr ? program.programNameAR : program.programName} · {isAr ? program.cityAR : program.city}
                    </span>
                  </span>
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                </a>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
