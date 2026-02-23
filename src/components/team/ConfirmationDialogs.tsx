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
  const { t } = useTranslation('dashboard');

  return (
    <AlertDialog open={!!caseId} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('lawyer.paymentConfirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('lawyer.paymentConfirmDesc')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => { if (caseId) onConfirm(caseId); }} disabled={saving}>
            {saving ? t('common.loading') : t('lawyer.yesPaymentReceived')}
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
  const { t } = useTranslation('dashboard');

  return (
    <AlertDialog open={!!caseId} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('lawyer.deleteCaseTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('lawyer.deleteCaseDesc')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => { if (caseId) onConfirm(caseId); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
