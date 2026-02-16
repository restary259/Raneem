import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, File, Download, Trash2, Plus, Search, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

interface Document {
  id: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  file_type?: string;
  category: string;
  expiry_date?: string;
  notes?: string;
  created_at: string;
  service_id?: string;
}

interface DocumentsManagerProps {
  userId: string;
}

const CATEGORY_KEYS = ['passport', 'certificate', 'translation', 'visa', 'university_letter', 'language', 'insurance', 'financial', 'housing', 'other'];

const DocumentsManager: React.FC<DocumentsManagerProps> = ({ userId }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const [category, setCategory] = useState('other');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const { toast } = useToast();
  const { t, i18n } = useTranslation('dashboard');

  useEffect(() => { fetchDocuments(); }, [userId]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await (supabase as any).from('documents').select('*').eq('student_id', userId).order('created_at', { ascending: false });
      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: t('documents.loadError'), description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];
  const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast({ variant: "destructive", title: t('common.error'), description: t('documents.selectFile') });
      return;
    }

    // File size validation
    if (selectedFile.size > MAX_FILE_SIZE) {
      toast({ variant: "destructive", title: t('common.error'), description: t('documents.fileTooLarge', { defaultValue: 'File exceeds 10 MB limit' }) });
      return;
    }

    // File type validation
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      toast({ variant: "destructive", title: t('common.error'), description: t('documents.invalidType', { defaultValue: 'Only PDF, DOC, DOCX, JPG, PNG files allowed' }) });
      return;
    }
    if (selectedFile.type && !ALLOWED_TYPES.includes(selectedFile.type)) {
      toast({ variant: "destructive", title: t('common.error'), description: t('documents.invalidType', { defaultValue: 'Only PDF, DOC, DOCX, JPG, PNG files allowed' }) });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${userId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('student-documents').upload(filePath, selectedFile);
      if (uploadError) throw uploadError;
      const { error: dbError } = await (supabase as any).from('documents').insert({
        student_id: userId, file_name: selectedFile.name, file_url: filePath,
        file_size: selectedFile.size, file_type: selectedFile.type, category,
        expiry_date: expiryDate || null, notes: notes || null,
      });
      if (dbError) throw dbError;
      toast({ title: t('documents.uploadSuccess'), description: t('documents.uploadSuccessDesc') });
      setShowUploadModal(false); setSelectedFile(null); setCategory('other'); setExpiryDate(''); setNotes('');
      fetchDocuments();
    } catch (error: any) {
      toast({ variant: "destructive", title: t('documents.uploadError'), description: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const logDocumentAccess = async (action: string, docName: string) => {
    try {
      await (supabase as any).rpc('log_user_activity', {
        p_action: `document_${action}`,
        p_target_id: userId,
        p_target_table: 'documents',
        p_details: `${action} document: ${docName}`,
      });
    } catch {}
  };

  const handleDownload = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage.from('student-documents').download(doc.file_url);
      if (error) throw error;
      logDocumentAccess('download', doc.file_name);
      const url = URL.createObjectURL(data);
      const link = window.document.createElement('a');
      link.href = url; link.download = doc.file_name;
      window.document.body.appendChild(link); link.click();
      window.document.body.removeChild(link); URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({ variant: "destructive", title: t('documents.downloadError'), description: error.message });
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(t('documents.deleteConfirm'))) return;
    try {
      await supabase.storage.from('student-documents').remove([doc.file_url]);
      const { error } = await (supabase as any).from('documents').delete().eq('id', doc.id);
      if (error) throw error;
      toast({ title: t('documents.deleteSuccess'), description: t('documents.deleteSuccessDesc') });
      fetchDocuments();
    } catch (error: any) {
      toast({ variant: "destructive", title: t('documents.deleteError'), description: error.message });
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return t('documents.unknownSize');
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} ${t('documents.mb')}`;
  };

  const isExpiringSoon = (date?: string) => {
    if (!date) return false;
    const diffDays = (new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 30 && diffDays > 0;
  };

  const isExpired = (date?: string) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchQuery || doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) || doc.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || doc.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';

  if (isLoading) return <div className="text-center py-8">{t('documents.loading')}</div>;

  return (
    <div className="space-y-6">
      {(documents.filter(d => isExpiringSoon(d.expiry_date)).length > 0 || documents.filter(d => isExpired(d.expiry_date)).length > 0) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <h3 className="font-semibold text-orange-800">{t('documents.alerts')}</h3>
            </div>
            {documents.filter(d => isExpired(d.expiry_date)).map(d => (
              <p key={d.id} className="text-sm text-red-600">⚠️ {d.file_name} - {t('documents.expired')}</p>
            ))}
            {documents.filter(d => isExpiringSoon(d.expiry_date)).map(d => (
              <p key={d.id} className="text-sm text-orange-600">⏰ {d.file_name} - {t('documents.expiringSoon', { date: new Date(d.expiry_date!).toLocaleDateString(locale) })}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="text-xl">{t('documents.title')}</CardTitle>
          <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2"><Plus className="h-4 w-4" />{t('documents.upload')}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t('documents.uploadNew')}</DialogTitle></DialogHeader>
              <form onSubmit={handleFileUpload} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('documents.file')}</Label>
                  <Input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" required />
                  <p className="text-xs text-muted-foreground">{t('documents.fileHint')} — {t('documents.maxSize', { defaultValue: 'Max 10 MB' })}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('documents.category')}</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORY_KEYS.map(c => (
                        <SelectItem key={c} value={c}>{t(`documents.categories.${c}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('documents.expiryDate')}</Label>
                  <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('documents.notes')}</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('documents.optionalNotes')} rows={2} />
                </div>
                <Button type="submit" disabled={isUploading} className="w-full">
                  {isUploading ? t('documents.uploading') : t('documents.uploadBtn')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('documents.searchPlaceholder')} className="pr-9" />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('documents.allCategories')}</SelectItem>
                {CATEGORY_KEYS.map(c => (
                  <SelectItem key={c} value={c}>{t(`documents.categories.${c}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredDocuments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {documents.length === 0 ? t('documents.noDocuments') : t('documents.noResults')}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocuments.map((doc) => (
                <Card key={doc.id} className={`border ${isExpired(doc.expiry_date) ? 'border-red-300 bg-red-50' : isExpiringSoon(doc.expiry_date) ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                          <File className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium truncate">{doc.file_name}</h3>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">{t(`documents.categories.${doc.category}`, doc.category)}</Badge>
                            <span className="text-xs text-gray-500">{formatFileSize(doc.file_size)}</span>
                            {doc.expiry_date && (
                              <span className={`text-xs ${isExpired(doc.expiry_date) ? 'text-red-600 font-bold' : isExpiringSoon(doc.expiry_date) ? 'text-orange-600' : 'text-gray-500'}`}>
                                {isExpired(doc.expiry_date) ? t('documents.expiredLabel') : t('documents.expiresLabel', { date: new Date(doc.expiry_date).toLocaleDateString(locale) })}
                              </span>
                            )}
                          </div>
                          {doc.notes && <p className="text-xs text-gray-500 mt-1 truncate">{doc.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => handleDownload(doc)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(doc)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentsManager;
