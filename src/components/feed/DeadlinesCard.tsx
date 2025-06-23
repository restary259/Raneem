
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, AlertCircle, Calendar } from 'lucide-react';
import { Deadline } from '@/types/feed';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface DeadlinesCardProps {
  deadlines: Deadline[];
}

const DeadlinesCard: React.FC<DeadlinesCardProps> = ({ deadlines }) => {
  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'high': return <AlertCircle className="h-4 w-4" />;
      case 'medium': return <Clock className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          المواعيد النهائية القادمة
        </CardTitle>
      </CardHeader>
      <CardContent>
        {deadlines.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>لا توجد مواعيد نهائية قادمة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deadlines.map((deadline) => (
              <div
                key={deadline.id}
                className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getUrgencyIcon(deadline.urgency)}
                    <h4 className="font-medium text-sm">{deadline.title}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(deadline.deadline_date), {
                      addSuffix: true,
                      locale: ar
                    })}
                  </p>
                </div>
                <Badge variant={getUrgencyColor(deadline.urgency) as any} className="text-xs">
                  {deadline.urgency === 'high' ? 'عاجل' : 
                   deadline.urgency === 'medium' ? 'متوسط' : 'عادي'}
                </Badge>
              </div>
            ))}
            {deadlines.length > 3 && (
              <Button variant="outline" size="sm" className="w-full">
                عرض جميع المواعيد
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DeadlinesCard;
