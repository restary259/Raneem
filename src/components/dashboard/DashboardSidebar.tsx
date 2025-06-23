
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/hooks/useNotifications';
import {
  Home,
  User,
  FileText,
  CreditCard,
  Settings,
  Bell,
  MessageSquare,
  BookOpen,
  Calendar,
  LogOut,
} from 'lucide-react';

interface DashboardSidebarProps {
  userId: string;
  onLogout: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ 
  userId, 
  onLogout, 
  activeTab, 
  onTabChange 
}) => {
  const location = useLocation();
  const { unreadCount } = useNotifications(userId, { limit: 1 });

  const navigation = [
    { name: 'لوحة التحكم', href: '/dashboard', icon: Home, tab: 'overview' },
    { name: 'الملف الشخصي', href: '/dashboard/profile', icon: User, tab: 'profile' },
    { name: 'الإشعارات', href: '/dashboard/notifications', icon: Bell, badge: unreadCount, tab: 'notifications' },
    { name: 'الخدمات', href: '/dashboard/services', icon: BookOpen, tab: 'services' },
    { name: 'المستندات', href: '/dashboard/documents', icon: FileText, tab: 'documents' },
    { name: 'المدفوعات', href: '/dashboard/payments', icon: CreditCard, tab: 'payments' },
    { name: 'الرسائل', href: '/dashboard/messages', icon: MessageSquare, tab: 'messages' },
    { name: 'المواعيد', href: '/dashboard/appointments', icon: Calendar, tab: 'appointments' },
    { name: 'الإعدادات', href: '/dashboard/settings', icon: Settings, tab: 'settings' },
  ];

  const handleNavClick = (item: any) => {
    if (onTabChange && item.tab) {
      onTabChange(item.tab);
    }
  };

  return (
    <div className="w-64 bg-white shadow-lg h-full flex flex-col">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold text-gray-800">لوحة التحكم</h2>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const isActive = activeTab ? activeTab === item.tab : location.pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link key={item.name} to={item.href} onClick={() => handleNavClick(item)}>
              <Button
                variant={isActive ? "default" : "ghost"}
                className="w-full justify-start gap-3 h-12"
              >
                <Icon className="h-5 w-5" />
                <span className="flex-1 text-right">{item.name}</span>
                {item.badge && item.badge > 0 && (
                  <Badge variant="destructive" className="mr-auto">
                    {item.badge}
                  </Badge>
                )}
              </Button>
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t">
        <Button
          variant="ghost"
          onClick={onLogout}
          className="w-full justify-start gap-3 h-12 text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <LogOut className="h-5 w-5" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );
};

export default DashboardSidebar;
