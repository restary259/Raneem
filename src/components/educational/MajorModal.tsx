
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { X, Clock, BookOpen } from 'lucide-react';
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
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="text-2xl font-bold text-orange-600 mb-4">
            {major.nameAR}
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

          {/* Career Prospects (if available) */}
          {major.careerProspects && (
            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-gray-800 text-right">الآفاق المهنية</h3>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-gray-700 text-right">{major.careerProspects}</p>
              </div>
            </div>
          )}

          {/* Study Requirements (if available) */}
          {major.requirements && (
            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-gray-800 text-right">متطلبات الدراسة</h3>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-gray-700 text-right">{major.requirements}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MajorModal;
