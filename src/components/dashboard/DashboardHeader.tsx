
import React from 'react';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';

interface DashboardHeaderProps {
  fullName: string;
  userId?: string;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ fullName, userId }) => {
  const navigate = useNavigate();

  return (
    <header className="bg-white shadow-sm border-b px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            مرحباً، {fullName}
          </h1>
          <p className="text-gray-600 mt-1">
            أهلاً بك في لوحة التحكم الخاصة بك
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {userId && (
            <NotificationBell 
              userId={userId}
              onOpenNotificationCenter={() => navigate('/dashboard/notifications')}
            />
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard/settings')}
          >
            <Settings className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
              {fullName?.charAt(0) || 'م'}
            </div>
            <div className="text-right">
              <div className="font-medium text-gray-900">
                {fullName}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
