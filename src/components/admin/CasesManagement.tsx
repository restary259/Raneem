
import React, { useState, useEffect } from 'react';
import { exportXLSX, exportPDF } from '@/utils/exportUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { ChevronDown, DollarSign, Save, Trash2, Download, Clock, FileSpreadsheet, FileText, Package, Plus } from 'lucide-react';
import PasswordVerifyDialog from './PasswordVerifyDialog';
import NextStepButton from './NextStepButton';
import { STATUS_COLORS, resolveStatus, statusIndex } from '@/lib/caseStatus';
import { canTransition } from '@/lib/caseTransitions';

interface StudentCase {
  id: string;
  lead_id: string;
  assigned_lawyer_id: string | null;
  student_profile_id: string | null;
  selected_city: string | null;
  selected_school: string | null;
  accommodation_status: string | null;
  service_fee: number;
  influencer_commission: number;
  lawyer_commission: number;
  referral_discount: number;
  school_commission: number;
  translation_fee: number;
  case_status: string;
  notes: string | null;
  paid_at: string | null;
  assigned_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CasesManagementProps {
  cases: StudentCase[];
  leads: { id: string; full_name: string; phone: string; source_type?: string; source_id?: string | null }[];
  lawyers: { id: string; full_name: string }[];
  onRefresh: () => void;
}

// Status colors and helpers now imported from @/lib/caseStatus

const FINANCIAL_FIELDS = ['service_fee', 'influencer_commission', 'lawyer_commission', 'referral_discount', 'school_commission', 'translation_fee'] as const;
const FINANCIAL_FIELD_KEYS: Record<string, string> = {
  service_fee: 'cases.serviceFee',
  influencer_commission: 'cases.agentComm',
  lawyer_commission: 'cases.teamMemberComm',
  referral_discount: 'cases.referralDiscount',
  school_commission: 'cases.schoolComm',
  translation_fee: 'cases.translationFee',
};

const CasesManagement: React.FC<CasesManagementProps> = ({ cases, leads, lawyers, onRefresh }) => {
  const [editingCase, setEditingCase] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showExportVerify, setShowExportVerify] = useState(false);
  const [masterServices, setMasterServices] = useState<any[]>([]);
  const [attachModal, setAttachModal] = useState<string | null>(null); // case id
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [caseSnapshots, setCaseSnapshots] = useState<Record<string, any[]>>({});
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');

  // Fetch master services and snapshots
  useEffect(() => {
    const fetchMeta = async () => {
      const [msRes, snapRes] = await Promise.all([
        (supabase as any).from('master_services').select('*').eq('is_active', true).order('sort_order'),
        (supabase as any).from('case_service_snapshots').select('*'),
      ]);
      if (msRes.data) setMasterServices(msRes.data);
      if (snapRes.data) {
        const grouped: Record<string, any[]> = {};
        snapRes.data.forEach((s: any) => {
          if (!grouped[s.case_id]) grouped[s.case_id] = [];
          grouped[s.case_id].push(s);
        });
        setCaseSnapshots(grouped);
      }
    };
    fetchMeta();
  }, [cases]);

  const getLeadName = (leadId: string) => leads.find(l => l.id === leadId)?.full_name || t('lawyer.unknown');
  const getTeamMemberName = (lawyerId: string | null) => lawyerId ? lawyers.find(l => l.id === lawyerId)?.full_name || t('cases.notAssigned') : t('cases.notAssigned');

  const startEdit = (c: StudentCase) => {
    setEditingCase(c.id);
    setEditValues({
      selected_city: c.selected_city || '', selected_school: c.selected_school || '',
      notes: c.notes || '',
    });
  };

