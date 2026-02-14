import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Search, Download, Edit2, Check, X, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Student { id: string; created_at: string; full_name: string; email: string; student_status: string; influencer_id: string | null; }
interface Influencer { id: string; full_name: string; }
interface ChecklistItem { id: string; item_name: string; }
interface StudentChecklist { id: string; student_id: string; checklist_item_id: string; is_completed: boolean; }

interface StudentManagementProps {
  students: Student[];
  influencers: Influencer[];
  checklistItems: ChecklistItem[];
  studentChecklists: StudentChecklist[];
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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');
  const isMobile = useIsMobile();

  const statusKeys = ['eligible', 'ineligible', 'converted', 'paid', 'nurtured'];

  const getChecklistProgress = (studentId: string) => {
    const total = checklistItems.length;
    if (!total) return 0;
    return Math.round((studentChecklists.filter(sc => sc.student_id === studentId && sc.is_completed).length / total) * 100);
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
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); }
    else { toast({ title: t('admin.students.updateSuccess') }); setEditingId(null); onRefresh(); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await (supabase as any).from('profiles').delete().eq('id', deleteId);
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); }
    else { toast({ title: t('admin.shared.deleted') }); onRefresh(); }
    setDeleteId(null);
  };

  const startEdit = (s: any) => { setEditingId(s.id); setEditStatus(s.student_status || 'eligible'); setEditInfluencer(s.influencer_id || 'none'); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="ps-10" placeholder={t('admin.students.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t('admin.students.statusFilter')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.students.all')}</SelectItem>
            {statusKeys.map(k => <SelectItem key={k} value={k}>{String(t(`admin.students.statuses.${k}`, { defaultValue: k }))}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => downloadCSV(filteredStudents, 'students.csv')}>
          <Download className="h-4 w-4 me-2" />{t('admin.students.exportCSV')}
        </Button>
      </div>

      {isMobile ? (
        <div className="space-y-3">
          {filteredStudents.map((s: any) => {
            const progress = getChecklistProgress(s.id);
            const isEditing = editingId === s.id;
            const assignedInfluencer = influencers.find(i => i.id === s.influencer_id);
            return (
              <Card key={s.id} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm break-all">{s.full_name}</span>
                    <Badge variant="secondary">{String(t(`admin.students.statuses.${s.student_status}`, { defaultValue: s.student_status }))}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground break-all">{s.email}</p>
                  <div className="flex items-center gap-2">
                    <Progress value={progress} className="h-2 flex-1" />
                    <span className="text-xs text-muted-foreground">{progress}%</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{assignedInfluencer?.full_name || '—'}</span>
                    <span>{s.created_at?.split('T')[0]}</span>
                  </div>
                  {isEditing ? (
                    <div className="space-y-2 pt-2 border-t">
                      <Select value={editStatus} onValueChange={setEditStatus}>
                        <SelectTrigger className="w-full h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>{statusKeys.map(k => <SelectItem key={k} value={k}>{String(t(`admin.students.statuses.${k}`, { defaultValue: k }))}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={editInfluencer} onValueChange={setEditInfluencer}>
                        <SelectTrigger className="w-full h-10"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="none">{t('admin.students.none')}</SelectItem>{influencers.map(i => <SelectItem key={i.id} value={i.id}>{i.full_name}</SelectItem>)}</SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSave(s.id)}><Check className="h-4 w-4 me-1" />{t('admin.students.updateSuccess', 'حفظ')}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-2 border-t">
                      <Button size="sm" variant="outline" onClick={() => startEdit(s)}><Edit2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(s.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {filteredStudents.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('admin.students.noStudents')}</p>}
        </div>
      ) : (
        <div className="bg-background rounded-xl border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-start font-semibold">{t('admin.students.name')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('admin.students.email')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('admin.students.status')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('admin.students.progress')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('admin.students.agent')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('admin.students.registration')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('admin.students.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s: any) => {
                const progress = getChecklistProgress(s.id);
                const isEditing = editingId === s.id;
                const assignedInfluencer = influencers.find(i => i.id === s.influencer_id);
                return (
                  <tr key={s.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{s.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground break-all">{s.email}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <Select value={editStatus} onValueChange={setEditStatus}>
                          <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>{statusKeys.map(k => <SelectItem key={k} value={k}>{String(t(`admin.students.statuses.${k}`, { defaultValue: k }))}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">{String(t(`admin.students.statuses.${s.student_status}`, { defaultValue: s.student_status }))}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><Progress value={progress} className="h-2 w-20" /><span className="text-xs text-muted-foreground">{progress}%</span></div></td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <Select value={editInfluencer} onValueChange={setEditInfluencer}>
                          <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="none">{t('admin.students.none')}</SelectItem>{influencers.map(i => <SelectItem key={i.id} value={i.id}>{i.full_name}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (<span className="text-muted-foreground text-xs">{assignedInfluencer?.full_name || '—'}</span>)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{s.created_at?.split('T')[0]}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleSave(s.id)}><Check className="h-4 w-4 text-green-600" /></Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingId(null)}><X className="h-4 w-4 text-red-600" /></Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => startEdit(s)}><Edit2 className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteId(s.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredStudents.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('admin.students.noStudents')}</p>}
        </div>
      )}

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
    </div>
  );
};

export default StudentManagement;