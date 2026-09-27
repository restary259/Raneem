
import React, { useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Dialog, DialogPortal, DialogOverlay, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Clock, BookOpen, Users, FileText, Globe, Briefcase, AlertCircle, Scale, Building2, Lightbulb, Link2, Calculator, Send, GraduationCap, ClipboardCheck, Languages, X } from 'lucide-react';
import { SubMajor } from '@/data/majorsData';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';
import { getLocalizedMajor, getLocalizedTiers, getLocalizedSources, getLocalizedGlance, getLocalizedLanguageProfile } from '@/utils/majorLocale';
import { isArabicUi } from '@/lib/localeData';
import { bagrutToGermanGrade, BAGRUT_PASS_MARK } from '@/utils/gradeConverter';

interface MajorModalProps {
  isOpen: boolean;
  onClose: () => void;
  major: SubMajor | null;
}

/**
 * Section ids in document order. The same ids are used as anchor targets on the
 * section wrappers below and as the entries of the sticky in-card navigation, so
 * a new section only has to be added once here AND be given the matching id.
 */
type SectionId =
  | 'canIGetIn'
  | 'language'
  | 'howToApply'
  | 'about'
  | 'careers'
  | 'requirements'
  | 'arab48'
  | 'sources';

const SECTION_ORDER: SectionId[] = [
  'canIGetIn',
  'language',
  'howToApply',
  'about',
  'careers',
  'requirements',
  'arab48',
  'sources',
];

/** Sample Bagrut averages shown in the conversion table (Western digits, en-US). */
const BAGRUT_SAMPLES = [80, 85, 90, 93, 95, 100];
const fmt = (n: number, digits = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const formatMonth = (yyyyMm: string, lang: string) => {
  const [y, m] = yyyyMm.split('-').map(Number);
  if (!y || !m) return yyyyMm;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(lang === 'ar' ? 'ar' : 'en-US', {
    month: 'long',
    year: 'numeric',
    numberingSystem: 'latn',
  });
};

const SectionTitle = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex items-center gap-2">
    {icon}
    <h3 className="text-xl font-semibold text-foreground">{children}</h3>
  </div>
);