  const attachServices = async () => {
    if (!attachModal || selectedServiceIds.length === 0) return;
    setLoading(true);
    const snapshots = selectedServiceIds.map(sid => {
      const ms = masterServices.find(m => m.id === sid);
      if (!ms) return null;
      return {
        case_id: attachModal,
        master_service_id: ms.id,
        service_name: ms.service_name,
        sale_price: ms.sale_price,
        currency: ms.currency,
        team_commission_type: ms.team_commission_type,
        team_commission_value: ms.team_commission_value,
        influencer_commission_type: ms.influencer_commission_type,
        influencer_commission_value: ms.influencer_commission_value,
        refundable: ms.refundable,
        payment_status: 'pending',
      };
    }).filter(Boolean);

    const { error } = await (supabase as any).from('case_service_snapshots').insert(snapshots);
    if (error) {
      toast({ variant: 'destructive', title: t('common.error'), description: error.message });
    } else {
      // Auto-update case totals from snapshots
      const totalSalePrice = snapshots.reduce((s, sn: any) => s + (sn?.sale_price || 0), 0);
      const totalTeamComm = snapshots.reduce((s, sn: any) => {
        if (sn?.team_commission_type === 'percentage') return s + (sn.sale_price * sn.team_commission_value / 100);
        return s + (sn?.team_commission_value || 0);
      }, 0);
      const totalInflComm = snapshots.reduce((s, sn: any) => {
        if (sn?.influencer_commission_type === 'percentage') return s + (sn.sale_price * sn.influencer_commission_value / 100);
        if (sn?.influencer_commission_type === 'none') return s;
        return s + (sn?.influencer_commission_value || 0);
      }, 0);

      // Add to existing case values + auto-advance to services_filled
      const existingCase = cases.find(c => c.id === attachModal);
      if (existingCase) {
        const updateData: Record<string, any> = {
          service_fee: existingCase.service_fee + totalSalePrice,
          lawyer_commission: existingCase.lawyer_commission + totalTeamComm,
          influencer_commission: existingCase.influencer_commission + totalInflComm,
        };
        // Auto-advance to services_filled if valid transition
        if (canTransition(existingCase.case_status, 'services_filled')) {
          updateData.case_status = 'services_filled';
        }
        await (supabase as any).from('student_cases').update(updateData).eq('id', attachModal);
      }

      toast({ title: 'Services attached', description: `${snapshots.length} services added with pricing snapshot locked.` });
      onRefresh();
    }
    setLoading(false);
    setAttachModal(null);
    setSelectedServiceIds([]);
  };

