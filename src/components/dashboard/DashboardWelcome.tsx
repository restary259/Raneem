
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Profile } from '@/types/profile';
import { Calendar, FileText, GraduationCap, MessageCircle, Target } from 'lucide-react';

interface DashboardWelcomeProps {
  profile: Profile;
  onQuickAction?: (action: string) => void;
}

const DashboardWelcome: React.FC<DashboardWelcomeProps> = ({ profile, onQuickAction }) => {
  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'صباح الخير';
    if (hour < 18) return 'مساء الخير';
    return 'مساء الخير';
  };

  const getProfileCompletion = () => {
    const fields = [
      profile.full_name,
      profile.phone_number || profile.phone,
      profile.country,
      profile.city,
      profile.university_name,
      profile.intake_month
    ];
    const completed = fields.filter(field => field && field.trim()).length;
    return Math.round((completed / fields.length) * 100);
  };

  const completion = getProfileCompletion();

  const quickActions = [
    {
      id: 'complete-profile',
      title: 'أكمل ملفك الشخصي',
      description: 'أضف المزيد من المعلومات لتحسين فرصك',
      icon: FileText,
      color: 'bg-blue-500',
      show: completion < 80
    },
    {
      id: 'browse-programs',
      title: 'تصفح البرامج',
      description: 'اكتشف البرامج التعليمية المناسبة لك',
      icon: GraduationCap,
      color: 'bg-green-500',
      show: true
    },
    {
      id: 'schedule-consultation',
      title: 'احجز استشارة',
      description: 'تحدث مع مستشارينا التعليميين',
      icon: Calendar,
      color: 'bg-purple-500',
      show: true
    },
    {
      id: 'join-community',
      title: 'انضم للمجتمع',
      description: 'تواصل مع طلاب آخرين',
      icon: MessageCircle,
      color: 'bg-orange-500',
      show: true
    }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                {getTimeOfDay()}، {profile.preferred_name || profile.full_name.split(' ')[0]}!
              </h2>
              <p className="text-blue-100">
                مرحباً بك في رحلتك التعليمية
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{completion}%</div>
              <div className="text-sm text-blue-100">اكتمال الملف</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Completion */}
      {completion < 100 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              اكتمال الملف الشخصي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">التقدم</span>
                <Badge variant={completion >= 80 ? "default" : completion >= 50 ? "secondary" : "destructive"}>
                  {completion}%
                </Badge>
              </div>
              <Progress value={completion} className="h-2" />
              <p className="text-sm text-muted-foreground">
                أكمل ملفك الشخصي لتحسين فرصك في القبول
              </p>
              <Button 
                onClick={() => onQuickAction?.('complete-profile')}
                className="w-full"
              >
                أكمل الملف الآن
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>الإجراءات السريعة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickActions.filter(action => action.show).map((action) => {
              const Icon = action.icon;
              return (
                <div
                  key={action.id}
                  className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => onQuickAction?.(action.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${action.color} text-white`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium mb-1">{action.title}</h3>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>النشاط الأخير</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">تم إنشاء الحساب بنجاح</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(profile.created_at || Date.now()).toLocaleDateString('ar-SA')}
                </p>
              </div>
            </div>
            
            {profile.updated_at && profile.updated_at !== profile.created_at && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">تم تحديث الملف الشخصي</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(profile.updated_at).toLocaleDateString('ar-SA')}
                  </p>
                </div>
              </div>
            )}

            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                ابدأ في استكشاف البرامج لرؤية المزيد من النشاط هنا
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardWelcome;
