import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpenCheck,
  Check,
  ClipboardList,
  ExternalLink,
  FileCheck2,
  GraduationCap,
  History,
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
import { ALL_MAJOR_INTEL, VERIFIED_MAJORS, getMajorIntel, searchMajors } from '@/data/intel/majorIntel';
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
import { pushRecentMajor, readRecentMajors } from '@/lib/intel/recentMajors';
import { journeyAvailability, type JourneyId } from '@/lib/intel/journey';
import { INTAKE_FIELD_FALLBACK, focusIntakeField } from '@/lib/intel/intakeFields';
import { useIntakeAutosave } from '@/hooks/useIntakeAutosave';
import IntakeForm from '@/components/team/intel/IntakeForm';
import ProgramCard from '@/components/team/intel/ProgramCard';
import { CheckBadge, VerificationBadge } from '@/components/team/intel/FactBadge';

const JOURNEY: { id: JourneyId; icon: typeof GraduationCap; label: string; labelAR: string }[] = [
  { id: 'major', icon: GraduationCap, label: 'Major', labelAR: 'التخصص' },
  { id: 'bagrut', icon: BookOpenCheck, label: 'Bagrut', labelAR: 'البجروت' },
  { id: 'german', icon: Languages, label: 'German', labelAR: 'الألمانية' },
  { id: 'universities', icon: University, label: 'Universities', labelAR: 'الجامعات' },
  { id: 'application', icon: Route, label: 'Application', labelAR: 'التقديم' },
  { id: 'documents', icon: FileCheck2, label: 'Documents', labelAR: 'الوثائق' },
  { id: 'deadlines', icon: ClipboardList, label: 'Deadlines', labelAR: 'المواعيد' },
  { id: 'after', icon: Check, label: 'After admission', labelAR: 'بعد القبول' },
];

