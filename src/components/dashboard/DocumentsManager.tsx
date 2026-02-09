
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

const CATEGORIES = [
  { value: 'passport', label: 'جواز السفر' },
  { value: 'certificate', label: 'الشهادات الأكاديمية' },
  { value: 'translation', label: 'الترجمات المعتمدة' },
  { value: 'visa', label: 'التأشيرة / الإقامة' },
  { value: 'university_letter', label: 'رسائل الجامعة' },
  { value: 'language', label: 'شهادات اللغة' },
  { value: 'insurance', label: 'التأمين الصحي' },
  { value: 'financial', label: 'المستندات المالية' },
  { value: 'housing', label: 'عقد السكن' },
  { value: 'other', label: 'أخرى' },
];

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

  useEffect(() => {
    fetchDocuments();
  }, [userId]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('documents')
        .select('*')
        .eq('student_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في تحميل المستندات",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast({ variant: "destructive", title: "خطأ", description: "يرجى اختيار ملف للرفع" });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('student-documents')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { error: dbError } = await (supabase as any)
        .from('documents')
        .insert({
          student_id: userId,
          file_name: selectedFile.name,
          file_url: filePath,
          file_size: selectedFile.size,
          file_type: selectedFile.type,
          category,
          expiry_date: expiryDate || null,
          notes: notes || null,
        });

      if (dbError) throw dbError;

      toast({ title: "تم رفع الملف بنجاح", description: "تم حفظ المستند في حسابك" });
      setShowUploadModal(false);
      setSelectedFile(null);
      setCategory('other');
      setExpiryDate('');
      setNotes('');
      fetchDocuments();
    } catch (error: any) {
      toast({ variant: "destructive", title: "خطأ في رفع الملف", description: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('student-documents')
        .download(doc.file_url);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = doc.file_name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({ variant: "destructive", title: "خطأ في تحميل الملف", description: error.message });
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستند؟')) return;
    try {
      await supabase.storage.from('student-documents').remove([doc.file_url]);
      const { error } = await (supabase as any).from('documents').delete().eq('id', doc.id);
      if (error) throw error;
      toast({ title: "تم حذف المستند", description: "تم حذف المستند بنجاح" });
      fetchDocuments();
    } catch (error: any) {
      toast({ variant: "destructive", title: "خطأ في حذف المستند", description: error.message });
    }
  };

  const getCategoryLabel = (value: string) => CATEGORIES.find(c => c.value === value)?.label || value;

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'غير معروف';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} ميجابايت`;
  };

  const isExpiringSoon = (date?: string) => {
    if (!date) return false;
    const expiry = new Date(date);
    const now = new Date();
    const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 30 && diffDays > 0;
  };

  const isExpired = (date?: string) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchQuery || 
      doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || doc.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const expiringDocs = documents.filter(d => isExpiringSoon(d.expiry_date));
  const expiredDocs = documents.filter(d => isExpired(d.expiry_date));

  if (isLoading) return <div className="text-center py-8">جار تحميل المستندات...</div>;

  return (
    <div className="space-y-6">
      {/* Expiry Alerts */}
      {(expiringDocs.length > 0 || expiredDocs.length > 0) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <h3 className="font-semibold text-orange-800">تنبيهات المستندات</h3>
            </div>
            {expiredDocs.map(d => (
              <p key={d.id} className="text-sm text-red-600">⚠️ {d.file_name} - منتهي الصلاحية!</p>
            ))}
            {expiringDocs.map(d => (
              <p key={d.id} className="text-sm text-orange-600">⏰ {d.file_name} - ينتهي قريباً ({new Date(d.expiry_date!).toLocaleDateString('ar-SA')})</p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="text-xl">مستنداتي</CardTitle>
          <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                رفع مستند
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>رفع مستند جديد</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleFileUpload} className="space-y-4">
                <div className="space-y-2">
                  <Label>الملف</Label>
                  <Input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" required />
                  <p className="text-xs text-gray-500">PDF, DOC, DOCX, JPG, PNG (حد أقصى 10 ميجابايت)</p>
                </div>
                <div className="space-y-2">
                  <Label>التصنيف</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>تاريخ انتهاء الصلاحية (اختياري)</Label>
                  <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات اختيارية" rows={2} />
                </div>
                <Button type="submit" disabled={isUploading} className="w-full">
                  {isUploading ? "جار الرفع..." : "رفع المستند"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في المستندات..."
                className="pr-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع التصنيفات</SelectItem>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredDocuments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {documents.length === 0 ? 'لم يتم رفع أي مستندات بعد' : 'لا توجد نتائج مطابقة'}
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
                            <Badge variant="secondary" className="text-xs">{getCategoryLabel(doc.category)}</Badge>
                            <span className="text-xs text-gray-500">{formatFileSize(doc.file_size)}</span>
                            {doc.expiry_date && (
                              <span className={`text-xs ${isExpired(doc.expiry_date) ? 'text-red-600 font-bold' : isExpiringSoon(doc.expiry_date) ? 'text-orange-600' : 'text-gray-500'}`}>
                                {isExpired(doc.expiry_date) ? '⚠️ منتهي' : `ينتهي: ${new Date(doc.expiry_date).toLocaleDateString('ar-SA')}`}
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
