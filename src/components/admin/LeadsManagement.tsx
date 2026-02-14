
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Phone, MapPin, GraduationCap, DollarSign, Plus, Search, UserCheck, UserX, Gavel, Trash2, Download, Edit, CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Lead {
  id: string;
  full_name: string;
  phone: string;
  city: string | null;
  age: number | null;
  education_level: string | null;
  german_level: string | null;
  budget_range: string | null;
  preferred_city: string | null;
  accommodation: boolean;
  source_type: string;
  source_id: string | null;
  eligibility_score: number | null;
  eligibility_reason: string | null;
  passport_type: string | null;
  english_units: number | null;
  math_units: number | null;
  status: string;
  created_at: string;
}

interface LeadsManagementProps {
  leads: Lead[];
  lawyers: { id: string; full_name: string }[];
  influencers?: { id: string; full_name: string }[];
  onRefresh: () => void;
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  new: 'default',
  eligible: 'secondary',
  not_eligible: 'destructive',
  assigned: 'outline',
};

const LeadsManagement: React.FC<LeadsManagementProps> = ({ leads, lawyers, influencers = [], onRefresh }) => {
  const { t, i18n } = useTranslation('dashboard');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [assignModal, setAssignModal] = useState<{ leadId: string; leadName: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedLawyer, setSelectedLawyer] = useState('');
  const [overrideModal, setOverrideModal] = useState<Lead | null>(null);
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideStatus, setOverrideStatus] = useState('');
  const [newLead, setNewLead] = useState({ full_name: '', phone: '', city: '', age: '', education_level: '', german_level: '', budget_range: '', preferred_city: '', accommodation: false, source_type: 'organic', eligibility_score: '' });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const filtered = leads.filter(l => {
    const matchSearch = l.full_name.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search);
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleAddLead = async () => {
    if (!newLead.full_name || !newLead.phone) { toast({ variant: 'destructive', title: t('common.error'), description: t('admin.leads.namePhoneRequired') }); return; }
    setLoading(true);
    const { error } = await (supabase as any).from('leads').insert({
      full_name: newLead.full_name, phone: newLead.phone, city: newLead.city || null,
      age: newLead.age ? parseInt(newLead.age) : null, education_level: newLead.education_level || null,
      german_level: newLead.german_level || null, budget_range: newLead.budget_range || null,
      preferred_city: newLead.preferred_city || null, accommodation: newLead.accommodation,
      source_type: newLead.source_type, eligibility_score: newLead.eligibility_score ? parseInt(newLead.eligibility_score) : null,
    });
    setLoading(false);
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); return; }
    toast({ title: t('admin.leads.added') });
    setShowAddModal(false);
    setNewLead({ full_name: '', phone: '', city: '', age: '', education_level: '', german_level: '', budget_range: '', preferred_city: '', accommodation: false, source_type: 'organic', eligibility_score: '' });
    onRefresh();
  };

  const markEligible = async (lead: Lead) => {
    setLoading(true);
    const { error: updateErr } = await (supabase as any).from('leads').update({ status: 'eligible' }).eq('id', lead.id);
    if (updateErr) { toast({ variant: 'destructive', title: t('common.error'), description: updateErr.message }); setLoading(false); return; }
    const { error: caseErr } = await (supabase as any).from('student_cases').insert({ lead_id: lead.id, selected_city: lead.preferred_city, accommodation_status: lead.accommodation ? 'needed' : 'not_needed' });
    if (caseErr) { toast({ variant: 'destructive', title: t('admin.leads.caseCreationError'), description: caseErr.message }); }
    setLoading(false);
    toast({ title: t('admin.leads.updated'), description: t('admin.leads.qualifiedAndCaseCreated', { name: lead.full_name }) });
    onRefresh();
  };

  const markNotEligible = async (leadId: string) => {
    const { error } = await (supabase as any).from('leads').update({ status: 'not_eligible' }).eq('id', leadId);
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); return; }
    toast({ title: t('admin.leads.updated') }); onRefresh();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    // Clean up related records first to avoid FK constraint violations
    const { data: relatedCases } = await (supabase as any).from('student_cases').select('id').eq('lead_id', deleteId);
    if (relatedCases?.length) {
      for (const c of relatedCases) {
        await (supabase as any).from('appointments').delete().eq('case_id', c.id);
        await (supabase as any).from('case_payments').delete().eq('case_id', c.id);
        await (supabase as any).from('commissions').delete().eq('case_id', c.id);
      }
      await (supabase as any).from('student_cases').delete().eq('lead_id', deleteId);
    }
    const { error } = await (supabase as any).from('leads').delete().eq('id', deleteId);
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); }
    else { toast({ title: t('admin.leads.deleted') }); onRefresh(); }
    setDeleteId(null);
  };

  const assignLawyer = async () => {
    if (!assignModal || !selectedLawyer) return;
    setLoading(true);
    await (supabase as any).from('leads').update({ status: 'assigned' }).eq('id', assignModal.leadId);
    const { data: existingCases } = await (supabase as any).from('student_cases').select('id').eq('lead_id', assignModal.leadId).limit(1);
    if (existingCases?.[0]) {
      await (supabase as any).from('student_cases').update({ assigned_lawyer_id: selectedLawyer }).eq('id', existingCases[0].id);
    } else {
      // Create case if none exists
      const lead = leads.find(l => l.id === assignModal.leadId);
      await (supabase as any).from('student_cases').insert({
        lead_id: assignModal.leadId,
        assigned_lawyer_id: selectedLawyer,
        selected_city: lead?.preferred_city || null,
        accommodation_status: lead?.accommodation ? 'needed' : 'not_needed',
      });
    }
    // Audit log
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await (supabase as any).from('admin_audit_log').insert({
        admin_id: session.user.id,
        action: 'assign_team_member',
        target_id: assignModal.leadId,
        target_table: 'leads',
        details: `Assigned team member ${lawyers.find(l => l.id === selectedLawyer)?.full_name || selectedLawyer} to ${assignModal.leadName}`,
      });
    }
    setLoading(false);
    toast({ title: t('admin.leads.teamMemberAssigned') });
    setAssignModal(null); setSelectedLawyer(''); onRefresh();
  };

  const handleOverrideScore = async () => {
    if (!overrideModal) return;
    setLoading(true);
    const { error } = await (supabase as any).from('leads').update({
      eligibility_score: overrideScore ? parseInt(overrideScore) : null,
      status: overrideStatus || overrideModal.status,
    }).eq('id', overrideModal.id);

    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); }
    else {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await (supabase as any).from('admin_audit_log').insert({
          admin_id: session.user.id,
          action: 'override_eligibility',
          target_id: overrideModal.id,
          target_table: 'leads',
          details: `Override score to ${overrideScore}, status to ${overrideStatus || overrideModal.status}`,
        });
      }
      toast({ title: t('admin.leads.scoreUpdated') });
      onRefresh();
    }
    setLoading(false);
    setOverrideModal(null);
  };

  const exportCSV = () => {
    const hk = t('admin.leads.csvHeaders', { returnObjects: true }) as Record<string, string>;
    const headers = [hk.name, hk.phone, hk.city, hk.passport, hk.english, hk.math, hk.education, hk.german, hk.score, hk.status, hk.source, hk.date];
    const locale = i18n.language === 'ar' ? 'ar' : 'en-US';
    const rows = filtered.map(l => [
      l.full_name, l.phone, l.city || '', l.passport_type || '', l.english_units ?? '', l.math_units ?? '',
      l.education_level || '', l.german_level || '', l.eligibility_score ?? '', l.status, l.source_type,
      new Date(l.created_at).toLocaleDateString(locale),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'leads.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const statusKeys = ['new', 'eligible', 'not_eligible', 'assigned'] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t('admin.leads.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="ps-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.leads.all')}</SelectItem>
              {statusKeys.map(k => <SelectItem key={k} value={k}>{String(t(`admin.leads.${k === 'not_eligible' ? 'notEligible' : k}`))}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 me-1" />{t('admin.leads.exportCSV')}</Button>
          <Button onClick={() => setShowAddModal(true)} size="sm"><Plus className="h-4 w-4 me-1" />{t('admin.leads.addLead')}</Button>
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.map(lead => {
          const variant = STATUS_VARIANTS[lead.status] || STATUS_VARIANTS.new;
          const statusLabel = String(t(`admin.leads.${lead.status === 'not_eligible' ? 'notEligible' : lead.status}`));
          const sourceLabel = String(t(`lawyer.sources.${lead.source_type}`, { defaultValue: lead.source_type }));
          const score = lead.eligibility_score ?? 0;
          const isEligible = score >= 50;
          return (
            <Card key={lead.id} className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-base">{lead.full_name}</h3>
                    <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-sm text-primary hover:underline mt-1">
                      <Phone className="h-3.5 w-3.5" />{lead.phone}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={variant}>{statusLabel}</Badge>
                    <Badge variant="outline" className="text-xs">{sourceLabel}</Badge>
                    {lead.source_type === 'influencer' && lead.source_id && (() => {
                      const inf = influencers.find(i => i.id === lead.source_id);
                      return inf ? <Badge variant="secondary" className="text-xs">{t('admin.leads.via', { name: inf.full_name })}</Badge> : null;
                    })()}
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteId(lead.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  {lead.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{lead.city}</span>}
                  {lead.german_level && <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{lead.german_level}</span>}
                  {lead.passport_type && <span>{t('admin.leads.passport')} {lead.passport_type}</span>}
                  {lead.english_units != null && <span>{t('admin.leads.englishUnits', { count: lead.english_units })}</span>}
                  {lead.math_units != null && <span>{t('admin.leads.mathUnits', { count: lead.math_units })}</span>}
                </div>

                <div className={`flex items-start gap-2 p-2 rounded-lg text-xs ${isEligible ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                  {isEligible ? (
                    <><CheckCircle className="h-4 w-4 shrink-0" /><span>{t('admin.leads.eligibleLabel', { score })}</span></>
                  ) : (
                    <><XCircle className="h-4 w-4 shrink-0" /><span>{t('admin.leads.ineligibleLabel', { reason: lead.eligibility_reason || t('admin.leads.ineligibleDefault'), score })}</span></>
                  )}
                  <Button variant="ghost" size="sm" className="h-5 px-1 ms-auto text-xs" onClick={() => { setOverrideModal(lead); setOverrideScore(String(score)); setOverrideStatus(lead.status); }}>
                    <Edit className="h-3 w-3" />
                  </Button>
                </div>

                {lead.status === 'new' && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="default" onClick={() => markEligible(lead)} disabled={loading}><UserCheck className="h-3.5 w-3.5 me-1" />{t('admin.leads.markEligible')}</Button>
                    <Button size="sm" variant="destructive" onClick={() => markNotEligible(lead.id)} disabled={loading}><UserX className="h-3.5 w-3.5 me-1" />{t('admin.leads.markNotEligible')}</Button>
                  </div>
                )}
                {lead.status === 'eligible' && (
                  <Button size="sm" variant="outline" onClick={() => setAssignModal({ leadId: lead.id, leadName: lead.full_name })} disabled={loading}>
                    <Gavel className="h-3.5 w-3.5 me-1" />{t('admin.leads.assignTeamMember')}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">{t('admin.leads.noLeads')}</p>}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.shared.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.shared.deleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.shared.cancelBtn')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('admin.shared.deleteBtn')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Override Eligibility Modal */}
      <Dialog open={!!overrideModal} onOpenChange={() => setOverrideModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('admin.leads.overrideTitle', { name: overrideModal?.full_name })}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t('admin.leads.score')}</Label><Input type="number" value={overrideScore} onChange={e => setOverrideScore(e.target.value)} /></div>
            <div><Label>{t('admin.leads.status')}</Label>
              <Select value={overrideStatus} onValueChange={setOverrideStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">{t('admin.leads.new')}</SelectItem>
                  <SelectItem value="eligible">{t('admin.leads.eligible')}</SelectItem>
                  <SelectItem value="not_eligible">{t('admin.leads.notEligible')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleOverrideScore} disabled={loading}>{loading ? t('admin.leads.saving') : t('admin.leads.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Lead Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('admin.leads.addLeadTitle')}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Label>{t('admin.leads.fullName')}</Label><Input value={newLead.full_name} onChange={e => setNewLead(p => ({ ...p, full_name: e.target.value }))} /></div>
            <div><Label>{t('admin.leads.phone')}</Label><Input value={newLead.phone} onChange={e => setNewLead(p => ({ ...p, phone: e.target.value }))} /></div>
            <div><Label>{t('admin.leads.city')}</Label><Input value={newLead.city} onChange={e => setNewLead(p => ({ ...p, city: e.target.value }))} /></div>
            <div><Label>{t('admin.leads.age')}</Label><Input type="number" value={newLead.age} onChange={e => setNewLead(p => ({ ...p, age: e.target.value }))} /></div>
            <div><Label>{t('admin.leads.germanLevel')}</Label><Input value={newLead.german_level} onChange={e => setNewLead(p => ({ ...p, german_level: e.target.value }))} /></div>
            <div className="sm:col-span-2"><Label>{t('admin.leads.eligibilityScore')}</Label><Input type="number" value={newLead.eligibility_score} onChange={e => setNewLead(p => ({ ...p, eligibility_score: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddLead} disabled={loading}>{loading ? t('admin.leads.adding') : t('admin.leads.add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Team Member Modal */}
      <Dialog open={!!assignModal} onOpenChange={() => setAssignModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('admin.leads.assignTeamMemberTitle', { name: assignModal?.leadName })}</DialogTitle></DialogHeader>
          <Select value={selectedLawyer} onValueChange={setSelectedLawyer}>
            <SelectTrigger><SelectValue placeholder={t('admin.leads.selectTeamMember')} /></SelectTrigger>
            <SelectContent>
              {lawyers.map(l => <SelectItem key={l.id} value={l.id}>{l.full_name}</SelectItem>)}
              {lawyers.length === 0 && <SelectItem value="none" disabled>{t('admin.leads.noTeamMembers')}</SelectItem>}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button onClick={assignLawyer} disabled={loading || !selectedLawyer}>{loading ? t('admin.leads.assigning') : t('admin.leads.assign')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadsManagement;