const TOTAL_FIELDS = 11;
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
  const [manualSaving, setManualSaving] = useState(false);
  const [activeProgramId, setActiveProgramId] = useState<string>('');
  const [mobilePane, setMobilePane] = useState('major');
  const [journey, setJourney] = useState<JourneyId>('major');
  const [journeyFocus, setJourneyFocus] = useState<JourneyId | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>(() => readRecentMajors());
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState<string[]>([]);
  const caseId = searchParams.get('case');
  const linkedMajorId = searchParams.get('major');

  const selectMajor = useCallback((item: MajorIntel) => {
    setMajor(item);
    setRecentIds(pushRecentMajor(item.id));
  }, []);

  useEffect(() => {
    if (!linkedMajorId) return;
    const linked = getMajorIntel(linkedMajorId);
    if (linked) selectMajor(linked);
  }, [linkedMajorId, selectMajor]);

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

  const results = useMemo(() => (query.trim() ? searchMajors(query, 8) : []), [query]);
  const recentMajors = useMemo(
    () => recentIds.map((id) => ALL_MAJOR_INTEL.find((m) => m.id === id)).filter((m): m is MajorIntel => Boolean(m)),
    [recentIds],
  );
  const missing = missingIntakeFields(intake);
  const calc = calculateGermanGrade(intake);
  const activeProgram: ProgramIntel | undefined = major?.programs.find((p) => p.id === activeProgramId) ?? major?.programs[0];
  const completion = Math.round(((TOTAL_FIELDS - missing.length) / TOTAL_FIELDS) * 100);
  const hasGuidance = major?.id === 'computer-science' && CS_GUIDANCE.length > 0;
  const available = useMemo(
    () => journeyAvailability(major, activeProgram, hasGuidance),
    [major, activeProgram, hasGuidance],
  );

  const intakeRef = useRef(intake);
  intakeRef.current = intake;

  const persist = useCallback(async () => {
    if (!caseId) return;
    const snapshot = intakeRef.current;
    const updatedAt = await MajorIntelligenceService.saveCaseIntake(caseId, snapshot);
    setSavedIntake(snapshot);
    setCaseContext((current) => (current ? { ...current, intake: snapshot, updatedAt } : current));
  }, [caseId]);

  const autosave = useIntakeAutosave({
    enabled: Boolean(caseId) && !loadingCase,
    dirty,
    signature: serialized(intake),
    save: persist,
  });

  async function saveNow() {
    if (!caseId) return;
    setManualSaving(true);
    try {
      await persist();
      toast.success(t('intel.saved', 'Student data saved.'));
    } catch {
      toast.error(t('intel.saveError', 'Student data could not be saved.'));
    } finally {
      setManualSaving(false);
    }
  }

  async function requestVerification() {
    if (!major) return;
    setRequesting(true);
    try {
      await MajorIntelligenceService.requestVerification(major.id, isAr ? major.canonicalAR : major.canonicalEN);
      setRequested((current) => [...current, major.id]);
      toast.success(t('intel.requestSent', 'Verification request sent.'));
    } catch {
      toast.error(t('intel.requestError', 'The request could not be sent.'));
    } finally {
      setRequesting(false);
    }
  }

  function openJourney(id: JourneyId) {
    if (!available[id]) return;
    setJourney(id);
    setJourneyFocus(null);
    window.setTimeout(() => setJourneyFocus(id), 0);
    setMobilePane('assessment');
  }

  const saveLine = (() => {
    if (autosave.status === 'saving') return t('intel.saving', 'Saving…');
    if (autosave.status === 'error') return t('intel.saveError', 'Student data could not be saved.');
    if (dirty) return t('intel.unsaved', 'Unsaved changes');
    if (caseContext?.updatedAt) return `${t('intel.savedAt', 'Saved')} · ${new Date(caseContext.updatedAt).toLocaleString('en-US')}`;
    return t('intel.unchanged', 'No saved assessment');
  })();

  const majorList = (items: MajorIntel[], title: string, Icon: typeof ShieldCheck) => (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 px-2 text-xs font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />{title}
      </p>
      {items.map((item) => (
        <Button key={item.id} type="button" variant="ghost" onClick={() => { selectMajor(item); setMobilePane('assessment'); }} className={cn('h-auto w-full justify-start rounded-md px-2 py-2 text-start', major?.id === item.id && 'bg-primary/10 text-primary hover:bg-primary/10')}>
          <span className="min-w-0 flex-1 truncate">{isAr ? item.canonicalAR : item.canonicalEN}</span>
          {item.status === 'verified' && <ShieldCheck className="text-emerald-600" aria-hidden />}
        </Button>
      ))}
    </div>
  );

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
          {query.trim() ? (
            <div className="space-y-1">
              {results.map((item) => (
                <Button key={item.id} type="button" variant="ghost" onClick={() => { selectMajor(item); setMobilePane('assessment'); }} className={cn('h-auto w-full justify-start rounded-md px-2 py-2 text-start', major?.id === item.id && 'bg-primary/10 text-primary hover:bg-primary/10')}>
                  <span className="min-w-0 flex-1 truncate">{isAr ? item.canonicalAR : item.canonicalEN}</span>
                  {item.status === 'verified' && <ShieldCheck className="text-emerald-600" aria-hidden />}
                </Button>
              ))}
              {results.length === 0 && <p className="p-2 text-xs text-muted-foreground">{t('intel.noMatch', 'No major matches this search.')}</p>}
            </div>
          ) : (
            <>
              {majorList(VERIFIED_MAJORS, t('intel.readyToUse', 'Ready to use'), ShieldCheck)}
              {recentMajors.length > 0 && majorList(recentMajors, t('intel.recent', 'Recently opened'), History)}
            </>
          )}

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
                  <Button
                    key={item.id}
                    type="button"
                    variant="ghost"
                    disabled={!available[item.id]}
                    onClick={() => openJourney(item.id)}
                    className={cn('h-9 w-full justify-start rounded-md px-2 text-xs', journey === item.id && available[item.id] && 'bg-accent text-accent-foreground')}
                  >
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

  const studentBody = (
    <div className="space-y-4 p-3">
      {!caseId && <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">{t('intel.manualHint', 'Temporary assessment. Open from a case to save student data.')}</p>}
      {missing.length > 0 && (
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            {t('intel.stillMissing', 'Still missing')} · {missing.length}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((field) => (
              <Button key={field} type="button" size="sm" variant="outline" className="h-7 rounded-full px-2 text-[11px]" onClick={() => focusIntakeField(field)}>
                {t(`intel.field.${field}`, INTAKE_FIELD_FALLBACK[field] ?? field)}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
            {t('intel.provisionalHint', 'Any verdict below is provisional until these are answered.')}
          </p>
        </div>
      )}
      <IntakeForm intake={intake} onChange={setIntake} compact />
      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
        <p className="font-semibold">{t('intel.calculatedGrade', 'Calculated German grade')}</p>
        <p className="mt-1 text-lg font-semibold">{calc ? calc.german.toFixed(2) : '—'}</p>
        <p className="text-sky-700 dark:text-sky-400">{t('intel.calculatedOnly', 'Calculated — not an admission decision')}</p>
      </div>
    </div>
  );

  const saveBar = (
    <div className="flex h-[65px] items-center justify-between gap-2 border-t border-border px-3">
      <div className={cn('text-xs', autosave.status === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
        {saveLine}
      </div>
      <div className="flex items-center gap-2">
        {autosave.status === 'error' && (
          <Button type="button" size="sm" variant="outline" className="rounded-md" onClick={() => void autosave.retry()}>
            {t('intel.retry', 'Retry')}
          </Button>
        )}
        <Button type="button" size="sm" disabled={!caseId || !dirty || manualSaving || autosave.saving} onClick={saveNow} className="rounded-md">
          {manualSaving || autosave.saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          {t('common.save', 'Save')}
        </Button>
      </div>
    </div>
  );

  const studentHeader = (
    <div className="flex min-h-[80px] items-start justify-between gap-2 border-b border-border p-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{t('intel.intake', 'Student intake')}</p>
        <p className="truncate font-semibold">{loadingCase ? t('common.loading', 'Loading…') : caseContext?.fullName ?? t('intel.manualAssessment', 'Manual assessment')}</p>
        {caseContext && <p className="truncate text-xs text-muted-foreground">{caseContext.caseReference ?? '—'} · {caseContext.degreeInterest ?? '—'}</p>}
      </div>
      <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{completion}%</span>
    </div>
  );

  const student = (
    <Pane className="border-e">
      {studentHeader}
      <ScrollArea className="h-[calc(100%-145px)]">{studentBody}</ScrollArea>
      {saveBar}
    </Pane>
  );

  const guidanceBlock = hasGuidance ? (
    <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
      {CS_GUIDANCE.map((item, index) => <p key={index} className="mb-2 last:mb-0">{isAr ? item.noteAR : item.value}</p>)}
    </div>
  ) : undefined;

  const programmeSwitcher = major?.status === 'verified' ? (
    <div className="border-b border-border p-3">
      <p className="mb-2 text-xs font-semibold text-muted-foreground">{t('intel.programmes', 'University programmes')}</p>
      <div className="flex gap-2 overflow-x-auto pb-1 xl:grid xl:grid-cols-4 xl:overflow-visible xl:pb-0">
        {major.programs.map((program) => {
          const assessment = evaluateProgram(major, program, intake);
          return (
            <Button key={program.id} type="button" variant="outline" onClick={() => setActiveProgramId(program.id)} className={cn('h-auto shrink-0 items-start justify-start rounded-md px-2 py-2 text-start xl:min-w-0 xl:shrink', activeProgram?.id === program.id && 'border-primary bg-primary/5 ring-1 ring-primary')}>
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
  ) : null;

  const programmeDetail = (
    <>
      <div className="p-4">
        {activeProgram && (
          <ProgramCard
            major={major!}
            program={activeProgram}
            intake={intake}
            sources={major!.sources}
            focus={journeyFocus}
            guidance={guidanceBlock}
          />
        )}
      </div>
      {major?.sources.slice(0, 2).map((source) => (
        <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="mx-4 mb-2 flex items-center gap-2 text-xs text-primary underline underline-offset-2">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />{isAr ? (source.titleAR ?? source.title) : source.title}
        </a>
      ))}
    </>
  );

  const programmeBody = (scroll: boolean) => !major ? (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">{t('intel.pickBody', 'Select a major to begin.')}</div>
  ) : major.status !== 'verified' ? (
    <div className="space-y-3 p-5">
      <div>
        <p className="font-semibold">{isAr ? major.canonicalAR : major.canonicalEN}</p>
        {major.nameDE && <p className="text-xs text-muted-foreground">{major.nameDE}</p>}
      </div>
      <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
        {t('intel.notVerifiedBody', 'This major has not been verified against official sources yet.')}
      </p>
      <p className="text-xs text-muted-foreground">{t('intel.notVerifiedHint', 'Nothing here is confirmed, so do not advise a student on it yet.')}</p>
      <Button type="button" size="sm" className="rounded-md" disabled={requesting || requested.includes(major.id)} onClick={requestVerification}>
        {requesting && <Loader2 className="animate-spin" aria-hidden />}
        {requested.includes(major.id) ? t('intel.requestSent', 'Verification request sent.') : t('intel.requestVerification', 'Request verification')}
      </Button>
    </div>
  ) : (
    <div className={cn('flex min-h-0 flex-col', scroll && 'h-full')}>
      {programmeSwitcher}
      {scroll ? <ScrollArea className="min-h-0 flex-1">{programmeDetail}</ScrollArea> : programmeDetail}
    </div>
  );

  const programmes = <Pane>{programmeBody(true)}</Pane>;

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
        <TabsList className="mb-2 grid h-10 w-full grid-cols-2">
          <TabsTrigger value="major">{t('intel.mobile.major', 'Major')}</TabsTrigger>
          <TabsTrigger value="assessment">{t('intel.mobile.assessment', 'Assessment')}</TabsTrigger>
        </TabsList>
        <TabsContent value="major" className="mt-0 min-h-0 flex-1 overflow-hidden rounded-md border border-border">{left}</TabsContent>
        <TabsContent value="assessment" className="mt-0 min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-card">
          <div className="flex h-full min-h-0 flex-col">
            {studentHeader}
            <ScrollArea className="min-h-0 flex-1">
              {studentBody}
              <div className="border-t border-border">{programmeBody(false)}</div>
            </ScrollArea>
            {saveBar}
          </div>
        </TabsContent>
      </Tabs>

      <div className="hidden min-h-0 flex-1 grid-cols-[220px_320px_minmax(0,1fr)] overflow-hidden rounded-md border border-border bg-card shadow-sm lg:grid">
        {left}{student}{programmes}
      </div>
    </div>
  );
}
