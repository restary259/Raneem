import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LogOut, ArrowLeftCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';
import NotificationBell from '@/components/common/NotificationBell';

interface DashboardHeaderProps {
  fullName: string;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ fullName }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');
  const { dir } = useDirection();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/');
      toast({
        title: t('header.signOutSuccess'),
        description: t('header.signOutSuccessDesc'),
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('header.signOutError'),
        description: t('header.signOutErrorDesc'),
      });
    }
  };

  return (
    <header className="bg-[#1E293B] text-white shadow-sm" dir={dir}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img 
              src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png" 
              alt="Darb" 
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain flex-shrink-0" 
            />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold whitespace-nowrap">{t('header.title')}</h1>
              <p className="text-xs text-white/60 truncate">{fullName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-white/70 hover:text-white hover:bg-white/10 h-9 w-9 p-0 sm:h-auto sm:w-auto sm:px-3 sm:py-2"
              title={t('header.returnToSite')}
            >
              <ArrowLeftCircle className="h-4 w-4 sm:me-2" />
              <span className="hidden sm:inline">{t('header.returnToSite')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-white/70 hover:text-white hover:bg-white/10 h-9 w-9 p-0 sm:h-auto sm:w-auto sm:px-3 sm:py-2"
              title={t('header.signOut')}
            >
              <LogOut className="h-4 w-4 sm:me-2" />
              <span className="hidden sm:inline">{t('header.signOut')}</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
