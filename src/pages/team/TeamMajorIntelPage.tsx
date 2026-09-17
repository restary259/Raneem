import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpenCheck,
  Check,
  ClipboardList,
  ExternalLink,
  FileCheck2,
  GraduationCap,
  Languages,
  Loader2,
  Route,
  Save,
  Search,
  ShieldCheck,
  University,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { getMajorIntel, searchMajors } from '@/data/intel/majorIntel';
import { CS_GUIDANCE } from '@/data/intel/computerScience';
import type { MajorIntel, ProgramIntel } from '@/data/intel/types';
import {
  EMPTY_INTAKE,
  calculateGermanGrade,
  evaluateProgram,
  missingIntakeFields,
  type StudentIntake,
} from '@/lib/eligibility/engine';
import { MajorIntelligenceService, type IntelCaseContext } from '@/services/MajorIntelligenceService';
import IntakeForm from '@/components/team/intel/IntakeForm';
import ProgramCard from '@/components/team/intel/ProgramCard';
import { CheckBadge, VerificationBadge } from '@/components/team/intel/FactBadge';

const JOURNEY = [
  { id: 'major', icon: GraduationCap, label: 'Major', labelAR: 'التخصص' },
  { id: 'bagrut', icon: BookOpenCheck, label: 'Bagrut', labelAR: 'البجروت' },
  { id: 'german', icon: Languages, label: 'German', labelAR: 'الألمانية' },
  { id: 'universities', icon: University, label: 'Universities', labelAR: 'الجامعات' },
  { id: 'application', icon: Route, label: 'Application', labelAR: 'التقديم' },
  { id: 'documents', icon: FileCheck2, label: 'Documents', labelAR: 'الوثائق' },
  { id: 'deadlines', icon: ClipboardList, label: 'Deadlines', labelAR: 'المواعيد' },
  { id: 'after', icon: Check, label: 'After admission', labelAR: 'بعد القبول' },
] as const;

const serialized = (value: StudentIntake) => JSON.stringify(value);

function Pane({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn('min-h-0 overflow-hidden border-border bg-card', className)}>{children}</section>;
}