  const saveCase = async (caseId: string) => {
    setLoading(true);
    const updateData: any = {
      selected_city: editValues.selected_city || null,
      selected_school: editValues.selected_school || null,
      notes: editValues.notes || null,
    };

    const { error } = await (supabase as any).from('student_cases').update(updateData).eq('id', caseId);

    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); setLoading(false); return; }

    setLoading(false); setEditingCase(null);
    toast({ title: t('lawyer.saved') }); onRefresh();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await (supabase as any).from('appointments').delete().eq('case_id', deleteId);
    await (supabase as any).from('case_payments').delete().eq('case_id', deleteId);
    await (supabase as any).from('commissions').delete().eq('case_id', deleteId);
    await (supabase as any).from('case_service_snapshots').delete().eq('case_id', deleteId);
    const { error } = await (supabase as any).from('student_cases').delete().eq('id', deleteId);
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); }
    else { toast({ title: t('common.delete') }); onRefresh(); }
    setDeleteId(null);
  };

  const getNetProfit = (c: StudentCase) => c.service_fee + c.school_commission - c.influencer_commission - c.lawyer_commission - c.referral_discount - c.translation_fee;

  const exportCSV = () => {
    const headers = [t('admin.students.name'), t('cases.teamMemberLabel'), t('lawyer.cityLabel'), t('lawyer.schoolLabel'), t('admin.students.status'), t('cases.serviceFee'), t('cases.agentComm'), t('cases.teamMemberComm'), t('cases.netProfit'), t('admin.referralsMgmt.date')];
    const rows = cases.map(c => [
      getLeadName(c.lead_id), getTeamMemberName(c.assigned_lawyer_id), c.selected_city || '', c.selected_school || '',
      t(`cases.statuses.${c.case_status}`, c.case_status),
      c.service_fee, c.influencer_commission, c.lawyer_commission, getNetProfit(c),
      new Date(c.created_at).toLocaleDateString(),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cases.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">{t('cases.studentFiles', { count: cases.length })}</p>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowExportVerify(true)}><Download className="h-4 w-4 me-1" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => {
            const headers = [t('admin.students.name'), t('cases.teamMemberLabel'), t('lawyer.cityLabel'), t('lawyer.schoolLabel'), t('admin.students.status'), t('cases.serviceFee'), t('cases.agentComm'), t('cases.teamMemberComm'), t('cases.referralDiscount'), t('cases.schoolComm'), t('cases.translationFee'), t('cases.netProfit'), t('admin.referralsMgmt.date')];
            const rows = cases.map(c => [getLeadName(c.lead_id), getTeamMemberName(c.assigned_lawyer_id), c.selected_city || '', c.selected_school || '', t(`cases.statuses.${c.case_status}`, c.case_status), c.service_fee, c.influencer_commission, c.lawyer_commission, c.referral_discount, c.school_commission, c.translation_fee, getNetProfit(c), new Date(c.created_at).toLocaleDateString()]);
            const totalRow = ['TOTAL', '', '', '', '', cases.reduce((s,c) => s + c.service_fee, 0), cases.reduce((s,c) => s + c.influencer_commission, 0), cases.reduce((s,c) => s + c.lawyer_commission, 0), cases.reduce((s,c) => s + c.referral_discount, 0), cases.reduce((s,c) => s + c.school_commission, 0), cases.reduce((s,c) => s + c.translation_fee, 0), cases.reduce((s,c) => s + getNetProfit(c), 0), ''];
            exportXLSX({ headers, rows, fileName: `cases-${new Date().toISOString().slice(0,10)}`, title: 'Darb Study International — Cases', summaryRows: [totalRow] });
          }}><FileSpreadsheet className="h-4 w-4 me-1" />XLSX</Button>
          <Button variant="outline" size="sm" onClick={() => {
            const headers = [t('admin.students.name'), t('cases.teamMemberLabel'), t('admin.students.status'), t('cases.serviceFee'), t('cases.agentComm'), t('cases.teamMemberComm'), t('cases.netProfit')];
            const rows = cases.map(c => [getLeadName(c.lead_id), getTeamMemberName(c.assigned_lawyer_id), t(`cases.statuses.${c.case_status}`, c.case_status), c.service_fee, c.influencer_commission, c.lawyer_commission, getNetProfit(c)]);
            const totalRow = ['TOTAL', '', '', cases.reduce((s,c) => s + c.service_fee, 0), cases.reduce((s,c) => s + c.influencer_commission, 0), cases.reduce((s,c) => s + c.lawyer_commission, 0), cases.reduce((s,c) => s + getNetProfit(c), 0)];
            exportPDF({ headers, rows, fileName: `cases-${new Date().toISOString().slice(0,10)}`, title: 'Darb Study International — Cases', summaryRows: [totalRow] });
          }}><FileText className="h-4 w-4 me-1" />PDF</Button>
        </div>
      </div>
      <PasswordVerifyDialog
        open={showExportVerify}
        onOpenChange={setShowExportVerify}
        onVerified={exportCSV}
        title={t('cases.exportConfirmTitle')}
        description={t('cases.exportConfirmDesc')}
      />

      {cases.map(c => {
        const isEditing = editingCase === c.id;
        const statusLabel = t(`cases.statuses.${c.case_status}`, c.case_status);
        const statusColor = STATUS_COLORS[c.case_status] || 'bg-gray-100 text-gray-800';
        
        // SLA highlighting: red border if assigned 24h+ without progressing
        const hoursSinceAssign = c.assigned_at && c.case_status === 'assigned'
          ? (Date.now() - new Date(c.assigned_at).getTime()) / (1000 * 60 * 60) : 0;
        const isSlaWarning = hoursSinceAssign >= 24 && hoursSinceAssign < 48;
        const isSlaBreach = hoursSinceAssign >= 48;

        return (
          <Collapsible key={c.id}>
            <Card className={`shadow-sm ${isSlaBreach ? 'ring-2 ring-red-500 bg-red-50/30' : isSlaWarning ? 'ring-2 ring-amber-400 bg-amber-50/30' : ''}`}>
              <CollapsibleTrigger asChild>
                <CardContent className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm">{getLeadName(c.lead_id)}</h3>
                        {c.case_status === 'paid' && c.paid_at && (() => {
                          const daysElapsed = Math.floor((Date.now() - new Date(c.paid_at).getTime()) / (1000 * 60 * 60 * 24));
                          const daysRemaining = Math.max(0, 20 - daysElapsed);
                          return daysRemaining > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                              <Clock className="h-3 w-3" />{t('cases.daysRemaining', { count: daysRemaining })}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800">
                              {t('cases.readyToPay')}
                            </span>
                          );
                        })()}
                        {isSlaBreach && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-800">
                            🚨 SLA {Math.floor(hoursSinceAssign)}h
                          </span>
                        )}
                        {isSlaWarning && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                            ⏰ SLA {Math.floor(hoursSinceAssign)}h
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{t('cases.teamMemberLabel')} {getTeamMemberName(c.assigned_lawyer_id)}</p>
                      {c.selected_city && <p className="text-xs text-muted-foreground">{c.selected_city} {c.selected_school ? `• ${c.selected_school}` : ''}</p>}
                    </div>
                     <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
                      <NextStepButton caseId={c.id} currentStatus={c.case_status} onStatusUpdated={() => onRefresh()} />
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-4 pb-4 border-t pt-3 space-y-3">
                  {!isEditing ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between p-2 bg-emerald-50 rounded border border-emerald-200"><span>{t('cases.serviceFee')}</span><span className="font-semibold text-emerald-700">{c.service_fee} €</span></div>
                        <div className="flex justify-between p-2 bg-red-50 rounded border border-red-200"><span>{t('cases.agentComm')}</span><span className="font-semibold text-red-700">{c.influencer_commission} €</span></div>
                        <div className="flex justify-between p-2 bg-red-50 rounded border border-red-200"><span>{t('cases.teamMemberComm')}</span><span className="font-semibold text-red-700">{c.lawyer_commission} €</span></div>
                        <div className="flex justify-between p-2 bg-red-50 rounded border border-red-200"><span>{t('cases.referralDiscount')}</span><span className="font-semibold text-red-700">{c.referral_discount} €</span></div>
                        <div className="flex justify-between p-2 bg-emerald-50 rounded border border-emerald-200"><span>{t('cases.schoolComm')}</span><span className="font-semibold text-emerald-700">{c.school_commission} €</span></div>
                        <div className="flex justify-between p-2 bg-red-50 rounded border border-red-200"><span>{t('cases.translationFee')}</span><span className="font-semibold text-red-700">{c.translation_fee} €</span></div>
                      </div>
                      <div className={`flex justify-between p-3 rounded-xl font-bold text-base ${getNetProfit(c) >= 0 ? 'bg-emerald-100 border border-emerald-300' : 'bg-red-100 border border-red-300'}`}>
                        <span className="flex items-center gap-1"><DollarSign className="h-4 w-4" />{t('cases.netProfit')}</span>
                        <span className={getNetProfit(c) >= 0 ? 'text-emerald-700' : 'text-red-600'}>{getNetProfit(c)} €</span>
                      </div>
                      {/* Attached Services Snapshots */}
                      {(caseSnapshots[c.id] || []).length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" />Attached Services</p>
                          {(caseSnapshots[c.id] || []).map((snap: any) => (
                            <div key={snap.id} className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded">
                              <span>{snap.service_name}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant={snap.payment_status === 'paid' ? 'default' : 'outline'} className="text-[10px]">{snap.payment_status}</Badge>
                                <span className="font-medium">{snap.sale_price} {snap.currency}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(c)}>{t('cases.editBtn')}</Button>
                        <Button size="sm" variant="outline" onClick={() => { setAttachModal(c.id); setSelectedServiceIds([]); }}>
                          <Plus className="h-3.5 w-3.5 me-1" />Attach Services
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs">{t('lawyer.cityLabel')}</Label><Input value={editValues.selected_city} onChange={e => setEditValues(v => ({ ...v, selected_city: e.target.value }))} /></div>
                        <div><Label className="text-xs">{t('lawyer.schoolLabel')}</Label><Input value={editValues.selected_school} onChange={e => setEditValues(v => ({ ...v, selected_school: e.target.value }))} /></div>
                      </div>
                      {/* Financial fields are now READ-ONLY — calculated from service snapshots */}
                      <div className="grid grid-cols-2 gap-3">
                        {FINANCIAL_FIELDS.map(field => (
                          <div key={field} className="flex justify-between p-2 bg-muted/30 rounded border text-sm">
                            <span className="text-xs text-muted-foreground">{t(FINANCIAL_FIELD_KEYS[field])}</span>
                            <span className="font-semibold">{c[field as keyof StudentCase]} €</span>
                          </div>
                        ))}
                      </div>
                      <div><Label className="text-xs">{t('lawyer.notesLabel')}</Label><Input value={editValues.notes} onChange={e => setEditValues(v => ({ ...v, notes: e.target.value }))} /></div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveCase(c.id)} disabled={loading}><Save className="h-3.5 w-3.5 me-1" />{loading ? t('common.loading') : t('common.save')}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingCase(null)}>{t('common.cancel')}</Button>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
      {cases.length === 0 && <p className="text-center text-muted-foreground py-8">{t('cases.noFiles')}</p>}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cases.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('cases.deleteConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Attach Services Modal */}
      <Dialog open={!!attachModal} onOpenChange={() => setAttachModal(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Attach Services</DialogTitle></DialogHeader>
          {masterServices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No services configured. Add services in the Service Catalog tab first.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Select services to attach. Pricing will be locked at current rates.</p>
              {masterServices.map(ms => {
                const isChecked = selectedServiceIds.includes(ms.id);
                const alreadyAttached = (caseSnapshots[attachModal || ''] || []).some((s: any) => s.master_service_id === ms.id);
                return (
                  <label key={ms.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isChecked ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'} ${alreadyAttached ? 'opacity-50' : ''}`}>
                    <Checkbox
                      checked={isChecked}
                      disabled={alreadyAttached}
                      onCheckedChange={(checked) => {
                        setSelectedServiceIds(prev =>
                          checked ? [...prev, ms.id] : prev.filter(id => id !== ms.id)
                        );
                      }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{ms.service_name}</p>
                      <p className="text-xs text-muted-foreground">{ms.sale_price} {ms.currency}{alreadyAttached ? ' (already attached)' : ''}</p>
                    </div>
                  </label>
                );
              })}
              {selectedServiceIds.length > 0 && (
                <div className="pt-2 border-t text-sm">
                  <p className="font-medium">Total: {selectedServiceIds.reduce((s, id) => s + (masterServices.find(m => m.id === id)?.sale_price || 0), 0)} {masterServices[0]?.currency || 'ILS'}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={attachServices} disabled={loading || selectedServiceIds.length === 0}>
              {loading ? 'Attaching...' : `Attach ${selectedServiceIds.length} Service${selectedServiceIds.length !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CasesManagement;
