import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Search, Download, Edit2, Check, X } from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  eligible: { label: 'مؤهل', color: 'bg-emerald-100 text-emerald-800' },
  ineligible: { label: 'غير مؤهل', color: 'bg-red-100 text-red-800' },
  converted: { label: 'محوّل', color: 'bg-blue-100 text-blue-800' },
  paid: { label: 'مدفوع', color: 'bg-green-100 text-green-800' },
  nurtured: { label: 'متابَع', color: 'bg-purple-100 text-purple-800' },
};

interface StudentManagementProps {
  students: any[];
  influencers: any[];
  checklistItems: any[];
  studentChecklists: any[];
  onRefresh: () => void;
}

const downloadCSV = (rows: any[], fileName = "export.csv") => {
  if (!rows.length) return;
  const header = Object.keys(rows[0]);
  const csv = [header.join(","), ...rows.map(row => header.map(f => `"${String(row[f] ?? "").replace(/"/g, '""')}"`).join(","))].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = fileName; a.click();
  window.URL.revokeObjectURL(url);
};

const StudentManagement: React.FC<StudentManagementProps> = ({ students, influencers, checklistItems, studentChecklists, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editInfluencer, setEditInfluencer] = useState('');
  const { toast } = useToast();

  const getChecklistProgress = (studentId: string) => {
    const total = checklistItems.length;
    if (!total) return 0;
    const completed = studentChecklists.filter(sc => sc.student_id === studentId && sc.is_completed).length;
    return Math.round((completed / total) * 100);
  };

  const filteredStudents = students.filter(s => {
    const matchSearch = !search || s.full_name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.student_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleSave = async (studentId: string) => {
    const updates: any = {};
    if (editStatus) updates.student_status = editStatus;
    if (editInfluencer) updates.influencer_id = editInfluencer === 'none' ? null : editInfluencer;

    const { error } = await (supabase as any).from('profiles').update(updates).eq('id', studentId);
    if (error) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    } else {
      toast({ title: 'تم التحديث بنجاح' });
      setEditingId(null);
      onRefresh();
    }
  };

  const startEdit = (s: any) => {
    setEditingId(s.id);
    setEditStatus(s.student_status || 'eligible');
    setEditInfluencer(s.influencer_id || 'none');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="ps-10" placeholder="بحث بالاسم أو البريد..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => downloadCSV(filteredStudents, 'students.csv')}>
          <Download className="h-4 w-4 me-2" />تصدير CSV
        </Button>
      </div>

      <div className="bg-background rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-start font-semibold">الاسم</th>
              <th className="px-4 py-3 text-start font-semibold">البريد</th>
              <th className="px-4 py-3 text-start font-semibold">الحالة</th>
              <th className="px-4 py-3 text-start font-semibold">التقدم</th>
              <th className="px-4 py-3 text-start font-semibold">الوكيل</th>
              <th className="px-4 py-3 text-start font-semibold">التسجيل</th>
              <th className="px-4 py-3 text-start font-semibold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((s: any) => {
              const progress = getChecklistProgress(s.id);
              const isEditing = editingId === s.id;
              const statusInfo = STATUS_LABELS[s.student_status] || STATUS_LABELS.eligible;
              const assignedInfluencer = influencers.find(i => i.id === s.influencer_id);

              return (
                <tr key={s.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{s.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <Select value={editStatus} onValueChange={setEditStatus}>
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Progress value={progress} className="h-2 w-20" />
                      <span className="text-xs text-muted-foreground">{progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <Select value={editInfluencer} onValueChange={setEditInfluencer}>
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">بدون</SelectItem>
                          {influencers.map(i => <SelectItem key={i.id} value={i.id}>{i.full_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-muted-foreground text-xs">{assignedInfluencer?.full_name || '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{s.created_at?.split('T')[0]}</td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleSave(s.id)}><Check className="h-4 w-4 text-green-600" /></Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingId(null)}><X className="h-4 w-4 text-red-600" /></Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => startEdit(s)}><Edit2 className="h-4 w-4" /></Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredStudents.length === 0 && <p className="p-8 text-center text-muted-foreground">لا يوجد طلاب</p>}
      </div>
    </div>
  );
};

export default StudentManagement;
