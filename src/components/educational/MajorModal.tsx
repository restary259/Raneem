
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Clock, BookOpen, Users, FileText, Globe, Briefcase, AlertCircle, Scale, Building2, Lightbulb, Link2, Calculator, Send, GraduationCap, ClipboardCheck, Languages } from 'lucide-react';
import { SubMajor } from '@/data/majorsData';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';
import { getLocalizedMajor, getLocalizedTiers, getLocalizedSources, getLocalizedGlance, getLocalizedLanguageProfile } from '@/utils/majorLocale';
import { bagrutToGermanGrade, BAGRUT_PASS_MARK } from '@/utils/gradeConverter';

interface MajorModalProps {
  isOpen: boolean;
  onClose: () => void;
  major: SubMajor | null;
}

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
    <h3 className="text-xl font-semibold text-gray-800">{children}</h3>
  </div>
);

const TierList = ({ icon, title, items, tone }: { icon: React.ReactNode; title: string; items: string[]; tone: string }) => {
  if (!items.length) return null;
  return (
    <div className={`rounded-lg p-4 ${tone}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h4 className="font-semibold text-gray-800">{title}</h4>
      </div>
      <ul className="list-disc ps-5 space-y-1 text-sm text-gray-700 leading-relaxed">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
};

const FactRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[minmax(7rem,30%)_1fr] gap-3 py-2 border-b border-purple-100 last:border-0 text-sm">
    <dt className="font-medium text-gray-600">{label}</dt>
    <dd className="text-gray-800 leading-relaxed">{children}</dd>
  </div>
);

const GlanceChip = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-3 min-w-0">
    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">{icon}<span>{label}</span></div>
    <div className="text-sm font-semibold text-gray-800 leading-snug break-words">{value}</div>
  </div>
);

const MajorModal = ({ isOpen, onClose, major }: MajorModalProps) => {
  const { t, i18n } = useTranslation('common');
  const { dir } = useDirection();
  if (!major) return null;

  const lang = i18n.language;
  const loc = getLocalizedMajor(major, lang);
  const tiers = getLocalizedTiers(major, lang);
  const sources = getLocalizedSources(major, lang);
  const glance = getLocalizedGlance(major, lang);
  const langProfile = getLocalizedLanguageProfile(major, lang);
  const verified = Boolean(major.lastVerified);
  const duration = loc.localizedDuration || (lang === 'en' ? '6 semesters' : '6 فصول دراسية');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl mx-4 max-h-[80vh] overflow-y-auto" dir={dir}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-orange-600 mb-2">
            {loc.name}
            {major.nameDE && <span className="text-base font-normal text-muted-foreground block mt-1">{major.nameDE}</span>}
          </DialogTitle>
        </DialogHeader>
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
            <Badge variant="secondary" className="bg-orange-100 text-orange-800"><Clock className="h-4 w-4 ml-1" />{duration}</Badge>
          )}

          {/* 2. Can I get in? */}
          {(verified || tiers) && (
            <div className="space-y-3">
              <SectionTitle icon={<Scale className="h-5 w-5 text-emerald-600" />}>{t('educational.sectionCanIGetIn')}</SectionTitle>
              {verified && (
                <div className="bg-emerald-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 font-semibold text-gray-800"><Calculator className="h-4 w-4 text-emerald-700" />{t('educational.bagrutTitle')}</div>
                  <p className="text-sm text-gray-700 leading-relaxed">{t('educational.bagrutUnits')}</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{t('educational.bagrutFormula', { min: BAGRUT_PASS_MARK })}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" dir="ltr">
                      <thead>
                        <tr className="text-gray-600 border-b border-emerald-200">
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
            <div className="space-y-3">
              <SectionTitle icon={<Globe className="h-5 w-5 text-purple-500" />}>{t('educational.sectionLanguage')}</SectionTitle>
              <dl className="bg-purple-50 rounded-lg px-4 py-1">
                <FactRow label={t('educational.langTeaching')}>{langProfile.teachingLanguage}</FactRow>
                <FactRow label={t('educational.langLevel')}><span className="font-semibold">{langProfile.requiredLevel}</span></FactRow>
                <FactRow label={t('educational.langCertificates')}>
                  <div className="flex flex-wrap gap-1.5">
                    {langProfile.acceptedCertificates.map((c) => <Badge key={c} variant="secondary" className="bg-white text-gray-800 font-normal">{c}</Badge>)}
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
            <div className="space-y-3">
              <SectionTitle icon={<Globe className="h-5 w-5 text-purple-500" />}>{t('educational.modalLanguageRequirements')}</SectionTitle>
              <div className="bg-purple-50 rounded-lg p-4"><p className="text-gray-700">{loc.localizedLanguageRequirements}</p></div>
            </div>
          )}

          {/* 4. How to apply */}
          {glance && loc.localizedRequiredBackground && (
            <div className="space-y-3">
              <SectionTitle icon={<Send className="h-5 w-5 text-blue-500" />}>{t('educational.sectionHowToApply')}</SectionTitle>
              <div className="bg-blue-50 rounded-lg p-4 space-y-2 text-sm text-gray-700">
                <p><span className="font-semibold">{t('educational.glanceChannel')}:</span> {glance.applicationChannel}</p>
                <p><span className="font-semibold">{t('educational.glanceAdmission')}:</span> {glance.admissionMode}</p>
                <p className="leading-relaxed">{loc.localizedRequiredBackground}</p>
              </div>
            </div>
          )}
          {!glance && loc.localizedRequiredBackground && (
            <div className="space-y-3">
              <SectionTitle icon={<FileText className="h-5 w-5 text-blue-500" />}>{t('educational.modalRequiredBackground')}</SectionTitle>
              <div className="bg-blue-50 rounded-lg p-4"><p className="text-gray-700">{loc.localizedRequiredBackground}</p></div>
            </div>
          )}

          {/* 5. About */}
          <div className="space-y-3">
            <SectionTitle icon={<BookOpen className="h-5 w-5 text-orange-500" />}>{glance ? t('educational.sectionAbout') : t('educational.modalDescription')}</SectionTitle>
            <div className="bg-gray-50 rounded-lg p-4 border-s-4 border-orange-500 space-y-3">
              <p className="text-gray-700 leading-relaxed">{loc.detailedDesc}</p>
              {loc.localizedSuitableFor && (
                <p className="text-gray-700 leading-relaxed flex gap-2"><Users className="h-4 w-4 mt-1 shrink-0 text-green-600" /><span><span className="font-semibold">{t('educational.modalSuitableFor')}:</span> {loc.localizedSuitableFor}</span></p>
              )}
            </div>
          </div>

          {/* 6. Careers */}
          {(loc.localizedCareerOpportunities || loc.localizedCareerProspects) && (
            <div className="space-y-3">
              <SectionTitle icon={<Briefcase className="h-5 w-5 text-amber-500" />}>{t('educational.modalCareerOpportunities')}</SectionTitle>
              <div className="bg-amber-50 rounded-lg p-4"><p className="text-gray-700">{loc.localizedCareerOpportunities || loc.localizedCareerProspects}</p></div>
            </div>
          )}
          {!tiers && loc.localizedRequirements && (
            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-gray-800">{t('educational.modalStudyRequirements')}</h3>
              <div className="bg-gray-50 rounded-lg p-4"><p className="text-gray-700">{loc.localizedRequirements}</p></div>
            </div>
          )}

          {/* 7. Arab 48 notes */}
          {loc.localizedArab48Notes && (
            <div className="space-y-3">
              <SectionTitle icon={<AlertCircle className="h-5 w-5 text-red-500" />}>{t('educational.modalArab48Notes')}</SectionTitle>
              <div className="bg-red-50 rounded-lg p-4 border-s-4 border-red-400"><p className="text-gray-700">{loc.localizedArab48Notes}</p></div>
            </div>
          )}

          {/* 8. Sources */}
          {sources.length > 0 && (
            <div className="space-y-3">
              <SectionTitle icon={<Link2 className="h-5 w-5 text-gray-600" />}>{t('educational.modalSources')}</SectionTitle>
              <ol className="space-y-2 list-decimal ps-5">
                {sources.map((s, i) => (
                  <li key={`${s.url}-${i}`} className="text-sm leading-relaxed">
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-orange-700 underline underline-offset-2 hover:text-orange-800 break-words">{s.title}</a>
                    <div className="text-gray-600">
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
      </DialogContent>
    </Dialog>
  );
};

export default MajorModal;
