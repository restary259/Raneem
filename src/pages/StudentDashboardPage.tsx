import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import StudentProfile from '@/components/dashboard/StudentProfile';
import ServicesOverview from '@/components/dashboard/ServicesOverview';
import PaymentsSummary from '@/components/dashboard/PaymentsSummary';
import DocumentsManager from '@/components/dashboard/DocumentsManager';
import { LogOut, User as UserIcon, CreditCard, FileText, Settings } from 'lucide-react';
import { Profile, VisaStatus } from '@/types/profile'; // <-- shared types

const StudentDashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate('/student-auth');
        return;
      }
      setUser(session.user);
      await fetchProfile(session.user.id);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        navigate('/student-auth');
      } else {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // Safely cast visa_status:
      const allowedStatuses: VisaStatus[] = [
        'not_applied', 'applied', 'approved', 'rejected', 'received'
      ];
      const safeProfile: Profile = {
        ...data,
        visa_status: allowedStatuses.includes(data.visa_status) ? data.visa_status : undefined,
      };

      setProfile(safeProfile);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      toast({
        variant: "destructive",
        title: "خطأ في تحميل البيانات",
        description: "حدث خطأ أثناء تحميل بياناتك",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/student-auth');
      toast({
        title: "تم تسجيل الخروج",
        description: "تم تسجيل خروجك بنجاح",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "حدث خطأ أثناء تسجيل الخروج",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">جار التحميل...</div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  const tabs = [
    { id: 'overview', label: 'نظرة عامة', icon: UserIcon },
    { id: 'services', label: 'الخدمات', icon: Settings },
    { id: 'payments', label: 'المدفوعات', icon: CreditCard },
    { id: 'documents', label: 'المستندات', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">لوحة التحكم الطلابية</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">مرحباً، {profile.full_name}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                تسجيل الخروج
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64">
            <Card>
              <CardContent className="p-0">
                <nav className="space-y-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-gray-50 transition-colors ${
                          activeTab === tab.id
                            ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                            : 'text-gray-700'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {activeTab === 'overview' && (
              <StudentProfile 
                profile={profile} 
                onProfileUpdate={fetchProfile}
                userId={user.id}
              />
            )}
            {activeTab === 'services' && (
              <ServicesOverview userId={user.id} />
            )}
            {activeTab === 'payments' && (
              <PaymentsSummary userId={user.id} />
            )}
            {activeTab === 'documents' && (
              <DocumentsManager userId={user.id} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboardPage;
