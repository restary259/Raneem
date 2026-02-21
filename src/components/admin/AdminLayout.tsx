import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDirection } from '@/hooks/useDirection';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  LayoutDashboard, Users, LogOut, ArrowLeftCircle, Wallet, GraduationCap, UserCheck, Package, Settings, BarChart3, Briefcase, Menu, DollarSign
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
import NotificationBell from '@/components/common/NotificationBell';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  userEmail?: string;
}

const sidebarGroups = [
  {
    labelKey: 'admin.groups.dashboard',
    items: [
      { id: 'overview', labelKey: 'admin.tabs.overview', icon: LayoutDashboard },
    ],
  },
  {
    labelKey: 'admin.groups.pipeline',
    items: [
      { id: 'leads', labelKey: 'admin.tabs.leads', icon: Users },
      { id: 'student-cases', labelKey: 'admin.tabs.studentCases', icon: Briefcase },
    ],
  },
  {
    labelKey: 'admin.groups.people',
    items: [
      { id: 'team', labelKey: 'admin.tabs.teamMembers', icon: UserCheck },
      { id: 'students', labelKey: 'admin.tabs.students', icon: GraduationCap },
    ],
  },
  {
    labelKey: 'admin.groups.finance',
    items: [
      { id: 'money', labelKey: 'admin.tabs.money', icon: Wallet },
    ],
  },
  {
    labelKey: 'admin.groups.system',
    items: [
      { id: 'settings', labelKey: 'admin.tabs.settings', icon: Settings },
    ],
  },
];

const allTabs = sidebarGroups.flatMap(g => g.items);

const bottomNavItems = [
  { id: 'overview', labelKey: 'admin.tabs.overview', icon: LayoutDashboard },
  { id: 'leads', labelKey: 'admin.tabs.leads', icon: Users },
  { id: 'student-cases', labelKey: 'admin.tabs.studentCases', icon: Briefcase },
  { id: 'money', labelKey: 'admin.tabs.money', icon: DollarSign },
];

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, activeTab, onTabChange, userEmail }) => {
  const navigate = useNavigate();
  const { dir, sheetSide } = useDirection();
  const { t } = useTranslation('dashboard');
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleMobileTabChange = (tabId: string) => {
    onTabChange(tabId);
    setMenuOpen(false);
  };

  const sidebarContent = (
    <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
      {sidebarGroups.map((group, gi) => (
        <div key={gi}>
          <p className="text-[11px] uppercase tracking-widest text-white/40 font-semibold px-4 mb-1.5">{t(group.labelKey)}</p>
          <div className="space-y-0.5">
            {group.items.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => isMobile ? handleMobileTabChange(tab.id) : onTabChange(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative ${
                    isActive
                      ? 'bg-accent/20 text-white shadow-[0_0_12px_rgba(234,88,12,0.3)]'
                      : 'text-white/70 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <span className="absolute start-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-orange-400 rounded-e-full" />
                  )}
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{t(tab.labelKey)}</span>
                </button>
              );
            })}
          </div>
          {gi < sidebarGroups.length - 1 && <div className="border-t border-white/10 mt-4" />}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" dir={dir}>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 bg-[#1E293B] text-white shrink-0">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png" alt="Darb" className="w-10 h-10 object-contain" />
            <div>
              <h2 className="font-bold text-lg">{t('admin.title')}</h2>
              <p className="text-xs text-white/60">{t('admin.subtitle')}</p>
            </div>
          </div>
        </div>

        {sidebarContent}

        <div className="p-4 border-t border-white/10 space-y-2">
          <Button variant="ghost" size="sm" className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10" onClick={() => navigate('/')}>
            <ArrowLeftCircle className="h-4 w-4 me-2" />{t('admin.returnToSite')}
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 me-2" />{t('admin.signOut')}
          </Button>
        </div>
      </aside>

      {/* Mobile Sheet Menu */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side={sheetSide} className="w-72 bg-[#1E293B] text-white border-none p-0 flex flex-col h-full [&~[data-state=open]]:bg-black/60">
          <SheetHeader className="p-6 border-b border-white/10 shrink-0">
            <SheetTitle className="flex items-center gap-3 text-white">
              <img src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png" alt="Darb" className="w-10 h-10 object-contain" />
              <div>
                <h2 className="font-bold text-lg">{t('admin.title')}</h2>
                <p className="text-xs text-white/60 font-normal">{t('admin.subtitle')}</p>
              </div>
            </SheetTitle>
            {userEmail && (
              <p className="text-[11px] text-white/40 truncate mt-1 px-1">{userEmail}</p>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {sidebarContent}
          </div>

          <div className="p-4 border-t border-white/10 space-y-2 shrink-0">
            <Button variant="ghost" size="sm" className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10" onClick={() => { setMenuOpen(false); navigate('/'); }}>
              <ArrowLeftCircle className="h-4 w-4 me-2" />{t('admin.returnToSite')}
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10" onClick={() => { setMenuOpen(false); handleSignOut(); }}>
              <LogOut className="h-4 w-4 me-2" />{t('admin.signOut')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-h-screen overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="lg:hidden h-9 w-9 p-0" onClick={() => setMenuOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-base lg:text-xl font-bold text-foreground truncate">
              {t(allTabs.find(tab => tab.id === activeTab)?.labelKey || '')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1">
              {userEmail && (
                <div className="hidden sm:flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                    {userEmail.charAt(0).toUpperCase()}
                  </span>
                  <Badge variant="secondary">{userEmail}</Badge>
                </div>
              )}
              {userEmail && (
                <span className="sm:hidden w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                  {userEmail.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="[&_button]:text-muted-foreground [&_button]:hover:text-foreground [&_button]:hover:bg-muted/50">
                <NotificationBell />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className={`flex-1 p-4 md:p-6 lg:p-8 min-w-0 ${isMobile ? 'pb-24' : ''}`}>{children}</main>

        {/* Mobile Bottom Nav */}
        {isMobile && (
          <nav className="fixed bottom-0 inset-x-0 z-30 bg-[#1E293B] border-t border-white/10 flex justify-around items-center h-16 safe-area-pb">
            {bottomNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors relative ${
                    isActive ? 'text-orange-400' : 'text-white/50'
                  }`}
                >
                  {isActive && <span className="absolute top-1.5 w-1 h-1 rounded-full bg-orange-400" />}
                  <Icon className={`${isActive ? 'h-6 w-6' : 'h-5 w-5'} transition-all`} />
                  <span className={`text-[10px] font-medium ${isActive ? 'bg-orange-500/15 rounded-full px-2.5 py-0.5' : ''}`}>{t(item.labelKey)}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
};

export default AdminLayout;
