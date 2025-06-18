
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
import { Upload, File, Download, Trash2, Plus } from 'lucide-react';

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  upload_date: string;
  notes?: string;
  service_id?: string;
  service_type?: string;
}

interface Service {
  id: string;
  service_type: string;
}

interface DocumentsManagerProps {
  userId: string;
}

const DocumentsManager: React.FC<DocumentsManagerProps> = ({ userId }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchDocuments();
    fetchServices();
  }, [userId]);

  const fetchDocuments = async () => {
    try {
      // First fetch documents
      const { data: documentsData, error: documentsError } = await supabase
        .from('documents')
        .select('*')
        .eq('student_id', userId)
        .order('upload_date', { ascending: false });

      if (documentsError) throw documentsError;

      // Then fetch services separately and merge
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('id, service_type')
        .eq('student_id', userId);

      if (servicesError) throw servicesError;

      // Create a map of service_id to service_type
      const serviceMap = new Map(servicesData?.map(s => [s.id, s.service_type]) || []);

      // Merge the data
      const enrichedDocuments = documentsData?.map(doc => ({
        ...doc,
        service_type: doc.service_id ? serviceMap.get(doc.service_id) : undefined
      })) || [];

      setDocuments(enrichedDocuments);
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

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, service_type')
        .eq('student_id', userId);

      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      console.error('Error fetching services:', error);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "يرجى اختيار ملف للرفع",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Upload to Supabase Storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('student-documents')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Save to database
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          student_id: userId,
          service_id: serviceId || null,
          file_name: selectedFile.name,
          file_path: fileName,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          notes: notes || null,
        });

      if (dbError) throw dbError;

      toast({
        title: "تم رفع الملف بنجاح",
        description: "تم حفظ المستند في حسابك",
      });

      setShowUploadModal(false);
      setSelectedFile(null);
      setServiceId('');
      setNotes('');
      fetchDocuments();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في رفع الملف",
        description: error.message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('student-documents')
        .download(document.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.file_name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في تحميل الملف",
        description: error.message,
      });
    }
  };

  const handleDelete = async (document: Document) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستند؟')) return;

    try {
      // Delete from storage
      await supabase.storage
        .from('student-documents')
        .remove([document.file_path]);

      // Delete from database
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', document.id);

      if (error) throw error;

      toast({
        title: "تم حذف المستند",
        description: "تم حذف المستند بنجاح",
      });

      fetchDocuments();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في حذف المستند",
        description: error.message,
      });
    }
  };

  const serviceNames: Record<string, string> = {
    university_application: 'تقديم الجامعة',
    visa_assistance: 'مساعدة الفيزا',
    accommodation: 'السكن',
    scholarship: 'المنح الدراسية',
    language_support: 'دعم اللغة',
    travel_booking: 'حجز السفر',
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'غير معروف';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} ميجابايت`;
  };

  if (isLoading) {
    return <div className="text-center py-8">جار تحميل المستندات...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
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
                  <Label htmlFor="file">الملف</Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    required
                  />
                  <p className="text-xs text-gray-500">
                    الأنواع المدعومة: PDF, DOC, DOCX, JPG, PNG (حد أقصى 10 ميجابايت)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="serviceId">الخدمة المرتبطة (اختياري)</Label>
                  <Select value={serviceId} onValueChange={setServiceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الخدمة (اختياري)" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {serviceNames[service.service_type] || service.service_type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">ملاحظات</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="وصف المستند أو ملاحظات (اختياري)"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="submit" disabled={isUploading}>
                    {isUploading ? "جار الرفع..." : "رفع المستند"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              لم يتم رفع أي مستندات بعد
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((document) => (
                <Card key={document.id} className="border border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <File className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-medium">{document.file_name}</h3>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div>الحجم: {formatFileSize(document.file_size)}</div>
                            <div>تاريخ الرفع: {new Date(document.upload_date).toLocaleDateString('ar-SA')}</div>
                            {document.service_type && (
                              <div>
                                الخدمة: {serviceNames[document.service_type] || document.service_type}
                              </div>
                            )}
                            {document.notes && (
                              <div>الملاحظات: {document.notes}</div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(document)}
                          className="flex items-center gap-1"
                        >
                          <Download className="h-4 w-4" />
                          تحميل
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(document)}
                          className="flex items-center gap-1"
                        >
                          <Trash2 className="h-4 w-4" />
                          حذف
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
