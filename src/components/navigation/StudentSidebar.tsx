
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStudentProfile } from '@/hooks/useStudentProfile';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  User,
  FileText,
  Heart,
  MessageSquare,
  File,
  Bell,
  Settings,
  Globe,
  LogOut
} from 'lucide-react';

const StudentSidebar = () => {
  const { user } = useAuth();
  const { profile } = useStudentProfile(user?.id || '');
  const { unreadCount } = useNotifications(user?.id || '', { limit: 1 });
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const navigationItems = [
    {
      icon: User,
      label: 'Edit Profile',
      href: '/dashboard/profile',
      count: null
    },
    {
      icon: FileText,
      label: 'My Applications',
      href: '/applications',
      count: null
    },
    {
      icon: Heart,
      label: 'Saved Programs',
      href: '/dashboard/favorites',
      count: null
    },
    {
      icon: MessageSquare,
      label: 'Messages',
      href: '/dashboard/messages',
      count: null
    },
    {
      icon: File,
      label: 'Documents & CV',
      href: '/dashboard/documents',
      count: null
    },
    {
      icon: Bell,
      label: 'Notifications',
      href: '/dashboard/notifications',
      count: unreadCount > 0 ? unreadCount : null
    },
    {
      icon: Settings,
      label: 'Settings',
      href: '/dashboard/settings',
      count: null
    },
    {
      icon: Globe,
      label: 'Language',
      href: '/dashboard/language',
      count: null,
      special: 'English'
    }
  ];

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/');
      toast({
        title: "تم تسجيل الخروج بنجاح",
        description: "نراك قريباً!",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في تسجيل الخروج",
        description: error.message,
      });
    }
  };

  const isActive = (href: string) => location.pathname === href;

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* User Profile Section */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
              {profile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900 truncate">
                {profile?.full_name || 'مستخدم'}
              </h3>
              <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                Verified
              </span>
            </div>
            <p className="text-sm text-gray-500 truncate">
              {user?.email}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors ${
                  active 
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.special && (
                    <span className="text-xs text-gray-500">{item.special}</span>
                  )}
                  {item.count && (
                    <Badge 
                      variant="secondary" 
                      className="h-5 min-w-[20px] px-1.5 text-xs"
                    >
                      {item.count}
                    </Badge>
                  )}
                  <span className="text-gray-400">›</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Logout Section */}
      <div className="p-4 border-t border-gray-100">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <LogOut className="h-5 w-5" />
          Log Out
        </Button>
      </div>
    </div>
  );
};

export default StudentSidebar;
