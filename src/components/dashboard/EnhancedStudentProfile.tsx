
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useStudentProfile } from '@/hooks/useStudentProfile';
import { Edit, User, GraduationCap, FileText, Settings, Shield } from 'lucide-react';
import PersonalInfoTab from './profile-tabs/PersonalInfoTab';
import AcademicTab from './profile-tabs/AcademicTab';
import DocumentsTab from './profile-tabs/DocumentsTab';
import PreferencesTab from './profile-tabs/PreferencesTab';
import SecurityTab from './profile-tabs/SecurityTab';

interface EnhancedStudentProfileProps {
  userId: string;
}

const EnhancedStudentProfile: React.FC<EnhancedStudentProfileProps> = ({ userId }) => {
  const [activeTab, setActiveTab] = useState('personal');
  const [isEditing, setIsEditing] = useState(false);
  
  const {
    profile,
    academicBackgrounds,
    testScores,
    documents,
    preferences,
    completion,
    isLoading,
    refetch
  } = useStudentProfile(userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">جار تحميل الملف الشخصي...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-red-600">خطأ في تحميل الملف الشخصي</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 space-x-reverse">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {profile.full_name?.charAt(0) || 'م'}
              </div>
              <div>
                <CardTitle className="text-2xl">
                  {profile.preferred_name || profile.full_name}
                  {profile.pronouns && (
                    <span className="text-sm text-muted-foreground mr-2">
                      ({profile.pronouns})
                    </span>
                  )}
                </CardTitle>
                <p className="text-muted-foreground">{profile.email}</p>
                {profile.city && profile.country && (
                  <p className="text-sm text-muted-foreground">
                    {profile.city}, {profile.country}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              {isEditing ? 'إنهاء التعديل' : 'تعديل الملف'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Profile Completion */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">اكتمال الملف الشخصي</span>
                <Badge variant={completion.overall >= 80 ? "default" : completion.overall >= 50 ? "secondary" : "destructive"}>
                  {completion.overall}%
                </Badge>
              </div>
              <Progress value={completion.overall} className="h-2" />
            </div>

            {/* Bio */}
            {profile.bio && (
              <div>
                <h3 className="font-medium mb-2">نبذة شخصية</h3>
                <p className="text-muted-foreground">{profile.bio}</p>
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{completion.personal}%</div>
                <div className="text-sm text-muted-foreground">المعلومات الشخصية</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-600">{academicBackgrounds.length}</div>
                <div className="text-sm text-muted-foreground">الخلفية الأكاديمية</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{documents.length}</div>
                <div className="text-sm text-muted-foreground">المستندات</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{testScores.length}</div>
                <div className="text-sm text-muted-foreground">نتائج الاختبارات</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="personal" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            شخصي
          </TabsTrigger>
          <TabsTrigger value="academic" className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            أكاديمي
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            مستندات
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            تفضيلات
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            الأمان
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <PersonalInfoTab 
            profile={profile} 
            isEditing={isEditing}
            onUpdate={refetch}
            userId={userId}
          />
        </TabsContent>

        <TabsContent value="academic">
          <AcademicTab 
            academicBackgrounds={academicBackgrounds}
            testScores={testScores}
            onUpdate={refetch}
            userId={userId}
          />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsTab 
            documents={documents}
            onUpdate={refetch}
            userId={userId}
          />
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesTab 
            preferences={preferences}
            onUpdate={refetch}
            userId={userId}
          />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedStudentProfile;
