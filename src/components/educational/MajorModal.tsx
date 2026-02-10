
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Clock, BookOpen, Users, FileText, Globe, Briefcase, AlertCircle } from 'lucide-react';
import { SubMajor } from '@/data/majorsData';

interface MajorModalProps {
  isOpen: boolean;
  onClose: () => void;
  major: SubMajor | null;
}

const MajorModal = ({ isOpen, onClose, major }: MajorModalProps) => {
  if (!major) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl mx-4 max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="text-2xl font-bold text-orange-600 mb-4">
            {major.nameAR}
            {major.nameDE && <span className="text-base font-normal text-muted-foreground block mt-1">{major.nameDE}</span>}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Duration Badge */}
          <div className="flex items-center gap-2 justify-end">
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              <Clock className="h-4 w-4 ml-1" />
              {major.duration || '6 فصول دراسية'}
            </Badge>
          </div>

          {/* Description Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 justify-end">
              <h3 className="text-xl font-semibold text-gray-800">الوصف</h3>
              <BookOpen className="h-5 w-5 text-orange-500" />
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6 border-r-4 border-orange-500">
              <p className="text-gray-700 leading-relaxed text-right">
                {major.detailedDescription || major.description}
              </p>
            </div>
          </div>

          {/* Suitable For */}
          {major.suitableFor && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 justify-end">
                <h3 className="text-xl font-semibold text-gray-800">مناسب لـ</h3>
                <Users className="h-5 w-5 text-green-500" />
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-gray-700 text-right">{major.suitableFor}</p>
              </div>
            </div>
          )}

          {/* Required Background */}
          {major.requiredBackground && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 justify-end">
                <h3 className="text-xl font-semibold text-gray-800">الخلفية المطلوبة</h3>
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-gray-700 text-right">{major.requiredBackground}</p>
              </div>
            </div>
          )}

          {/* Language Requirements */}
          {major.languageRequirements && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 justify-end">
                <h3 className="text-xl font-semibold text-gray-800">متطلبات اللغة</h3>
                <Globe className="h-5 w-5 text-purple-500" />
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-gray-700 text-right">{major.languageRequirements}</p>
              </div>
            </div>
          )}

          {/* Career Opportunities */}
          {(major.careerOpportunities || major.careerProspects) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 justify-end">
                <h3 className="text-xl font-semibold text-gray-800">فرص العمل في ألمانيا</h3>
                <Briefcase className="h-5 w-5 text-amber-500" />
              </div>
              <div className="bg-amber-50 rounded-lg p-4">
                <p className="text-gray-700 text-right">{major.careerOpportunities || major.careerProspects}</p>
              </div>
            </div>
          )}

          {/* Study Requirements */}
          {major.requirements && (
            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-gray-800 text-right">متطلبات الدراسة</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700 text-right">{major.requirements}</p>
              </div>
            </div>
          )}

          {/* Arab 48 Notes */}
          {major.arab48Notes && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 justify-end">
                <h3 className="text-xl font-semibold text-gray-800">ملاحظات لطلاب عرب 48</h3>
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div className="bg-red-50 rounded-lg p-4 border-r-4 border-red-400">
                <p className="text-gray-700 text-right">{major.arab48Notes}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MajorModal;
