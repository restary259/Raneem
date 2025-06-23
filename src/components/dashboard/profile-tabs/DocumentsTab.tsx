
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StudentDocument } from '@/types/profile';
import { FileText, Upload, Eye, Trash2 } from 'lucide-react';

interface DocumentsTabProps {
  documents: StudentDocument[];
  onUpdate: () => void;
  userId: string;
}

const DocumentsTab: React.FC<DocumentsTabProps> = ({
  documents,
  onUpdate,
  userId
}) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            المستندات
          </CardTitle>
          <Button>
            <Upload className="h-4 w-4 ml-2" />
            رفع مستند
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            لا توجد مستندات مرفوعة بعد
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-blue-600" />
                  <div>
                    <h3 className="font-semibold">{doc.name}</h3>
                    <p className="text-sm text-muted-foreground">{doc.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.uploaded_at && new Date(doc.uploaded_at).toLocaleDateString('ar-SA')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={doc.status === 'approved' ? 'default' : doc.status === 'rejected' ? 'destructive' : 'secondary'}>
                    {doc.status === 'approved' ? 'موافق عليه' : doc.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                  </Badge>
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DocumentsTab;
