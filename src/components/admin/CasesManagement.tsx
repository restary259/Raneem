
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, DollarSign, Save } from 'lucide-react';

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
  created_at: string;
  updated_at: string;
}

interface CasesManagementProps {
  cases: StudentCase[];
  leads: { id: string; full_name: string; phone: string }[];
  lawyers: { id: string; full_name: string }[];
  onRefresh: () => void;
}

const CASE_STATUSES = [
  { value: 'assigned', label: 'معيّن' },
  { value: 'contacted', label: 'تم التواصل' },
  { value: 'appointment', label: 'موعد' },
  { value: 'closed', label: 'مغلق' },
  { value: 'paid', label: 'مدفوع' },
  { value: 'registration_submitted', label: 'تم تقديم التسجيل' },
  { value: 'visa_stage', label: 'مرحلة الفيزا' },
  { value: 'completed', label: 'مكتمل' },
];

const STATUS_COLORS: Record<string, string> = {
  assigned: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  appointment: 'bg-purple-100 text-purple-800',
  closed: 'bg-gray-100 text-gray-800',
  paid: 'bg-green-100 text-green-800',
  registration_submitted: 'bg-indigo-100 text-indigo-800',
  visa_stage: 'bg-orange-100 text-orange-800',
  completed: 'bg-emerald-100 text-emerald-800',
};

