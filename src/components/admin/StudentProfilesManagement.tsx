import React, { useState, useEffect, useMemo } from 'react';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Search, Download, Eye, FileText, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PullToRefresh from '@/components/common/PullToRefresh';

interface StudentProfilesManagementProps {
  students: any[];
  influencers: any[];
  leads: any[];
  onRefresh: () => void;
}

const StudentProfilesManagement: React.FC<StudentProfilesManagementProps> = ({
  students, influencers, leads, onRefresh,
}) => {
  const { t } = useTranslation('dashboard');
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // Reset page on search change
  useEffect(() => { setPage(1); }, [search]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Build a map of influencer id -> name
  const influencerMap = useMemo(() => {
    const map: Record<string, string> = {};
    influencers.forEach(i => { map[i.id] = i.full_name; });
    // Also include all students/profiles in case referrer is a student
    students.forEach(s => { if (!map[s.id]) map[s.id] = s.full_name; });
    return map;
  }, [influencers, students]);

  const getReferrerInfo = (student: any) => {
    // 1. Check influencer_id on profile
    if (student.influencer_id && influencerMap[student.influencer_id]) {
      return { type: 'Agent', name: influencerMap[student.influencer_id] };
    }
    // 2. Check leads table for matching email/phone
    const matchingLead = leads.find(
      (l: any) => l.email === student.email || (student.phone_number && l.phone === student.phone_number)
    );
    if (matchingLead) {
      if (matchingLead.source_type === 'influencer' && matchingLead.source_id) {
        const name = influencerMap[matchingLead.source_id];
        return { type: 'Agent', name: name || matchingLead.source_id.slice(0, 8) };
      }
      if (matchingLead.source_type === 'referral') {
        return { type: 'Referral', name: matchingLead.ref_code || 'Referral' };
      }
      if (matchingLead.source_type === 'contact_form') {
        return { type: 'Contact', name: 'Website Form' };
      }
      return { type: matchingLead.source_type, name: matchingLead.source_type };
    }
    return { type: 'Organic', name: 'Website' };
  };

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    return s.full_name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.phone_number?.includes(q);
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openProfile = async (student: any) => {
    setSelectedStudent(student);
    setLoadingDocs(true);
    const { data } = await (supabase as any).from('documents').select('*').eq('student_id', student.id).order('created_at', { ascending: false });
    setDocuments(data || []);
    setLoadingDocs(false);
  };

  const downloadDoc = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage.from('student-documents').download(doc.file_url);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      // Try as direct URL
      window.open(doc.file_url, '_blank');
    }
  };

  const referrerInfo = (student: any) => {
    const info = getReferrerInfo(student);
    return `${info.type}: ${info.name}`;
  };

  return (
    <PullToRefresh onRefresh={async () => { onRefresh(); }}>
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('admin.leads.searchPlaceholder', 'Search...')} value={search} onChange={e => setSearch(e.target.value)} className="ps-9" />
        </div>
        <Badge variant="secondary">{filtered.length} {t('admin.tabs.students', 'Students')}</Badge>
      </div>

      {isMobile ? (
        <div className="space-y-3">
          {paginated.map(s => {
            const ref = getReferrerInfo(s);
            return (
              <Card key={s.id} className="cursor-pointer" onClick={() => openProfile(s)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{s.full_name}</span>
                    <Badge variant="outline">{s.student_status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.email}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="secondary">{ref.type}: {ref.name}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="w-full overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="w-[18%] px-4 py-3 text-start font-medium text-muted-foreground">{t('team.name', 'Name')}</th>
                  <th className="w-[18%] px-4 py-3 text-start font-medium text-muted-foreground">{t('team.email', 'Email')}</th>
                  <th className="w-[12%] px-4 py-3 text-start font-medium text-muted-foreground">{t('admin.leads.phone', 'Phone')}</th>
                  <th className="w-[10%] px-4 py-3 text-start font-medium text-muted-foreground">{t('admin.leads.city', 'City')}</th>
                  <th className="w-[10%] px-4 py-3 text-start font-medium text-muted-foreground">{t('team.status', 'Status')}</th>
                  <th className="w-[18%] px-4 py-3 text-start font-medium text-muted-foreground">{t('admin.leads.source', 'Referred By')}</th>
                  <th className="w-[14%] px-4 py-3 text-start font-medium text-muted-foreground">{t('team.action', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(s => {
                  const ref = getReferrerInfo(s);
                  return (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{s.full_name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs break-all">{s.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.phone_number || '—'}</td>
                      <td className="px-4 py-3">{s.city || '—'}</td>
                      <td className="px-4 py-3"><Badge variant="outline">{s.student_status}</Badge></td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs">{ref.type}: {ref.name}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openProfile(s)}>
                          <Eye className="h-3 w-3 me-1" />{t('admin.leads.view', 'View')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('team.noMembers', 'No students found')}</p>}
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious onClick={() => setPage(p => Math.max(1, p - 1))} aria-disabled={page === 1} className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
            </PaginationItem>
            <PaginationItem>
              <span className="px-4 py-2 text-sm text-muted-foreground">{page} / {totalPages}</span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext onClick={() => setPage(p => Math.min(totalPages, p + 1))} aria-disabled={page === totalPages} className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Student Detail Modal */}
      <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedStudent?.full_name}
            </DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-4">
              {/* Personal Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">{t('team.email', 'Email')}</p>
                  <p className="font-medium">{selectedStudent.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t('admin.leads.phone', 'Phone')}</p>
                  <p className="font-medium">{selectedStudent.phone_number || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t('admin.leads.city', 'City')}</p>
                  <p className="font-medium">{selectedStudent.city || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t('team.status', 'Status')}</p>
                  <Badge variant="outline">{selectedStudent.student_status}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t('admin.leads.source', 'Referred By')}</p>
                  <Badge variant="secondary">{referrerInfo(selectedStudent)}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t('admin.leads.date', 'Registered')}</p>
                  <p className="font-medium">{new Date(selectedStudent.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Legal / Visa Section */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-sm mb-3">{t('profile.legalSection', 'Legal / Visa Information')}</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">{t('profile.gender', 'Gender')}</p>
                    <p className="font-medium">{selectedStudent.gender || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t('profile.eyeColor', 'Eye Color')}</p>
                    <p className="font-medium">{selectedStudent.eye_color || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t('profile.hasChangedLegalName', 'Changed Legal Name')}</p>
                    <p className="font-medium">{selectedStudent.has_changed_legal_name ? `Yes — ${selectedStudent.previous_legal_name || ''}` : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t('profile.hasCriminalRecord', 'Criminal Record')}</p>
                    <p className="font-medium">{selectedStudent.has_criminal_record ? `Yes — ${selectedStudent.criminal_record_details || ''}` : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t('profile.hasDualCitizenship', 'Dual Citizenship')}</p>
                    <p className="font-medium">{selectedStudent.has_dual_citizenship ? `Yes — ${selectedStudent.second_passport_country || ''}` : 'No'}</p>
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {t('dashboard.documents', 'Documents')} ({documents.length})
                </h3>
                {loadingDocs ? (
                  <div className="flex justify-center py-4">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{t('dashboard.noDocuments', 'No documents uploaded yet')}</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground">{doc.category} • {new Date(doc.created_at).toLocaleDateString()}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => downloadDoc(doc)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </PullToRefresh>
  );
};

export default StudentProfilesManagement;
