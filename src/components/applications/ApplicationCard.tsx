
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, FileText, MessageCircle, Edit } from 'lucide-react';
import { Application } from '@/hooks/useApplications';

interface ApplicationCardProps {
  application: Application;
  onEdit: (application: Application) => void;
  onViewDetails: (application: Application) => void;
}

const ApplicationCard: React.FC<ApplicationCardProps> = ({
  application,
  onEdit,
  onViewDetails,
}) => {
  const getStatusColor = (status: Application['status']) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-500';
      case 'rejected':
        return 'bg-red-500';
      case 'under_review':
        return 'bg-yellow-500';
      case 'submitted':
        return 'bg-blue-500';
      case 'waitlisted':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: Application['status']) => {
    switch (status) {
      case 'draft':
        return 'مسودة';
      case 'submitted':
        return 'مُرسل';
      case 'under_review':
        return 'قيد المراجعة';
      case 'accepted':
        return 'مقبول';
      case 'rejected':
        return 'مرفوض';
      case 'waitlisted':
        return 'قائمة الانتظار';
      default:
        return status;
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200" dir="rtl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            طلب التقديم #{application.id.slice(-8)}
          </CardTitle>
          <Badge className={`${getStatusColor(application.status)} text-white`}>
            {getStatusText(application.status)}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {application.deadline && (
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>الموعد النهائي: {new Date(application.deadline).toLocaleDateString('ar-SA')}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2 text-gray-600">
            <FileText className="h-4 w-4" />
            <span>تاريخ الإنشاء: {new Date(application.created_at).toLocaleDateString('ar-SA')}</span>
          </div>
        </div>

        {application.notes && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-700 line-clamp-2">{application.notes}</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(application)}
            className="flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            تعديل
          </Button>
          
          <Button
            variant="default"
            size="sm"
            onClick={() => onViewDetails(application)}
            className="flex items-center gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            عرض التفاصيل
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ApplicationCard;
