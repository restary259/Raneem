
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useDirection } from '@/hooks/useDirection';
import { User } from '@supabase/supabase-js';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Phone, ChevronDown, LogOut, ArrowLeftCircle, Save, Briefcase } from 'lucide-react';

const CASE_STATUSES = [
  { value: 'assigned', label: 'معيّن' },
  { value: 'contacted', label: 'تم التواصل' },
  { value: 'appointment', label: 'موعد' },
  { value: 'closed', label: 'مغلق' },
  { value: 'lost', label: 'خسارة' },
  { value: 'paid', label: 'مدفوع' },
];

const STATUS_COLORS: Record<string, string> = {
  assigned: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  appointment: 'bg-purple-100 text-purple-800',
  closed: 'bg-gray-100 text-gray-800',
  lost: 'bg-red-100 text-red-800',
  paid: 'bg-green-100 text-green-800',
};

const LawyerDashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCase, setEditingCase] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { dir } = useDirection();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate('/student-auth'); return; }
      setUser(session.user);

      const { data: roles } = await (supabase as any)
        .from('user_roles').select('role').eq('user_id', session.user.id).eq('role', 'lawyer');
      if (!roles?.length) {
        toast({ variant: 'destructive', title: 'غير مصرح', description: 'هذه الصفحة للمحامين فقط.' });
        navigate('/'); return;
      }

      const { data: prof } = await (supabase as any).from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (prof) setProfile(prof);

      await fetchCases(session.user.id);
      setIsLoading(false);
    };
    init();
  }, [navigate, toast]);

  const fetchCases = async (userId: string) => {
    const { data: casesData } = await (supabase as any)
      .from('student_cases').select('*').eq('assigned_lawyer_id', userId).order('created_at', { ascending: false });
    if (casesData) {
      setCases(casesData);
      // Fetch lead names for these cases
      const leadIds = [...new Set(casesData.map((c: any) => c.lead_id))];
      if (leadIds.length > 0) {
        const { data: leadsData } = await (supabase as any).from('leads').select('id, full_name, phone').in('id', leadIds);
        if (leadsData) setLeads(leadsData);
      }
    }
  };

  const getLeadInfo = (leadId: string) => leads.find(l => l.id === leadId) || { full_name: 'غير معروف', phone: '' };

  const startEdit = (c: any) => {
    setEditingCase(c.id);
    setEditValues({ case_status: c.case_status, notes: c.notes || '', selected_city: c.selected_city || '', selected_school: c.selected_school || '' });
  };

  const saveCase = async (caseId: string) => {
    setSaving(true);
    const prevCase = cases.find(c => c.id === caseId);
    const { error } = await (supabase as any).from('student_cases').update({
      case_status: editValues.case_status,
      notes: editValues.notes || null,
      selected_city: editValues.selected_city || null,
      selected_school: editValues.selected_school || null,
    }).eq('id', caseId);

    if (error) { toast({ variant: 'destructive', title: 'خطأ', description: error.message }); setSaving(false); return; }

    // If marked as paid, log for admin notification
    if (editValues.case_status === 'paid' && prevCase?.case_status !== 'paid') {
      toast({ title: 'تنبيه', description: 'تم إرسال إشعار للإدارة لتأكيد الدفع. لن يتم تفعيل العمولات حتى التأكيد.' });
    }

    setSaving(false);
    setEditingCase(null);
    toast({ title: 'تم الحفظ' });
    if (user) await fetchCases(user.id);
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate('/'); };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]" dir={dir}>
      <header className="bg-[#1E293B] text-white">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png" alt="Darb" className="w-9 h-9 object-contain" />
              <div>
                <h1 className="text-lg font-bold">لوحة المحامي</h1>
                <p className="text-xs text-white/70">{profile?.full_name || user?.email}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => navigate('/')}>
                <ArrowLeftCircle className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">إجمالي</p>
            <p className="text-xl font-bold">{cases.length}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">مغلق</p>
            <p className="text-xl font-bold text-emerald-600">{cases.filter(c => ['paid', 'closed'].includes(c.case_status)).length}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">قيد العمل</p>
            <p className="text-xl font-bold text-blue-600">{cases.filter(c => ['assigned', 'contacted', 'appointment'].includes(c.case_status)).length}</p>
          </CardContent></Card>
        </div>

        {/* Cases */}
        <h2 className="font-bold text-base flex items-center gap-2"><Briefcase className="h-4 w-4" />الملفات المعينة</h2>
        {cases.map(c => {
          const lead = getLeadInfo(c.lead_id);
          const isEditing = editingCase === c.id;
          const statusLabel = CASE_STATUSES.find(s => s.value === c.case_status)?.label || c.case_status;
          const statusColor = STATUS_COLORS[c.case_status] || 'bg-gray-100 text-gray-800';

          return (
            <Collapsible key={c.id}>
              <Card className="shadow-sm">
                <CollapsibleTrigger asChild>
                  <CardContent className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-sm">{lead.full_name}</h3>
                        {lead.phone && (
                          <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-xs text-primary hover:underline mt-0.5" onClick={e => e.stopPropagation()}>
                            <Phone className="h-3 w-3" />{lead.phone}
                          </a>
                        )}
                        {c.selected_city && <p className="text-xs text-muted-foreground mt-0.5">{c.selected_city} {c.selected_school ? `• ${c.selected_school}` : ''}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 border-t pt-3 space-y-3">
                    {!isEditing ? (
                      <>
                        {c.notes && <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded">{c.notes}</p>}
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="p-2 bg-muted/30 rounded"><span className="text-xs text-muted-foreground">رسوم الخدمة</span><p className="font-semibold">{c.service_fee} €</p></div>
                          <div className="p-2 bg-muted/30 rounded"><span className="text-xs text-muted-foreground">عمولتك</span><p className="font-semibold">{c.lawyer_commission} €</p></div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => startEdit(c)}>تعديل الحالة</Button>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div><Label className="text-xs">حالة الملف</Label>
                          <Select value={editValues.case_status} onValueChange={v => setEditValues(ev => ({ ...ev, case_status: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{CASE_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><Label className="text-xs">المدينة</Label><Input value={editValues.selected_city} onChange={e => setEditValues(v => ({ ...v, selected_city: e.target.value }))} /></div>
                          <div><Label className="text-xs">المدرسة</Label><Input value={editValues.selected_school} onChange={e => setEditValues(v => ({ ...v, selected_school: e.target.value }))} /></div>
                        </div>
                        <div><Label className="text-xs">ملاحظات</Label><Textarea value={editValues.notes} onChange={e => setEditValues(v => ({ ...v, notes: e.target.value }))} rows={2} /></div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveCase(c.id)} disabled={saving}><Save className="h-3.5 w-3.5 me-1" />{saving ? 'جاري...' : 'حفظ'}</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingCase(null)}>إلغاء</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
        {cases.length === 0 && <p className="text-center text-muted-foreground py-8">لا يوجد ملفات معينة لك حالياً</p>}
      </main>
    </div>
  );
};

export default LawyerDashboardPage;
