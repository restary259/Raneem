
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Phone, MapPin, GraduationCap, DollarSign, Plus, Search, UserCheck, UserX, Gavel } from 'lucide-react';

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
  status: string;
  created_at: string;
}

interface LeadsManagementProps {
  leads: Lead[];
  lawyers: { id: string; full_name: string }[];
  onRefresh: () => void;
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  new: { label: 'جديد', variant: 'default' },
  eligible: { label: 'مؤهل', variant: 'secondary' },
  not_eligible: { label: 'غير مؤهل', variant: 'destructive' },
  assigned: { label: 'معيّن', variant: 'outline' },
};

const SOURCE_MAP: Record<string, string> = {
  influencer: 'وكيل',
  referral: 'إحالة',
  organic: 'عضوي',
};

const LeadsManagement: React.FC<LeadsManagementProps> = ({ leads, lawyers, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [assignModal, setAssignModal] = useState<{ leadId: string; leadName: string } | null>(null);
  const [selectedLawyer, setSelectedLawyer] = useState('');
  const [newLead, setNewLead] = useState({ full_name: '', phone: '', city: '', age: '', education_level: '', german_level: '', budget_range: '', preferred_city: '', accommodation: false, source_type: 'organic', eligibility_score: '' });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const filtered = leads.filter(l => {
    const matchSearch = l.full_name.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search);
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleAddLead = async () => {
    if (!newLead.full_name || !newLead.phone) { toast({ variant: 'destructive', title: 'خطأ', description: 'الاسم ورقم الهاتف مطلوبان' }); return; }
    setLoading(true);
    const { error } = await (supabase as any).from('leads').insert({
      full_name: newLead.full_name,
      phone: newLead.phone,
      city: newLead.city || null,
      age: newLead.age ? parseInt(newLead.age) : null,
      education_level: newLead.education_level || null,
      german_level: newLead.german_level || null,
      budget_range: newLead.budget_range || null,
      preferred_city: newLead.preferred_city || null,
      accommodation: newLead.accommodation,
      source_type: newLead.source_type,
      eligibility_score: newLead.eligibility_score ? parseInt(newLead.eligibility_score) : null,
    });
    setLoading(false);
    if (error) { toast({ variant: 'destructive', title: 'خطأ', description: error.message }); return; }
    toast({ title: 'تمت الإضافة', description: 'تم إضافة العميل المحتمل بنجاح' });
    setShowAddModal(false);
    setNewLead({ full_name: '', phone: '', city: '', age: '', education_level: '', german_level: '', budget_range: '', preferred_city: '', accommodation: false, source_type: 'organic', eligibility_score: '' });
    onRefresh();
  };

  const markEligible = async (lead: Lead) => {
    setLoading(true);
    const { error: updateErr } = await (supabase as any).from('leads').update({ status: 'eligible' }).eq('id', lead.id);
    if (updateErr) { toast({ variant: 'destructive', title: 'خطأ', description: updateErr.message }); setLoading(false); return; }
    // Auto-create student case
    const { error: caseErr } = await (supabase as any).from('student_cases').insert({
      lead_id: lead.id,
      selected_city: lead.preferred_city,
      accommodation_status: lead.accommodation ? 'needed' : 'not_needed',
    });
    if (caseErr) { toast({ variant: 'destructive', title: 'خطأ في إنشاء الملف', description: caseErr.message }); }
    setLoading(false);
    toast({ title: 'تم التحديث', description: `${lead.full_name} تم تأهيله وإنشاء ملف الطالب` });
    onRefresh();
  };

  const markNotEligible = async (leadId: string) => {
    const { error } = await (supabase as any).from('leads').update({ status: 'not_eligible' }).eq('id', leadId);
    if (error) { toast({ variant: 'destructive', title: 'خطأ', description: error.message }); return; }
    toast({ title: 'تم التحديث' });
    onRefresh();
  };

  const assignLawyer = async () => {
    if (!assignModal || !selectedLawyer) return;
    setLoading(true);
    // Update the lead status
    await (supabase as any).from('leads').update({ status: 'assigned' }).eq('id', assignModal.leadId);
    // Find the case for this lead and assign lawyer
    const { data: cases } = await (supabase as any).from('student_cases').select('id').eq('lead_id', assignModal.leadId).limit(1);
    if (cases?.[0]) {
      await (supabase as any).from('student_cases').update({ assigned_lawyer_id: selectedLawyer }).eq('id', cases[0].id);
    }
    setLoading(false);
    toast({ title: 'تم التعيين', description: `تم تعيين محامي للعميل ${assignModal.leadName}` });
    setAssignModal(null);
    setSelectedLawyer('');
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو الهاتف..." value={search} onChange={e => setSearch(e.target.value)} className="ps-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="new">جديد</SelectItem>
              <SelectItem value="eligible">مؤهل</SelectItem>
              <SelectItem value="not_eligible">غير مؤهل</SelectItem>
              <SelectItem value="assigned">معيّن</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowAddModal(true)} size="sm"><Plus className="h-4 w-4 me-1" />إضافة عميل</Button>
      </div>

      {/* Lead Cards */}
      <div className="grid gap-3">
        {filtered.map(lead => {
          const st = STATUS_MAP[lead.status] || STATUS_MAP.new;
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
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={st.variant}>{st.label}</Badge>
                    <Badge variant="outline" className="text-xs">{SOURCE_MAP[lead.source_type] || lead.source_type}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  {lead.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{lead.city}</span>}
                  {lead.german_level && <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{lead.german_level}</span>}
                  {lead.budget_range && <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{lead.budget_range}</span>}
                  {lead.eligibility_score != null && <span>نقاط: {lead.eligibility_score}</span>}
                </div>

                {lead.status === 'new' && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="default" onClick={() => markEligible(lead)} disabled={loading}>
                      <UserCheck className="h-3.5 w-3.5 me-1" />مؤهل
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => markNotEligible(lead.id)} disabled={loading}>
                      <UserX className="h-3.5 w-3.5 me-1" />غير مؤهل
                    </Button>
                  </div>
                )}
                {lead.status === 'eligible' && (
                  <Button size="sm" variant="outline" onClick={() => setAssignModal({ leadId: lead.id, leadName: lead.full_name })} disabled={loading}>
                    <Gavel className="h-3.5 w-3.5 me-1" />تعيين محامي
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">لا يوجد عملاء محتملين</p>}
      </div>

      {/* Add Lead Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>إضافة عميل محتمل</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>الاسم الكامل *</Label><Input value={newLead.full_name} onChange={e => setNewLead(p => ({ ...p, full_name: e.target.value }))} /></div>
            <div><Label>الهاتف *</Label><Input value={newLead.phone} onChange={e => setNewLead(p => ({ ...p, phone: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>المدينة</Label><Input value={newLead.city} onChange={e => setNewLead(p => ({ ...p, city: e.target.value }))} /></div>
              <div><Label>العمر</Label><Input type="number" value={newLead.age} onChange={e => setNewLead(p => ({ ...p, age: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>مستوى الألمانية</Label><Input value={newLead.german_level} onChange={e => setNewLead(p => ({ ...p, german_level: e.target.value }))} /></div>
              <div><Label>الميزانية</Label><Input value={newLead.budget_range} onChange={e => setNewLead(p => ({ ...p, budget_range: e.target.value }))} /></div>
            </div>
            <div><Label>المدينة المفضلة</Label><Input value={newLead.preferred_city} onChange={e => setNewLead(p => ({ ...p, preferred_city: e.target.value }))} /></div>
            <div><Label>نقاط الأهلية</Label><Input type="number" value={newLead.eligibility_score} onChange={e => setNewLead(p => ({ ...p, eligibility_score: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddLead} disabled={loading}>{loading ? 'جاري...' : 'إضافة'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Lawyer Modal */}
      <Dialog open={!!assignModal} onOpenChange={() => setAssignModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>تعيين محامي - {assignModal?.leadName}</DialogTitle></DialogHeader>
          <Select value={selectedLawyer} onValueChange={setSelectedLawyer}>
            <SelectTrigger><SelectValue placeholder="اختر محامي" /></SelectTrigger>
            <SelectContent>
              {lawyers.map(l => <SelectItem key={l.id} value={l.id}>{l.full_name}</SelectItem>)}
              {lawyers.length === 0 && <SelectItem value="none" disabled>لا يوجد محامين</SelectItem>}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button onClick={assignLawyer} disabled={loading || !selectedLawyer}>{loading ? 'جاري...' : 'تعيين'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadsManagement;
