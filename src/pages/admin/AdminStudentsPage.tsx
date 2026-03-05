import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  RefreshCw, Search, User, Mail, Phone, GraduationCap,
  FileText, ExternalLink, KeyRound, Copy, Check, Eye, EyeOff,
  Shield, Clock, Loader2
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface StudentRecord {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  created_at: string;
  city: string | null;
  must_change_password: boolean;
}

interface Document {
  id: string;
  file_name: string;
  file_url: string;
  category: string;
  created_at: string;
  file_type: string | null;
  file_size: number | null;
}

export default function AdminStudentsPage() {
  const { toast } = useToast();
  const { i18n } = useTranslation('dashboard');
  const isRtl = i18n.language === 'ar';

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Detail sheet
  const [selected, setSelected] = useState<StudentRecord | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // Reset password
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetCreds, setResetCreds] = useState<{ email: string; password: string } | null>(null);
  const [showResetPw, setShowResetPw] = useState(false);
  const [copiedReset, setCopiedReset] = useState(false);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');
      if (roleError) throw roleError;

      const userIds = (roleData || []).map(r => r.user_id);
      if (userIds.length === 0) { setStudents([]); return; }

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone_number, created_at, city, must_change_password')
        .in('id', userIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStudents((profileData as StudentRecord[]) ?? []);
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const openStudent = async (s: StudentRecord) => {
    setSelected(s);
    setDocs([]);
    setDocsLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, file_name, file_url, category, created_at, file_type, file_size')
        .eq('student_id', s.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocs((data as Document[]) ?? []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selected) return;
    setResetting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-student-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session!.access_token}`,
          },
          body: JSON.stringify({ user_id: selected.id }),
        }
      );
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed');

      setShowResetDialog(false);
      setShowResetPw(false);
      setResetCreds({ email: selected.email, password: result.temp_password });
      // Refresh student to show updated must_change_password
      fetchStudents();
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setResetting(false);
    }
  };

  const copyResetCreds = async () => {
    if (!resetCreds) return;
    try {
      await navigator.clipboard.writeText(`Email: ${resetCreds.email}\nPassword: ${resetCreds.password}`);
      setCopiedReset(true);
      setTimeout(() => setCopiedReset(false), 2000);
    } catch {
      toast({ variant: 'destructive', description: 'Could not copy' });
    }
  };

  const filtered = students.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.full_name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.phone_number || '').includes(q)
    );
  });

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">
            {isRtl ? 'الطلاب المسجلون' : 'Registered Students'}
          </h1>
          <Badge variant="secondary" className="text-xs">{students.length}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStudents} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {isRtl ? 'تحديث' : 'Refresh'}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={isRtl ? 'بحث بالاسم أو البريد...' : 'Search by name or email...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{isRtl ? 'لا يوجد طلاب مسجلون' : 'No registered students found'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <Card
              key={s.id}
              className="cursor-pointer hover:shadow-md transition-shadow border-border"
              onClick={() => openStudent(s)}
            >
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{s.full_name || s.email}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span className="truncate max-w-[180px]">{s.email}</span>
                      </span>
                      {s.phone_number && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />{s.phone_number}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    {format(new Date(s.created_at), 'dd MMM yyyy')}
                  </span>
                  {s.must_change_password && (
                    <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50 gap-1">
                      <KeyRound className="h-3 w-3" />
                      {isRtl ? 'يجب التغيير' : 'Must change pw'}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Shield className="h-3 w-3" />
                    {isRtl ? 'طالب' : 'Student'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Student Detail Sheet ── */}
      <Sheet open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  {selected.full_name || selected.email}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-5 space-y-5">
                {/* Profile Info */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    {isRtl ? 'معلومات الطالب' : 'Student Information'}
                  </p>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground w-20 shrink-0">{isRtl ? 'البريد' : 'Email'}</span>
                      <span className="font-medium truncate">{selected.email}</span>
                    </div>
                    {selected.phone_number && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground w-20 shrink-0">{isRtl ? 'الهاتف' : 'Phone'}</span>
                        <span className="font-medium">{selected.phone_number}</span>
                      </div>
                    )}
                    {selected.city && (
                      <div className="flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground w-20 shrink-0">{isRtl ? 'المدينة' : 'City'}</span>
                        <span className="font-medium">{selected.city}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground w-20 shrink-0">{isRtl ? 'تاريخ الإنشاء' : 'Created'}</span>
                      <span className="font-medium">{format(new Date(selected.created_at), 'PPP')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground w-20 shrink-0">{isRtl ? 'كلمة المرور' : 'Password'}</span>
                      {selected.must_change_password ? (
                        <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                          {isRtl ? 'يجب التغيير' : 'Pending change'}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          {isRtl ? 'تم التغيير' : 'Changed'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Admin Actions */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    {isRtl ? 'إجراءات الأدمن' : 'Admin Actions'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 w-full"
                    onClick={() => setShowResetDialog(true)}
                  >
                    <KeyRound className="h-4 w-4" />
                    {isRtl ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}
                  </Button>
                </div>

                <Separator />

                {/* Documents */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    {isRtl ? 'المستندات المرفوعة' : 'Uploaded Documents'} ({docs.length})
                  </p>
                  {docsLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : docs.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      {isRtl ? 'لم يرفع الطالب أي مستندات بعد' : 'No documents uploaded yet'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {docs.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{doc.file_name}</p>
                              <p className="text-muted-foreground">
                                <Badge variant="outline" className="text-xs capitalize me-1">{doc.category.replace(/_/g, ' ')}</Badge>
                                {doc.file_size && formatBytes(doc.file_size)}
                              </p>
                            </div>
                          </div>
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline shrink-0"
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Reset Password Confirm Dialog ── */}
      <Dialog open={showResetDialog} onOpenChange={open => { if (!open) setShowResetDialog(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" />
              {isRtl ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {isRtl
              ? `هل تريد إعادة تعيين كلمة مرور ${selected?.full_name || selected?.email}؟ سيتم إنشاء كلمة مرور مؤقتة جديدة.`
              : `Reset password for ${selected?.full_name || selected?.email}? A new temporary password will be generated.`}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowResetDialog(false)} disabled={resetting}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleResetPassword} disabled={resetting} variant="destructive" className="gap-2">
              {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {isRtl ? 'إعادة التعيين' : 'Reset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Password Result Dialog ── */}
      <Dialog open={!!resetCreds} onOpenChange={open => { if (!open) setResetCreds(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Shield className="h-5 w-5" />
              {isRtl ? 'تم إعادة التعيين ✓' : 'Password Reset ✓'}
            </DialogTitle>
          </DialogHeader>
          {resetCreds && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                {isRtl ? 'احفظ هذه البيانات — لن تُعرض مرة أخرى.' : 'Save these credentials — they will not be shown again.'}
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{isRtl ? 'البريد' : 'Email'}</p>
                <p className="font-mono text-sm bg-muted px-3 py-2 rounded-lg">{resetCreds.email}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{isRtl ? 'كلمة المرور الجديدة' : 'New Password'}</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm bg-muted px-3 py-2 rounded-lg flex-1 tracking-wider">
                    {showResetPw ? resetCreds.password : '•'.repeat(resetCreds.password.length)}
                  </p>
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowResetPw(v => !v)}>
                    {showResetPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={copyResetCreds}>
                  {copiedReset ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  {copiedReset ? (isRtl ? 'تم!' : 'Copied!') : (isRtl ? 'نسخ' : 'Copy')}
                </Button>
                <Button className="flex-1" onClick={() => setResetCreds(null)}>
                  {isRtl ? 'إغلاق' : 'Close'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