const TierList = ({ icon, title, items, tone }: { icon: React.ReactNode; title: string; items: string[]; tone: string }) => {
  if (!items.length) return null;
  return (
    <div className={`rounded-2xl p-4 ${tone}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h4 className="font-semibold text-foreground">{title}</h4>
      </div>
      <ul className="list-disc ps-5 space-y-1 text-sm text-muted-foreground leading-relaxed">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
};

const FactRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[minmax(7rem,30%)_1fr] gap-3 py-2 border-b border-border last:border-0 text-sm">
    <dt className="font-medium text-muted-foreground">{label}</dt>
    <dd className="text-foreground leading-relaxed">{children}</dd>
  </div>
);

const GlanceChip = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-xl border border-border bg-card p-3 min-w-0">
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">{icon}<span>{label}</span></div>
    <div className="text-sm font-semibold text-foreground leading-snug break-words">{value}</div>
  </div>
);

const MajorModal = ({ isOpen, onClose, major }: MajorModalProps) => {
  const { t, i18n } = useTranslation('common');
  const { dir } = useDirection();
  // The dialog content lives in a portal that Radix mounts in a LATER commit than
  // the component that declares this effect, so a plain ref object is still null
  // when the effect first runs (and the effect would never re-run). Holding the
  // node in state via a callback ref makes the setup run when it actually attaches.
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({});
  const [active, setActive] = useState<SectionId | null>(null);

  // Track which section is currently in view, so the rail highlights the right
  // entry as the user scrolls. rAF-throttled; the scroll container is the dialog
  // body itself, not the document.
  useEffect(() => {
    if (!isOpen || !major || !scrollEl) return;
    const root = scrollEl;
    let frame = 0;
    const compute = () => {
      frame = 0;
      const available = SECTION_ORDER.filter((id) => sectionRefs.current[id]);
      if (!available.length) {
        setActive(null);
        return;
      }
      // Pin both ends: at the very top the first section is in view and at the
      // bottom the last one is. Without this, content shorter than the viewport
      // would read every section as already "passed".
      const atBottom = root.scrollTop + root.clientHeight >= root.scrollHeight - 2;
      if (root.scrollTop <= 0) {
        setActive(available[0]);
        return;
      }
      if (atBottom) {
        setActive(available[available.length - 1]);
        return;
      }
      const rootTop = root.getBoundingClientRect().top;
      let current: SectionId = available[0];
      for (const id of available) {
        const el = sectionRefs.current[id]!;
        // A section counts as "reached" once its top passes just below the
        // header; the last one that has done so is the active entry.
        if (el.getBoundingClientRect().top - rootTop <= 96) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(compute);
    };
    compute();
    root.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      root.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [isOpen, major, scrollEl]);

  if (!major) return null;

  const lang = i18n.language;
  const loc = getLocalizedMajor(major, lang);
  const tiers = getLocalizedTiers(major, lang);
  const sources = getLocalizedSources(major, lang);
  const glance = getLocalizedGlance(major, lang);
  const langProfile = getLocalizedLanguageProfile(major, lang);
  const verified = Boolean(major.lastVerified);
  // The dataset has no Hebrew copy, so Hebrew shows the English default.
  const duration = loc.localizedDuration || (isArabicUi(lang) ? '6 فصول دراسية' : '6 semesters');

  // Only the sections actually rendered for this major become nav entries, so
  // the rail can never point at (or jump to) a section that was suppressed.
  const sections: { id: SectionId; label: string }[] = [];
  const push = (id: SectionId, label: string) => sections.push({ id, label });
  if (verified || tiers) push('canIGetIn', t('educational.sectionCanIGetIn', 'Can I get in?'));
  if (langProfile || loc.localizedLanguageRequirements)
    push('language', langProfile ? t('educational.sectionLanguage', 'Language requirements') : t('educational.modalLanguageRequirements', 'Language Requirements'));
  if (glance && loc.localizedRequiredBackground) push('howToApply', t('educational.sectionHowToApply', 'How to apply'));
  push('about', glance ? t('educational.sectionAbout', 'What you study & who it suits') : t('educational.modalDescription', 'Description'));
  if (loc.localizedCareerOpportunities || loc.localizedCareerProspects) push('careers', t('educational.modalCareerOpportunities', 'Career Opportunities in Germany'));
  if (!tiers && loc.localizedRequirements) push('requirements', t('educational.modalStudyRequirements', 'Study Requirements'));
  if (loc.localizedArab48Notes) push('arab48', t('educational.modalArab48Notes', 'Notes for Arab 48 Students'));
  if (sources.length > 0) push('sources', t('educational.modalSources', 'Sources'));

  const goTo = (id: SectionId) => {
    const el = sectionRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(id);
  };

  const registerSection = (id: SectionId) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogPortal>
        <DialogOverlay className="bg-black/50 backdrop-blur-sm" />
        <DialogPrimitive.Content
          dir={dir}
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 top-auto z-50 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-card p-0 shadow-surface-lg outline-hidden duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85dvh] sm:max-w-[820px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=closed]:zoom-out-95 data-[state=open]:motion-reduce:animate-none data-[state=closed]:motion-reduce:animate-none"
        >
          <DialogTitle className="sr-only">{loc.name}</DialogTitle>
          <div className="shrink-0 border-b border-border bg-card/95 backdrop-blur-xs sm:rounded-t-3xl">
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold leading-tight text-primary">{loc.name}</h2>
                {major.nameDE && <p className="mt-1 text-base font-normal text-muted-foreground">{major.nameDE}</p>}
              </div>
              <DialogPrimitive.Close
                aria-label={t('common.close', 'Close')}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
            {sections.length > 1 && (
              <nav
                aria-label={t('educational.navSections', 'Jump to a section')}
                className="flex gap-1.5 overflow-x-auto px-6 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {sections.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    aria-current={active === id ? 'true' : undefined}
                    onClick={() => goTo(id)}
                    className={cn(
                      'shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                      active === id
                        ? 'border-brand bg-brand text-brand-foreground'
                        : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            )}
          </div>
          <div ref={setScrollEl} className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
          {/* 1. At a glance */}
          {glance ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <GlanceChip icon={<Clock className="h-3.5 w-3.5" />} label={t('educational.modalDuration', 'Duration')} value={duration} />
                <GlanceChip icon={<GraduationCap className="h-3.5 w-3.5" />} label={t('educational.glanceDegree')} value={glance.degree} />
                {langProfile && <GlanceChip icon={<Languages className="h-3.5 w-3.5" />} label={t('educational.glanceLanguage')} value={`${langProfile.teachingLanguage} · ${langProfile.requiredLevel}`} />}
                <GlanceChip icon={<ClipboardCheck className="h-3.5 w-3.5" />} label={t('educational.glanceAdmission')} value={glance.admissionMode} />
                <GlanceChip icon={<Send className="h-3.5 w-3.5" />} label={t('educational.glanceChannel')} value={glance.applicationChannel} />
              </div>
              {verified && <Badge variant="outline" className="text-xs">{t('educational.lastVerified', { date: formatMonth(major.lastVerified!, lang) })}</Badge>}
            </div>
          ) : (
            <Badge variant="secondary"><Clock className="h-4 w-4 ml-1" />{duration}</Badge>
          )}

          {/* 2. Can I get in? */}
          {(verified || tiers) && (
            <div id="canIGetIn" ref={registerSection('canIGetIn')} className="scroll-mt-24 space-y-3">
              <SectionTitle icon={<Scale className="h-5 w-5 text-emerald-600" />}>{t('educational.sectionCanIGetIn')}</SectionTitle>
              {verified && (
                <div className="bg-emerald-50 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 font-semibold text-foreground"><Calculator className="h-4 w-4 text-emerald-700" />{t('educational.bagrutTitle')}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t('educational.bagrutUnits')}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t('educational.bagrutFormula', { min: BAGRUT_PASS_MARK })}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" dir="ltr">
                      <thead>
                        <tr className="text-muted-foreground border-b border-emerald-200">
                          <th className="py-1 px-2 text-start font-medium">{t('educational.bagrutAvg')}</th>
                          <th className="py-1 px-2 text-start font-medium">{t('educational.germanGrade')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {BAGRUT_SAMPLES.map((b) => (
                          <tr key={b} className="border-b border-emerald-100 last:border-0">
                            <td className="py-1 px-2 tabular-nums">{fmt(b, 0)}</td>
                            <td className="py-1 px-2 tabular-nums">{fmt(bagrutToGermanGrade(b).german)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('educational.bagrutDisclaimer')}</p>
                </div>
              )}
              {tiers && (
                <>
                  <p className="text-sm text-muted-foreground">{t('educational.tiersHint')}</p>
                  <TierList icon={<Scale className="h-4 w-4 text-slate-700" />} title={t('educational.tierOfficial')} items={tiers.official} tone="bg-slate-50 border border-slate-200" />
                  <TierList icon={<Building2 className="h-4 w-4 text-sky-700" />} title={t('educational.tierUniversity')} items={tiers.universitySpecific} tone="bg-sky-50 border border-sky-200" />
                  <TierList icon={<Lightbulb className="h-4 w-4 text-amber-700" />} title={t('educational.tierDarb')} items={tiers.darbGuidance} tone="bg-amber-50 border border-amber-200" />
                </>
              )}
            </div>
          )}

          {/* 3. Language */}
          {langProfile ? (
            <div id="language" ref={registerSection('language')} className="scroll-mt-24 space-y-3">
              <SectionTitle icon={<Globe className="h-5 w-5 text-purple-500" />}>{t('educational.sectionLanguage')}</SectionTitle>
              <dl className="bg-purple-50 rounded-2xl px-4 py-1">
                <FactRow label={t('educational.langTeaching')}>{langProfile.teachingLanguage}</FactRow>
                <FactRow label={t('educational.langLevel')}><span className="font-semibold">{langProfile.requiredLevel}</span></FactRow>
                <FactRow label={t('educational.langCertificates')}>
                  <div className="flex flex-wrap gap-1.5">
                    {langProfile.acceptedCertificates.map((c) => <Badge key={c} variant="secondary" className="bg-card text-foreground font-normal">{c}</Badge>)}
                  </div>
                </FactRow>
                {langProfile.exceptions.length > 0 && (
                  <FactRow label={t('educational.langExceptions')}>
                    <ul className="list-disc ps-4 space-y-0.5">{langProfile.exceptions.map((e, i) => <li key={i}>{e}</li>)}</ul>
                  </FactRow>
                )}
                <FactRow label={t('educational.langEnglish')}>{langProfile.englishOption}</FactRow>
              </dl>
              <p className="text-xs text-muted-foreground">{t('educational.langSourceNote')}</p>
            </div>
          ) : loc.localizedLanguageRequirements && (
            <div id="language" ref={registerSection('language')} className="scroll-mt-24 space-y-3">
              <SectionTitle icon={<Globe className="h-5 w-5 text-purple-500" />}>{t('educational.modalLanguageRequirements')}</SectionTitle>
              <div className="bg-purple-50 rounded-2xl p-4"><p className="text-muted-foreground">{loc.localizedLanguageRequirements}</p></div>
            </div>
          )}

          {/* 4. How to apply */}
          {glance && loc.localizedRequiredBackground && (
            <div id="howToApply" ref={registerSection('howToApply')} className="scroll-mt-24 space-y-3">
              <SectionTitle icon={<Send className="h-5 w-5 text-blue-500" />}>{t('educational.sectionHowToApply')}</SectionTitle>
              <div className="bg-blue-50 rounded-2xl p-4 space-y-2 text-sm text-muted-foreground">
                <p><span className="font-semibold">{t('educational.glanceChannel')}:</span> {glance.applicationChannel}</p>
                <p><span className="font-semibold">{t('educational.glanceAdmission')}:</span> {glance.admissionMode}</p>
                <p className="leading-relaxed">{loc.localizedRequiredBackground}</p>
              </div>
            </div>
          )}
          {!glance && loc.localizedRequiredBackground && (
            <div className="space-y-3">
              <SectionTitle icon={<FileText className="h-5 w-5 text-blue-500" />}>{t('educational.modalRequiredBackground')}</SectionTitle>
              <div className="bg-blue-50 rounded-2xl p-4"><p className="text-muted-foreground">{loc.localizedRequiredBackground}</p></div>
            </div>
          )}

          {/* 5. About */}
          <div id="about" ref={registerSection('about')} className="scroll-mt-24 space-y-3">
            <SectionTitle icon={<BookOpen className="h-5 w-5 text-brand-strong" />}>{glance ? t('educational.sectionAbout') : t('educational.modalDescription')}</SectionTitle>
            <div className="space-y-3 rounded-2xl border-s-4 border-brand bg-muted/50 p-4">
              <p className="text-muted-foreground leading-relaxed">{loc.detailedDesc}</p>
              {loc.localizedSuitableFor && (
                <p className="text-muted-foreground leading-relaxed flex gap-2"><Users className="h-4 w-4 mt-1 shrink-0 text-green-600" /><span><span className="font-semibold">{t('educational.modalSuitableFor')}:</span> {loc.localizedSuitableFor}</span></p>
              )}
            </div>
          </div>

          {/* 6. Careers */}
          {(loc.localizedCareerOpportunities || loc.localizedCareerProspects) && (
            <div id="careers" ref={registerSection('careers')} className="scroll-mt-24 space-y-3">
              <SectionTitle icon={<Briefcase className="h-5 w-5 text-amber-500" />}>{t('educational.modalCareerOpportunities')}</SectionTitle>
              <div className="bg-amber-50 rounded-2xl p-4"><p className="text-muted-foreground">{loc.localizedCareerOpportunities || loc.localizedCareerProspects}</p></div>
            </div>
          )}
          {!tiers && loc.localizedRequirements && (
            <div id="requirements" ref={registerSection('requirements')} className="scroll-mt-24 space-y-3">
              <h3 className="text-xl font-semibold text-foreground">{t('educational.modalStudyRequirements')}</h3>
              <div className="bg-muted/50 rounded-2xl p-4"><p className="text-muted-foreground">{loc.localizedRequirements}</p></div>
            </div>
          )}

          {/* 7. Arab 48 notes */}
          {loc.localizedArab48Notes && (
            <div id="arab48" ref={registerSection('arab48')} className="scroll-mt-24 space-y-3">
              <SectionTitle icon={<AlertCircle className="h-5 w-5 text-red-500" />}>{t('educational.modalArab48Notes')}</SectionTitle>
              <div className="bg-red-50 rounded-2xl p-4 border-s-4 border-red-400"><p className="text-muted-foreground">{loc.localizedArab48Notes}</p></div>
            </div>
          )}

          {/* 8. Sources */}
          {sources.length > 0 && (
            <div id="sources" ref={registerSection('sources')} className="scroll-mt-24 space-y-3">
              <SectionTitle icon={<Link2 className="h-5 w-5 text-muted-foreground" />}>{t('educational.modalSources')}</SectionTitle>
              <ol className="space-y-2 list-decimal ps-5">
                {sources.map((s, i) => (
                  <li key={`${s.url}-${i}`} className="text-sm leading-relaxed">
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="break-words font-medium text-brand-strong underline underline-offset-2 hover:text-primary">{s.title}</a>
                    <div className="text-muted-foreground">
                      <span className="font-medium">{t('educational.sourceVerifies')}:</span> {s.verifies}
                      <span className="text-muted-foreground"> · {t('educational.sourceChecked', { date: s.checked })}</span>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground">{t('educational.sourcesDisclaimer')}</p>
            </div>
          )}
          </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
};

export default MajorModal;