export default function TeamMajorIntelPage() {
  const { t, i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [major, setMajor] = useState<MajorIntel | null>(null);
  const [intake, setIntake] = useState<StudentIntake>(EMPTY_INTAKE);
  const [savedIntake, setSavedIntake] = useState<StudentIntake>(EMPTY_INTAKE);
  const [caseContext, setCaseContext] = useState<IntelCaseContext | null>(null);
  const [loadingCase, setLoadingCase] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeProgramId, setActiveProgramId] = useState<string>('');
  const [mobilePane, setMobilePane] = useState('major');
  const [journey, setJourney] = useState<(typeof JOURNEY)[number]['id']>('major');
  const caseId = searchParams.get('case');
  const linkedMajorId = searchParams.get('major');

  useEffect(() => {
    if (!linkedMajorId) return;
    const linked = getMajorIntel(linkedMajorId);
    if (linked) setMajor(linked);
  }, [linkedMajorId]);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    setLoadingCase(true);
    MajorIntelligenceService.loadCase(caseId)
      .then((context) => {
        if (cancelled) return;
        setCaseContext(context);
        setIntake(context.intake);
        setSavedIntake(context.intake);
      })
      .catch(() => toast.error(t('intel.caseLoadError', 'Student data could not be loaded.')))
      .finally(() => { if (!cancelled) setLoadingCase(false); });
    return () => { cancelled = true; };
  }, [caseId, t]);

  useEffect(() => {
    if (major?.programs[0]) setActiveProgramId(major.programs[0].id);
  }, [major]);

  const dirty = serialized(intake) !== serialized(savedIntake);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const results = useMemo(() => searchMajors(query, 8), [query]);
  const missing = missingIntakeFields(intake);
  const calc = calculateGermanGrade(intake);
  const activeProgram: ProgramIntel | undefined = major?.programs.find((p) => p.id === activeProgramId) ?? major?.programs[0];
  const completion = Math.round(((11 - missing.length) / 11) * 100);

  async function save() {
    if (!caseId) return;
    setSaving(true);
    try {
      const updatedAt = await MajorIntelligenceService.saveCaseIntake(caseId, intake);
      setSavedIntake(intake);
      setCaseContext((current) => current ? { ...current, intake, updatedAt } : current);
      toast.success(t('intel.saved', 'Student data saved.'));
    } catch {
      toast.error(t('intel.saveError', 'Student data could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  const left = (
    <Pane className="border-e">
      <div className="border-b border-border p-3">
        <label htmlFor="major-search" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
          {t('intel.search', 'Search a major')}
        </label>
        <div className="relative">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="major-search" value={query} onChange={(event) => setQuery(event.target.value)} className="ps-9" placeholder={t('intel.searchShort', 'Arabic, Hebrew, English, German')} />
        </div>
      </div>
      <ScrollArea className="h-[calc(100%-81px)]">
        <div className="space-y-4 p-3">
          <div className="space-y-1">
            {results.map((item) => (
              <Button key={item.id} type="button" variant="ghost" onClick={() => { setMajor(item); setMobilePane('student'); }} className={cn('h-auto w-full justify-start rounded-md px-2 py-2 text-start', major?.id === item.id && 'bg-primary/10 text-primary hover:bg-primary/10')}>
                <span className="min-w-0 flex-1 truncate">{isAr ? item.canonicalAR : item.canonicalEN}</span>
                {item.status === 'verified' && <ShieldCheck className="text-emerald-600" aria-hidden />}
              </Button>
            ))}
            {results.length === 0 && <p className="p-2 text-xs text-muted-foreground">{t('intel.noMatch', 'No major matches this search.')}</p>}
          </div>

          {major && (
            <div className="border-t border-border pt-3">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{isAr ? major.canonicalAR : major.canonicalEN}</p>
                  <p className="text-xs text-muted-foreground">{major.nameDE}</p>
                </div>
                <VerificationBadge status={major.status === 'verified' ? 'verified' : 'unverified'} checkedAt={major.lastVerified} className="shrink-0" />
              </div>
              <nav className="space-y-1" aria-label={t('intel.journey', 'Application journey')}>
                {JOURNEY.map((item) => (
                  <Button key={item.id} type="button" variant="ghost" onClick={() => { setJourney(item.id); if (['universities', 'application', 'documents', 'deadlines'].includes(item.id)) setMobilePane('programs'); }} className={cn('h-9 w-full justify-start rounded-md px-2 text-xs', journey === item.id && 'bg-accent text-accent-foreground')}>
                    <item.icon className="h-4 w-4" aria-hidden />
                    {isAr ? item.labelAR : item.label}
                  </Button>
                ))}
              </nav>
            </div>
          )}

          {major?.status === 'verified' && (
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">{t('intel.sources', 'Verified sources')}</p>
              <p className="text-2xl font-semibold">{major.sources.length}</p>
              <p className="text-xs text-muted-foreground">{t('intel.lastChecked', 'Last checked')} · {major.lastVerified}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </Pane>
  );

  const student = (
    <Pane className="border-e">
      <div className="flex min-h-[80px] items-start justify-between gap-2 border-b border-border p-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">{t('intel.intake', 'Student intake')}</p>
          <p className="truncate font-semibold">{loadingCase ? t('common.loading', 'Loading…') : caseContext?.fullName ?? t('intel.manualAssessment', 'Manual assessment')}</p>
          {caseContext && <p className="truncate text-xs text-muted-foreground">{caseContext.caseReference ?? '—'} · {caseContext.degreeInterest ?? '—'}</p>}
        </div>
        <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{completion}%</span>
      </div>
      <ScrollArea className="h-[calc(100%-145px)]">
        <div className="space-y-4 p-3">
          {!caseId && <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">{t('intel.manualHint', 'Temporary assessment. Open from a case to save student data.')}</p>}
          <IntakeForm intake={intake} onChange={setIntake} compact />
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
            <p className="font-semibold">{t('intel.calculatedGrade', 'Calculated German grade')}</p>
            <p className="mt-1 text-lg font-semibold">{calc ? calc.german.toFixed(2) : '—'}</p>
            <p className="text-sky-700 dark:text-sky-400">{t('intel.calculatedOnly', 'Calculated — not an admission decision')}</p>
          </div>
        </div>
      </ScrollArea>
      <div className="flex h-[65px] items-center justify-between gap-2 border-t border-border px-3">
        <div className="text-xs text-muted-foreground">
          {dirty ? t('intel.unsaved', 'Unsaved changes') : caseContext?.updatedAt ? `${t('intel.savedAt', 'Saved')} · ${new Date(caseContext.updatedAt).toLocaleString('en-US')}` : t('intel.unchanged', 'No saved assessment')}
        </div>
        <Button type="button" size="sm" disabled={!caseId || !dirty || saving} onClick={save} className="rounded-md">
          {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          {t('common.save', 'Save')}
        </Button>
      </div>
    </Pane>
  );

  const programmes = (
    <Pane>
      {!major ? (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">{t('intel.pickBody', 'Select a major to begin.')}</div>
      ) : major.status !== 'verified' ? (
        <div className="p-5 text-sm text-amber-700 dark:text-amber-400">{t('intel.notVerifiedBody', 'This major has not been verified against official sources yet.')}</div>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-border p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">{t('intel.programmes', 'University programmes')}</p>
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
              {major.programs.map((program) => {
                const assessment = evaluateProgram(major, program, intake);
                return (
                  <Button key={program.id} type="button" variant="outline" onClick={() => setActiveProgramId(program.id)} className={cn('h-auto min-w-0 items-start justify-start rounded-md px-2 py-2 text-start', activeProgram?.id === program.id && 'border-primary bg-primary/5 ring-1 ring-primary')}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{isAr ? program.universityNameAR : program.universityName.replace(' University', '')}</span>
                      <span className="mt-1 block text-[10px] text-muted-foreground">{assessment.toVerify.length} {t('intel.toVerify', 'to verify')}</span>
                    </span>
                    <CheckBadge status={assessment.overall} />
                  </Button>
                );
              })}
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4">{activeProgram && <ProgramCard major={major} program={activeProgram} intake={intake} sources={major.sources} />}</div>
            {journey === 'after' && (
              <div className="mx-4 mb-4 rounded-md border border-border bg-muted/30 p-3 text-sm">
                {CS_GUIDANCE.map((item, index) => <p key={index} className="mb-2 last:mb-0">{isAr ? item.noteAR : item.value}</p>)}
              </div>
            )}
            {journey === 'major' && major.sources.slice(0, 2).map((source) => (
              <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="mx-4 mb-2 flex items-center gap-2 text-xs text-primary underline underline-offset-2">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />{isAr ? (source.titleAR ?? source.title) : source.title}
              </a>
            ))}
          </ScrollArea>
        </div>
      )}
    </Pane>
  );

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden bg-background p-3 md:p-4">
      <header className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('intel.title', 'Major Intelligence')}</h1>
          <p className="text-xs text-muted-foreground">{t('intel.subtitleShort', 'Evidence-first eligibility desk')}</p>
        </div>
        {caseContext && <div className="rounded-md border border-border bg-card px-3 py-2 text-xs"><span className="font-semibold">{caseContext.fullName}</span><span className="ms-2 text-muted-foreground">{caseContext.caseReference}</span></div>}
      </header>

      <Tabs value={mobilePane} onValueChange={setMobilePane} className="flex min-h-0 flex-1 flex-col lg:hidden">
        <TabsList className="mb-2 grid h-10 w-full grid-cols-3">
          <TabsTrigger value="major">{t('intel.mobile.major', 'Major')}</TabsTrigger>
          <TabsTrigger value="student">{t('intel.mobile.student', 'Student')}</TabsTrigger>
          <TabsTrigger value="programs">{t('intel.mobile.programs', 'Programmes')}</TabsTrigger>
        </TabsList>
        <TabsContent value="major" className="mt-0 min-h-0 flex-1 overflow-hidden rounded-md border border-border">{left}</TabsContent>
        <TabsContent value="student" className="mt-0 min-h-0 flex-1 overflow-hidden rounded-md border border-border">{student}</TabsContent>
        <TabsContent value="programs" className="mt-0 min-h-0 flex-1 overflow-hidden rounded-md border border-border">{programmes}</TabsContent>
      </Tabs>

      <div className="hidden min-h-0 flex-1 grid-cols-[220px_320px_minmax(0,1fr)] overflow-hidden rounded-md border border-border bg-card shadow-sm lg:grid">
        {left}{student}{programmes}
      </div>
    </div>
  );
}