const CasesManagement: React.FC<CasesManagementProps> = ({ cases, leads, lawyers, onRefresh }) => {
  const [editingCase, setEditingCase] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getLeadName = (leadId: string) => leads.find(l => l.id === leadId)?.full_name || 'غير معروف';
  const getLawyerName = (lawyerId: string | null) => lawyerId ? lawyers.find(l => l.id === lawyerId)?.full_name || 'غير معيّن' : 'غير معيّن';

  const startEdit = (c: StudentCase) => {
    setEditingCase(c.id);
    setEditValues({
      service_fee: c.service_fee,
      influencer_commission: c.influencer_commission,
      lawyer_commission: c.lawyer_commission,
      referral_discount: c.referral_discount,
      school_commission: c.school_commission,
      translation_fee: c.translation_fee,
      selected_city: c.selected_city || '',
      selected_school: c.selected_school || '',
      case_status: c.case_status,
      notes: c.notes || '',
    });
  };

  const saveCase = async (caseId: string) => {
    setLoading(true);
    const { error } = await (supabase as any).from('student_cases').update({
      service_fee: Number(editValues.service_fee) || 0,
      influencer_commission: Number(editValues.influencer_commission) || 0,
      lawyer_commission: Number(editValues.lawyer_commission) || 0,
      referral_discount: Number(editValues.referral_discount) || 0,
      school_commission: Number(editValues.school_commission) || 0,
      translation_fee: Number(editValues.translation_fee) || 0,
      selected_city: editValues.selected_city || null,
      selected_school: editValues.selected_school || null,
      case_status: editValues.case_status,
      notes: editValues.notes || null,
    }).eq('id', caseId);

    if (error) { toast({ variant: 'destructive', title: 'خطأ', description: error.message }); setLoading(false); return; }

    // If status is paid, create commission record
    const originalCase = cases.find(c => c.id === caseId);
    if (editValues.case_status === 'paid' && originalCase?.case_status !== 'paid') {
      await (supabase as any).from('commissions').insert({
        case_id: caseId,
        influencer_amount: Number(editValues.influencer_commission) || 0,
        lawyer_amount: Number(editValues.lawyer_commission) || 0,
        status: 'approved',
      });
      toast({ title: 'تم إنشاء العمولات', description: 'تم إنشاء سجل العمولات تلقائياً' });
    }

    setLoading(false);
    setEditingCase(null);
    toast({ title: 'تم الحفظ' });
    onRefresh();
  };

  const getNetProfit = (c: StudentCase) => {
    return c.service_fee + c.school_commission - c.influencer_commission - c.lawyer_commission - c.referral_discount - c.translation_fee;
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{cases.length} ملف طالب</p>

      {cases.map(c => {
        const isEditing = editingCase === c.id;
        const statusLabel = CASE_STATUSES.find(s => s.value === c.case_status)?.label || c.case_status;
        const statusColor = STATUS_COLORS[c.case_status] || 'bg-gray-100 text-gray-800';

        return (
          <Collapsible key={c.id}>
            <Card className="shadow-sm">
              <CollapsibleTrigger asChild>
                <CardContent className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="font-bold text-sm">{getLeadName(c.lead_id)}</h3>
                      <p className="text-xs text-muted-foreground">محامي: {getLawyerName(c.assigned_lawyer_id)}</p>
                      {c.selected_city && <p className="text-xs text-muted-foreground">{c.selected_city} {c.selected_school ? `• ${c.selected_school}` : ''}</p>}
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
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between p-2 bg-muted/30 rounded"><span>رسوم الخدمة</span><span className="font-semibold">{c.service_fee} €</span></div>
                        <div className="flex justify-between p-2 bg-muted/30 rounded"><span>عمولة الوكيل</span><span className="font-semibold">{c.influencer_commission} €</span></div>
                        <div className="flex justify-between p-2 bg-muted/30 rounded"><span>عمولة المحامي</span><span className="font-semibold">{c.lawyer_commission} €</span></div>
                        <div className="flex justify-between p-2 bg-muted/30 rounded"><span>خصم الإحالة</span><span className="font-semibold">{c.referral_discount} €</span></div>
                        <div className="flex justify-between p-2 bg-muted/30 rounded"><span>عمولة المدرسة</span><span className="font-semibold">{c.school_commission} €</span></div>
                        <div className="flex justify-between p-2 bg-muted/30 rounded"><span>رسوم الترجمة</span><span className="font-semibold">{c.translation_fee} €</span></div>
                      </div>
                      <div className="flex justify-between p-3 bg-primary/10 rounded-lg font-bold">
                        <span className="flex items-center gap-1"><DollarSign className="h-4 w-4" />صافي الربح</span>
                        <span className={getNetProfit(c) >= 0 ? 'text-emerald-700' : 'text-red-600'}>{getNetProfit(c)} €</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => startEdit(c)}>تعديل</Button>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs">المدينة</Label><Input value={editValues.selected_city} onChange={e => setEditValues(v => ({ ...v, selected_city: e.target.value }))} /></div>
                        <div><Label className="text-xs">المدرسة</Label><Input value={editValues.selected_school} onChange={e => setEditValues(v => ({ ...v, selected_school: e.target.value }))} /></div>
                      </div>
                      <div><Label className="text-xs">حالة الملف</Label>
                        <Select value={editValues.case_status} onValueChange={v => setEditValues(ev => ({ ...ev, case_status: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{CASE_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {(['service_fee', 'influencer_commission', 'lawyer_commission', 'referral_discount', 'school_commission', 'translation_fee'] as const).map(field => (
                          <div key={field}>
                            <Label className="text-xs">{{ service_fee: 'رسوم الخدمة', influencer_commission: 'عمولة الوكيل', lawyer_commission: 'عمولة المحامي', referral_discount: 'خصم الإحالة', school_commission: 'عمولة المدرسة', translation_fee: 'رسوم الترجمة' }[field]}</Label>
                            <Input type="number" value={editValues[field]} onChange={e => setEditValues(v => ({ ...v, [field]: e.target.value }))} />
                          </div>
                        ))}
                      </div>
                      <div><Label className="text-xs">ملاحظات</Label><Input value={editValues.notes} onChange={e => setEditValues(v => ({ ...v, notes: e.target.value }))} /></div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveCase(c.id)} disabled={loading}><Save className="h-3.5 w-3.5 me-1" />{loading ? 'جاري...' : 'حفظ'}</Button>
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
      {cases.length === 0 && <p className="text-center text-muted-foreground py-8">لا يوجد ملفات طلاب بعد</p>}
    </div>
  );
};

export default CasesManagement;
