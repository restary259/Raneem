
import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LogOut, ArrowLeftCircle } from 'lucide-react';

interface DashboardHeaderProps {
  fullName: string;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ fullName }) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/');
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

  const handleReturnToWebsite = () => {
    navigate('/');
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <h1 className="text-2xl font-bold text-gray-900">لوحة التحكم الطلابية</h1>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReturnToWebsite}
              className="flex items-center gap-2"
              title="العودة إلى الموقع الرئيسي"
            >
              <ArrowLeftCircle className="h-4 w-4" />
              العودة إلى الموقع
            </Button>
            <span className="text-sm text-gray-600">مرحباً، {fullName}</span>
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
  );
};

export default DashboardHeader;
