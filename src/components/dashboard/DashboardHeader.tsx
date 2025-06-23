
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useNavigate } from 'react-router-dom';
import { Profile } from '@/types/profile';
import { User, Settings } from 'lucide-react';

interface DashboardHeaderProps {
  profile: Profile | null;
  userId: string;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ profile, userId }) => {
  const navigate = useNavigate();

  return (
    <header className="bg-white shadow-sm border-b px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            مرحباً، {profile?.preferred_name || profile?.full_name || 'المستخدم'}
          </h1>
          <p className="text-gray-600 mt-1">
            {profile?.bio || 'أهلاً بك في لوحة التحكم الخاصة بك'}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <NotificationBell 
            userId={userId}
            onOpenNotificationCenter={() => navigate('/dashboard/notifications')}
          />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard/settings')}
          >
            <Settings className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
              {profile?.full_name?.charAt(0) || 'م'}
            </div>
            <div className="text-right">
              <div className="font-medium text-gray-900">
                {profile?.full_name}
              </div>
              <div className="text-sm text-gray-500">
                {profile?.email}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
