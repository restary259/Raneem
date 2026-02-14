import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

interface LinkedStudentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentNames: string[];
}

const LinkedStudentsModal: React.FC<LinkedStudentsModalProps> = ({ open, onOpenChange, studentNames }) => {
  const { t } = useTranslation('dashboard');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('admin.payouts.linkedStudents', 'Linked Students')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {studentNames.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t('admin.payouts.noLinkedStudents', 'No linked students')}</p>
          ) : (
            studentNames.map((name, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {name.charAt(0)}
                </div>
                <span className="font-medium text-sm">{name}</span>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LinkedStudentsModal;
