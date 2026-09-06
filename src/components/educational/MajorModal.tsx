
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Clock, BookOpen, Users, FileText, Globe, Briefcase, AlertCircle, Scale, Building2, Lightbulb, Link2, Calculator } from 'lucide-react';
import { SubMajor } from '@/data/majorsData';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';
import { getLocalizedMajor, getLocalizedTiers, getLocalizedSources } from '@/utils/majorLocale';
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

const TierList = ({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone: string;
}) => {
  if (!items.length) return null;
  return (
    <div className={`rounded-lg p-4 ${tone}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h4 className="font-semibold text-gray-800">{title}</h4>
      </div>
      <ul className="list-disc ps-5 space-y-1 text-sm text-gray-700 leading-relaxed">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
};

const MajorModal = ({ isOpen, onClose, major }: MajorModalProps) => {
  const { t, i18n } = useTranslation('common');
  const { dir } = useDirection();
  if (!major) return null;

  const lang = i18n.language;
  const loc = getLocalizedMajor(major, lang);
  const tiers = getLocalizedTiers(major, lang);
  const sources = getLocalizedSources(major, lang);
  const showVerified = Boolean(major.lastVerified);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl mx-4 max-h-[80vh] overflow-y-auto" dir={dir}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-orange-600 mb-4">
            {loc.name}
            {major.nameDE && <span className="text-base font-normal text-muted-foreground block mt-1">{major.nameDE}</span>}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              <Clock className="h-4 w-4 ml-1" />
              {loc.localizedDuration || (i18n.language === 'en' ? '6 semesters' : '6 فصول دراسية')}
            </Badge>
            {showVerified && (
              <Badge variant="outline" className="text-xs">
                {t('educational.lastVerified', { date: formatMonth(major.lastVerified!, lang) })}
              </Badge>
            )}
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-orange-500" />
              <h3 className="text-xl font-semibold text-gray-800">{t('educational.modalDescription')}</h3>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 border-r-4 border-orange-500">
              <p className="text-gray-700 leading-relaxed">{loc.detailedDesc}</p>
            </div>
          </div>
          {loc.localizedSuitableFor && (
            <div className="space-y-3">
              <div className="flex items-center gap-2"><Users className="h-5 w-5 text-green-500" /><h3 className="text-xl font-semibold text-gray-800">{t('educational.modalSuitableFor')}</h3></div>
              <div className="bg-green-50 rounded-lg p-4"><p className="text-gray-700">{loc.localizedSuitableFor}</p></div>
            </div>
          )}
          {loc.localizedRequiredBackground && (
            <div className="space-y-3">
              <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-blue-500" /><h3 className="text-xl font-semibold text-gray-800">{t('educational.modalRequiredBackground')}</h3></div>
              <div className="bg-blue-50 rounded-lg p-4"><p className="text-gray-700">{loc.localizedRequiredBackground}</p></div>
            </div>
          )}
          {tiers && (
            <div className="space-y-3">
              <div className="flex items-center gap-2"><Scale className="h-5 w-5 text-slate-600" /><h3 className="text-xl font-semibold text-gray-800">{t('educational.modalAdmissionTiers')}</h3></div>
              <p className="text-sm text-muted-foreground">{t('educational.tiersHint')}</p>
              <div className="space-y-3">
                <TierList icon={<Scale className="h-4 w-4 text-slate-700" />} title={t('educational.tierOfficial')} items={tiers.official} tone="bg-slate-50 border border-slate-200" />
                <TierList icon={<Building2 className="h-4 w-4 text-sky-700" />} title={t('educational.tierUniversity')} items={tiers.universitySpecific} tone="bg-sky-50 border border-sky-200" />
                <TierList icon={<Lightbulb className="h-4 w-4 text-amber-700" />} title={t('educational.tierDarb')} items={tiers.darbGuidance} tone="bg-amber-50 border border-amber-200" />
              </div>
            </div>
          )}
          {showVerified && (
            <div className="space-y-3">
              <div className="flex items-center gap-2"><Calculator className="h-5 w-5 text-emerald-600" /><h3 className="text-xl font-semibold text-gray-800">{t('educational.bagrutTitle')}</h3></div>
              <div className="bg-emerald-50 rounded-lg p-4 space-y-3">
                <p className="text-sm text-gray-700 leading-relaxed">{t('educational.bagrutUnits')}</p>
                <p className="text-sm text-gray-700 leading-relaxed">{t('educational.bagrutFormula', { min: BAGRUT_PASS_MARK })}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-start" dir="ltr">
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
            </div>
          )}
          {loc.localizedLanguageRequirements && (
            <div className="space-y-3">
              <div className="flex items-center gap-2"><Globe className="h-5 w-5 text-purple-500" /><h3 className="text-xl font-semibold text-gray-800">{t('educational.modalLanguageRequirements')}</h3></div>
              <div className="bg-purple-50 rounded-lg p-4"><p className="text-gray-700">{loc.localizedLanguageRequirements}</p></div>
            </div>
          )}
          {(loc.localizedCareerOpportunities || loc.localizedCareerProspects) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-amber-500" /><h3 className="text-xl font-semibold text-gray-800">{t('educational.modalCareerOpportunities')}</h3></div>
              <div className="bg-amber-50 rounded-lg p-4"><p className="text-gray-700">{loc.localizedCareerOpportunities || loc.localizedCareerProspects}</p></div>
            </div>
          )}
          {loc.localizedRequirements && (
            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-gray-800">{t('educational.modalStudyRequirements')}</h3>
              <div className="bg-gray-50 rounded-lg p-4"><p className="text-gray-700">{loc.localizedRequirements}</p></div>
            </div>
          )}
          {loc.localizedArab48Notes && (
            <div className="space-y-3">
              <div className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-red-500" /><h3 className="text-xl font-semibold text-gray-800">{t('educational.modalArab48Notes')}</h3></div>
              <div className="bg-red-50 rounded-lg p-4 border-r-4 border-red-400"><p className="text-gray-700">{loc.localizedArab48Notes}</p></div>
            </div>
          )}
          {sources.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2"><Link2 className="h-5 w-5 text-gray-600" /><h3 className="text-xl font-semibold text-gray-800">{t('educational.modalSources')}</h3></div>
              <ol className="space-y-2 list-decimal ps-5">
                {sources.map((s, i) => (
                  <li key={`${s.url}-${i}`} className="text-sm leading-relaxed">
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-orange-700 underline underline-offset-2 hover:text-orange-800 break-words">
                      {s.title}
                    </a>
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
