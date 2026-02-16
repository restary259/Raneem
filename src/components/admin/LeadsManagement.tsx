
import React, { useState } from 'react';
import { exportPDF } from '@/utils/exportUtils';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { Phone, MapPin, GraduationCap, Plus, Search, UserCheck, UserX, Gavel, Trash2, Edit, CheckCircle, XCircle, FileText, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PullToRefresh from '@/components/common/PullToRefresh';
interface Lead {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
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
  ref_code?: string | null;
  study_destination?: string | null;
  preferred_major?: string | null;
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
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [assignModal, setAssignModal] = useState<{ leadId: string; leadName: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedLawyer, setSelectedLawyer] = useState('');
  const [overrideModal, setOverrideModal] = useState<Lead | null>(null);
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideStatus, setOverrideStatus] = useState('');
  const [newLead, setNewLead] = useState({ full_name: '', phone: '', city: '', age: '', education_level: '', german_level: '', budget_range: '', preferred_city: '', accommodation: false, source_type: 'organic', eligibility_score: '', passport_type: '', english_units: '', math_units: '', email: '', preferred_major: '' });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const filtered = leads.filter(l => {
    const matchSearch = l.full_name.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search) || (l.email?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;
    const matchSource = filterSource === 'all' || l.source_type === filterSource;
    return matchSearch && matchStatus && matchSource;
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
      passport_type: newLead.passport_type || null,
      english_units: newLead.english_units ? parseInt(newLead.english_units) : null,
      math_units: newLead.math_units ? parseInt(newLead.math_units) : null,
      email: newLead.email || null,
      preferred_major: newLead.preferred_major || null,
    });
    setLoading(false);
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); return; }
    toast({ title: t('admin.leads.added') });
    setShowAddModal(false);
    setNewLead({ full_name: '', phone: '', city: '', age: '', education_level: '', german_level: '', budget_range: '', preferred_city: '', accommodation: false, source_type: 'organic', eligibility_score: '', passport_type: '', english_units: '', math_units: '', email: '', preferred_major: '' });
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
    const { data: relatedCases } = await (supabase as any).from('student_cases').select('id').eq('lead_id', deleteId);
    if (relatedCases?.length) {
      for (const c of relatedCases) {
        await (supabase as any).from('appointments').delete().eq('case_id', c.id);
        await (supabase as any).from('case_payments').delete().eq('case_id', c.id);
        await (supabase as any).from('commissions').delete().eq('case_id', c.id);
        await (supabase as any).from('case_service_snapshots').delete().eq('case_id', c.id);
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
      await (supabase as any).from('student_cases').update({ assigned_lawyer_id: selectedLawyer, assigned_at: new Date().toISOString() }).eq('id', existingCases[0].id);
    } else {
      const lead = leads.find(l => l.id === assignModal.leadId);
      await (supabase as any).from('student_cases').insert({
        lead_id: assignModal.leadId,
        assigned_lawyer_id: selectedLawyer,
        selected_city: lead?.preferred_city || null,
        accommodation_status: lead?.accommodation ? 'needed' : 'not_needed',
        assigned_at: new Date().toISOString(),
      });
    }
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

  const statusKeys = ['new', 'eligible', 'not_eligible', 'assigned'] as const;
  const sourceTypes = [...new Set(leads.map(l => l.source_type))];
  const locale = i18n.language === 'ar' ? 'ar' : 'en-US';

  const getSourceLabel = (source: string) => String(t(`lawyer.sources.${source}`, { defaultValue: source }));
  const getInfluencerName = (lead: Lead) => {
    if (lead.source_type === 'influencer' && lead.source_id) {
      return influencers.find(i => i.id === lead.source_id)?.full_name || null;
    }
    return null;
  };

  const renderActions = (lead: Lead) => (
    <div className="flex items-center gap-1 flex-wrap">
      {lead.status === 'new' && (
        <>
          <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => markEligible(lead)} disabled={loading}><UserCheck className="h-3 w-3 me-1" />{t('admin.leads.markEligible')}</Button>
          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => markNotEligible(lead.id)} disabled={loading}><UserX className="h-3 w-3 me-1" />{t('admin.leads.markNotEligible')}</Button>
        </>
      )}
      {/* Allow assigning any lead regardless of status */}
      {lead.status !== 'not_eligible' && (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAssignModal({ leadId: lead.id, leadName: lead.full_name })} disabled={loading}>
          <Gavel className="h-3 w-3 me-1" />{t('admin.leads.assignTeamMember')}
        </Button>
      )}
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setOverrideModal(lead); setOverrideScore(String(lead.eligibility_score ?? 0)); setOverrideStatus(lead.status); }}>
        <Edit className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteId(lead.id)}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  return (
    <PullToRefresh onRefresh={async () => { onRefresh(); }} disabled={loading}>
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
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
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-32"><SelectValue placeholder={t('admin.leads.source', 'Source')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.leads.all')}</SelectItem>
              {sourceTypes.map(s => <SelectItem key={s} value={s}>{getSourceLabel(s)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => {
            const hk = t('admin.leads.csvHeaders', { returnObjects: true }) as Record<string, string>;
            const headers = [hk.name, hk.phone, hk.passport, hk.english, hk.math, hk.score, hk.status, hk.source, t('admin.leads.interestedMajor', 'Major'), hk.date];
            const rows = filtered.map(l => [l.full_name, l.phone, l.passport_type || '', l.english_units ?? '', l.math_units ?? '', l.eligibility_score ?? '', l.status, l.source_type, l.preferred_major || '', new Date(l.created_at).toLocaleDateString(locale)]);
            exportPDF({ headers, rows, fileName: `leads-${new Date().toISOString().slice(0,10)}`, title: 'Darb Study International — Leads' });
          }}><FileText className="h-4 w-4 me-1" />PDF</Button>
          <Button onClick={() => setShowAddModal(true)} size="sm"><Plus className="h-4 w-4 me-1" />{t('admin.leads.addLead')}</Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} {t('admin.leads.all').toLowerCase()}</p>

      {/* Desktop Table */}
      {!isMobile ? (
        <Card className="w-full overflow-hidden">
          <div className="w-full overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                 <thead>
                   <tr className="border-b bg-muted/30">
                      <th className="w-[15%] px-4 py-3 text-start font-medium text-muted-foreground">{t('admin.leads.fullName', 'Name')}</th>
                      <th className="w-[13%] px-4 py-3 text-start font-medium text-muted-foreground">{t('admin.leads.phone', 'Phone')}</th>
                      <th className="w-[10%] px-4 py-3 text-start font-medium text-muted-foreground">{t('admin.leads.educationLevel', 'Education')}</th>
                      <th className="w-[13%] px-4 py-3 text-start font-medium text-muted-foreground">{t('admin.leads.interestedMajor', 'Major')}</th>
                      <th className="w-[7%] px-4 py-3 text-center font-medium text-muted-foreground">{t('admin.leads.englishCol', 'Eng')}</th>
                      <th className="w-[7%] px-4 py-3 text-center font-medium text-muted-foreground">{t('admin.leads.mathCol', 'Math')}</th>
                      <th className="w-[7%] px-4 py-3 text-center font-medium text-muted-foreground">{t('admin.leads.score', 'Score')}</th>
                      <th className="w-[10%] px-4 py-3 text-start font-medium text-muted-foreground">{t('admin.leads.source', 'Source')}</th>
                      <th className="w-[8%] px-4 py-3 text-start font-medium text-muted-foreground">{t('admin.leads.status', 'Status')}</th>
                      <th className="w-[10%] px-4 py-3 text-start font-medium text-muted-foreground">{t('admin.students.actions', 'Actions')}</th>
                   </tr>
                 </thead>
                <tbody>
                  {filtered.map(lead => {
                    const variant = STATUS_VARIANTS[lead.status] || STATUS_VARIANTS.new;
                    const statusLabel = String(t(`admin.leads.${lead.status === 'not_eligible' ? 'notEligible' : lead.status}`));
                    const score = lead.eligibility_score ?? 0;
                    const isEligible = score >= 50;
                    const infName = getInfluencerName(lead);
                    return (
                      <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="p-3">
                          <div>
                            <span className="font-medium">{lead.full_name}</span>
                            {lead.ref_code && <span className="block text-[10px] font-mono text-muted-foreground">{lead.ref_code}</span>}
                          </div>
                        </td>
                         <td className="p-3">
                           <a href={`tel:${lead.phone}`} className="text-primary hover:underline flex items-center gap-1">
                             <Phone className="h-3 w-3" />{lead.phone}
                           </a>
                         </td>
                         <td className="p-3 text-muted-foreground text-xs">{lead.education_level || '—'}</td>
                         <td className="p-3 text-muted-foreground">{lead.preferred_major || '—'}</td>
                        <td className="p-3 text-center">{lead.english_units ?? '—'}</td>
                        <td className="p-3 text-center">{lead.math_units ?? '—'}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${isEligible ? 'text-emerald-700' : 'text-red-600'}`}>
                            {isEligible ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {score}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="space-y-0.5">
                            <Badge variant="outline" className="text-[10px]">{getSourceLabel(lead.source_type)}</Badge>
                            {infName && <span className="block text-[10px] text-muted-foreground">{t('admin.leads.via', { name: infName })}</span>}
                          </div>
                        </td>
                        <td className="p-3"><Badge variant={variant}>{statusLabel}</Badge></td>
                        <td className="p-3">{renderActions(lead)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">{t('admin.leads.noLeads')}</p>}
          </div>
        </Card>
      ) : (
        /* Mobile Cards */
        <div className="grid gap-3">
          {filtered.map(lead => {
            const variant = STATUS_VARIANTS[lead.status] || STATUS_VARIANTS.new;
            const statusLabel = String(t(`admin.leads.${lead.status === 'not_eligible' ? 'notEligible' : lead.status}`));
            const score = lead.eligibility_score ?? 0;
            const isEligible = score >= 50;
            const infName = getInfluencerName(lead);
            return (
              <Card key={lead.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base">{lead.full_name}</h3>
                      {lead.ref_code && <span className="text-[10px] font-mono text-muted-foreground">{lead.ref_code}</span>}
                      <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-sm text-primary hover:underline mt-1">
                        <Phone className="h-3.5 w-3.5" />{lead.phone}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <Badge variant={variant}>{statusLabel}</Badge>
                      <Badge variant="outline" className="text-xs">{getSourceLabel(lead.source_type)}</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    {lead.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{lead.city}</span>}
                    {lead.german_level && <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{lead.german_level}</span>}
                    {lead.english_units != null && <span>{t('admin.leads.englishUnits', { count: lead.english_units })}</span>}
                    {lead.math_units != null && <span>{t('admin.leads.mathUnits', { count: lead.math_units })}</span>}
                    {infName && <span className="col-span-2 text-xs">{t('admin.leads.via', { name: infName })}</span>}
                  </div>

                  <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${isEligible ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                    {isEligible ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                    <span>{score} pts</span>
                  </div>

                  {renderActions(lead)}
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">{t('admin.leads.noLeads')}</p>}
        </div>
      )}

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
            <div className="sm:col-span-2"><Label>{t('admin.leads.fullName')} *</Label><Input value={newLead.full_name} onChange={e => setNewLead(p => ({ ...p, full_name: e.target.value }))} /></div>
            <div><Label>{t('admin.leads.phone')} *</Label><Input value={newLead.phone} onChange={e => setNewLead(p => ({ ...p, phone: e.target.value }))} /></div>
            <div><Label>{t('admin.leads.email', 'Email')}</Label><Input type="email" value={newLead.email} onChange={e => setNewLead(p => ({ ...p, email: e.target.value }))} /></div>
            <div><Label>{t('admin.leads.city')}</Label><Input value={newLead.city} onChange={e => setNewLead(p => ({ ...p, city: e.target.value }))} /></div>
            <div><Label>{t('admin.leads.age')}</Label><Input type="number" value={newLead.age} onChange={e => setNewLead(p => ({ ...p, age: e.target.value }))} /></div>
            <div>
              <Label>{t('admin.leads.passportType', 'Passport Type')}</Label>
              <Select value={newLead.passport_type} onValueChange={v => setNewLead(p => ({ ...p, passport_type: v }))}>
                <SelectTrigger><SelectValue placeholder={t('admin.leads.selectPassport', 'Select')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="israeli_blue">{t('admin.leads.israeliBlue', 'Israeli Blue')}</SelectItem>
                  <SelectItem value="israeli_red">{t('admin.leads.israeliRed', 'Israeli Red')}</SelectItem>
                  <SelectItem value="other">{t('admin.leads.otherPassport', 'Other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('admin.leads.educationLevel', 'Education Level')}</Label>
              <Select value={newLead.education_level} onValueChange={v => setNewLead(p => ({ ...p, education_level: v }))}>
                <SelectTrigger><SelectValue placeholder={t('admin.leads.selectEducation', 'Select')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bagrut">{t('admin.leads.bagrut', 'Bagrut')}</SelectItem>
                  <SelectItem value="bachelor">{t('admin.leads.bachelor', 'Bachelor')}</SelectItem>
                  <SelectItem value="master">{t('admin.leads.master', 'Master')}</SelectItem>
                  <SelectItem value="other">{t('admin.leads.otherEducation', 'Other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t('admin.leads.englishCol', 'English Units')}</Label><Input type="number" min="0" max="5" value={newLead.english_units} onChange={e => setNewLead(p => ({ ...p, english_units: e.target.value }))} /></div>
            <div><Label>{t('admin.leads.mathCol', 'Math Units')}</Label><Input type="number" min="0" max="5" value={newLead.math_units} onChange={e => setNewLead(p => ({ ...p, math_units: e.target.value }))} /></div>
            <div>
              <Label>{t('admin.leads.germanLevel')}</Label>
              <Select value={newLead.german_level} onValueChange={v => setNewLead(p => ({ ...p, german_level: v }))}>
                <SelectTrigger><SelectValue placeholder={t('admin.leads.selectGerman', 'Select')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('admin.leads.germanNone', 'None')}</SelectItem>
                  <SelectItem value="beginner">{t('admin.leads.germanBeginner', 'Beginner')}</SelectItem>
                  <SelectItem value="intermediate">{t('admin.leads.germanIntermediate', 'Intermediate')}</SelectItem>
                  <SelectItem value="advanced">{t('admin.leads.germanAdvanced', 'Advanced')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t('admin.leads.preferredCity', 'Preferred City')}</Label><Input value={newLead.preferred_city} onChange={e => setNewLead(p => ({ ...p, preferred_city: e.target.value }))} /></div>
            <div><Label>{t('admin.leads.interestedMajor', 'Preferred Major')}</Label><Input value={newLead.preferred_major} onChange={e => setNewLead(p => ({ ...p, preferred_major: e.target.value }))} placeholder={t('admin.leads.majorPlaceholder', 'e.g. Computer Science')} /></div>
            <div>
              <Label>{t('admin.leads.source', 'Source')}</Label>
              <Select value={newLead.source_type} onValueChange={v => setNewLead(p => ({ ...p, source_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="organic">{t('lawyer.sources.organic', 'Organic')}</SelectItem>
                  <SelectItem value="referral">{t('lawyer.sources.referral', 'Referral')}</SelectItem>
                  <SelectItem value="influencer">{t('lawyer.sources.influencer', 'Influencer')}</SelectItem>
                  <SelectItem value="contact_form">{t('lawyer.sources.contact_form', 'Contact Form')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
          {lawyers.length === 0 && influencers.length === 0 ? (
            <div className="py-6 text-center space-y-2">
              <Users className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('admin.leads.noTeamMembers', { defaultValue: 'No team members found. Add team members first from the Team tab.' })}</p>
            </div>
          ) : (
            <>
              <Select value={selectedLawyer} onValueChange={setSelectedLawyer}>
                <SelectTrigger><SelectValue placeholder={t('admin.leads.selectTeamMember')} /></SelectTrigger>
                <SelectContent>
                  {lawyers.map(l => <SelectItem key={l.id} value={l.id}>{l.full_name} <span className="text-muted-foreground text-xs ms-1">({t('admin.tabs.teamMembers', 'Team')})</span></SelectItem>)}
                  {influencers.map(i => <SelectItem key={i.id} value={i.id}>{i.full_name} <span className="text-muted-foreground text-xs ms-1">({t('admin.tabs.influencers', 'Agent')})</span></SelectItem>)}
                </SelectContent>
              </Select>
              <DialogFooter>
                <Button onClick={assignLawyer} disabled={loading || !selectedLawyer}>{loading ? t('admin.leads.assigning') : t('admin.leads.assign')}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </PullToRefresh>
  );
};

export default LeadsManagement;
