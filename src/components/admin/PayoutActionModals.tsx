import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';

interface ApproveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (notes: string) => void;
  amount?: number;
}

export const ApproveModal: React.FC<ApproveModalProps> = ({ open, onOpenChange, onConfirm, amount }) => {
  const { t } = useTranslation('dashboard');
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    onConfirm(notes);
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('admin.payouts.approveTitle', 'Approve Payout')}</DialogTitle>
        </DialogHeader>
        {amount !== undefined && <p className="text-sm text-muted-foreground">{t('admin.payouts.amount')}: <strong>{amount.toLocaleString()} ₪</strong></p>}
        <div>
          <Label>{t('admin.payouts.notesOptional', 'Notes (optional)')}</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('admin.shared.cancelBtn')}</Button>
          <Button onClick={handleConfirm}>{t('admin.payouts.approveBtn', 'Approve')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface RejectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}

export const RejectModal: React.FC<RejectModalProps> = ({ open, onOpenChange, onConfirm }) => {
  const { t } = useTranslation('dashboard');
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm(reason);
    setReason('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('admin.payouts.rejectTitle', 'Reject Payout')}</DialogTitle>
        </DialogHeader>
        <div>
          <Label>{t('admin.payouts.rejectReason', 'Reason (required)')}</Label>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} className="mt-1" required />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('admin.shared.cancelBtn')}</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!reason.trim()}>{t('admin.payouts.rejectBtn', 'Reject')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface MarkPaidModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (paymentMethod: string, transactionRef: string, notes: string) => void;
  amount?: number;
}

export const MarkPaidModal: React.FC<MarkPaidModalProps> = ({ open, onOpenChange, onConfirm, amount }) => {
  const { t } = useTranslation('dashboard');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    if (!paymentMethod) return;
    onConfirm(paymentMethod, transactionRef, notes);
    setPaymentMethod('');
    setTransactionRef('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('admin.payouts.markPaidTitle', 'Mark as Paid')}</DialogTitle>
        </DialogHeader>
        {amount !== undefined && <p className="text-sm text-muted-foreground">{t('admin.payouts.amount')}: <strong>{amount.toLocaleString()} ₪</strong></p>}
        <div className="space-y-3">
          <div>
            <Label>{t('admin.payouts.paymentMethod', 'Payment Method')}</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="mt-1"><SelectValue placeholder={t('admin.payouts.selectMethod', 'Select method')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">{t('admin.payouts.methods.bank', 'Bank Transfer')}</SelectItem>
                <SelectItem value="paypal">{t('admin.payouts.methods.paypal', 'PayPal')}</SelectItem>
                <SelectItem value="cash">{t('admin.payouts.methods.cash', 'Cash')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('admin.payouts.transactionRef', 'Transaction ID / Reference')}</Label>
            <Input value={transactionRef} onChange={e => setTransactionRef(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>{t('admin.payouts.notesOptional', 'Notes (optional)')}</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('admin.shared.cancelBtn')}</Button>
          <Button onClick={handleConfirm} disabled={!paymentMethod}>{t('admin.payouts.confirmPay', 'Confirm Payment')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
