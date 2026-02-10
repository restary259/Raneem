
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Clock, BookOpen, Users, FileText, Globe, Briefcase, AlertCircle } from 'lucide-react';
import { SubMajor } from '@/data/majorsData';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';

interface MajorModalProps {
  isOpen: boolean;
  onClose: () => void;
  major: SubMajor | null;
}

const MajorModal = ({ isOpen, onClose, major }: MajorModalProps) => {
  const { t } = useTranslation('common');
  const { dir } = useDirection();
  if (!major) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl mx-4 max-h-[80vh] overflow-y-auto" dir={dir}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-orange-600 mb-4">
            {major.nameAR}
            {major.nameDE && <span className="text-base font-normal text-muted-foreground block mt-1">{major.nameDE}</span>}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              <Clock className="h-4 w-4 ml-1" />
              {major.duration || '6 فصول دراسية'}
            </Badge>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-orange-500" />
              <h3 className="text-xl font-semibold text-gray-800">{t('educational.modalDescription')}</h3>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 border-r-4 border-orange-500">
              <p className="text-gray-700 leading-relaxed">{major.detailedDescription || major.description}</p>
            </div>
          </div>
          {major.suitableFor && (
            <div className="space-y-3">
              <div className="flex items-center gap-2"><Users className="h-5 w-5 text-green-500" /><h3 className="text-xl font-semibold text-gray-800">{t('educational.modalSuitableFor')}</h3></div>
              <div className="bg-green-50 rounded-lg p-4"><p className="text-gray-700">{major.suitableFor}</p></div>
            </div>
          )}
          {major.requiredBackground && (
            <div className="space-y-3">
              <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-blue-500" /><h3 className="text-xl font-semibold text-gray-800">{t('educational.modalRequiredBackground')}</h3></div>
              <div className="bg-blue-50 rounded-lg p-4"><p className="text-gray-700">{major.requiredBackground}</p></div>
            </div>
          )}
          {major.languageRequirements && (
            <div className="space-y-3">
              <div className="flex items-center gap-2"><Globe className="h-5 w-5 text-purple-500" /><h3 className="text-xl font-semibold text-gray-800">{t('educational.modalLanguageRequirements')}</h3></div>
              <div className="bg-purple-50 rounded-lg p-4"><p className="text-gray-700">{major.languageRequirements}</p></div>
            </div>
          )}
          {(major.careerOpportunities || major.careerProspects) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-amber-500" /><h3 className="text-xl font-semibold text-gray-800">{t('educational.modalCareerOpportunities')}</h3></div>
              <div className="bg-amber-50 rounded-lg p-4"><p className="text-gray-700">{major.careerOpportunities || major.careerProspects}</p></div>
            </div>
          )}
          {major.requirements && (
            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-gray-800">{t('educational.modalStudyRequirements')}</h3>
              <div className="bg-gray-50 rounded-lg p-4"><p className="text-gray-700">{major.requirements}</p></div>
            </div>
          )}
          {major.arab48Notes && (
            <div className="space-y-3">
              <div className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-red-500" /><h3 className="text-xl font-semibold text-gray-800">{t('educational.modalArab48Notes')}</h3></div>
              <div className="bg-red-50 rounded-lg p-4 border-r-4 border-red-400"><p className="text-gray-700">{major.arab48Notes}</p></div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MajorModal;
