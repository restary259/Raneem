import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface PaymentConfirmDialogProps {
  caseId: string | null;
  saving: boolean;
  onConfirm: (caseId: string) => void;
  onClose: () => void;
}

export const PaymentConfirmDialog: React.FC<PaymentConfirmDialogProps> = ({ caseId, saving, onConfirm, onClose }) => {
  const { t, i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';

  return (
    <AlertDialog open={!!caseId} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isAr ? 'تأكيد استلام الدفع' : 'Payment Confirmation'}</AlertDialogTitle>
          <AlertDialogDescription>
            {isAr ? 'هل تم استلام الدفعة من الطالب؟ سيتم تحديث الحالة وحساب العمولات تلقائياً.' : 'Did you receive payment from the student? This will update the status and auto-calculate commissions.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => { if (caseId) onConfirm(caseId); }} disabled={saving}>
            {saving ? t('common.loading') : (isAr ? 'نعم، تم الاستلام' : 'Yes, Payment Received')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

interface DeleteConfirmDialogProps {
  caseId: string | null;
  onConfirm: (caseId: string) => void;
  onClose: () => void;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({ caseId, onConfirm, onClose }) => {
  const { t, i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';

  return (
    <AlertDialog open={!!caseId} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isAr ? 'حذف الحالة' : 'Delete Case'}</AlertDialogTitle>
          <AlertDialogDescription>
            {isAr ? 'هل أنت متأكد من حذف هذه الحالة؟ لا يمكن التراجع.' : 'Are you sure you want to delete this case? This cannot be undone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => { if (caseId) onConfirm(caseId); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {isAr ? 'حذف' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
