import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDirection } from '@/hooks/useDirection';
import {
  LayoutDashboard, Users, UserCheck, ClipboardCheck, Mail, Shield, ScrollText, LogOut, ArrowLeftCircle, Share2, Wallet, BarChart3, CheckCircle, Settings, DollarSign
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
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
      { id: 'analytics', labelKey: 'admin.tabs.analytics', icon: BarChart3 },
    ],
  },
  {
    labelKey: 'admin.groups.students',
    items: [
      { id: 'leads', labelKey: 'admin.tabs.leads', icon: Users },
      { id: 'cases', labelKey: 'admin.tabs.cases', icon: ClipboardCheck },
      { id: 'ready', labelKey: 'admin.tabs.ready', icon: CheckCircle },
      { id: 'students', labelKey: 'admin.tabs.students', icon: Users },
      { id: 'checklist', labelKey: 'admin.tabs.checklist', icon: ClipboardCheck },
    ],
  },
  {
    labelKey: 'admin.groups.team',
    items: [
      { id: 'influencers', labelKey: 'admin.tabs.influencers', icon: UserCheck },
      { id: 'referrals', labelKey: 'admin.tabs.referrals', icon: Share2 },
    ],
  },
  {
    labelKey: 'admin.groups.finance',
    items: [
      { id: 'money', labelKey: 'admin.tabs.money', icon: DollarSign },
      { id: 'payouts', labelKey: 'admin.tabs.payouts', icon: Wallet },
    ],
  },
  {
    labelKey: 'admin.groups.tools',
    items: [
      { id: 'contacts', labelKey: 'admin.tabs.contacts', icon: Mail },
      { id: 'notifications', labelKey: 'admin.tabs.notifications', icon: Mail },
      { id: 'eligibility', labelKey: 'admin.tabs.eligibility', icon: Settings },
      { id: 'security', labelKey: 'admin.tabs.security', icon: Shield },
      { id: 'audit', labelKey: 'admin.tabs.audit', icon: ScrollText },
    ],
  },
];

// Flat list for mobile dropdown
const allTabs = sidebarGroups.flatMap(g => g.items);

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, activeTab, onTabChange, userEmail }) => {
  const navigate = useNavigate();
  const { dir } = useDirection();
  const { t } = useTranslation('dashboard');

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" dir={dir}>
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

        <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
          {sidebarGroups.map((group, gi) => (
            <div key={gi}>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold px-4 mb-1">{t(group.labelKey)}</p>
              <div className="space-y-0.5">
                {group.items.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => onTabChange(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-accent/20 text-white shadow-[0_0_12px_rgba(234,88,12,0.3)]'
                          : 'text-white/70 hover:bg-white/8 hover:text-white'
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span>{t(tab.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
              {gi < sidebarGroups.length - 1 && <div className="border-t border-white/10 mt-3" />}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <Button variant="ghost" size="sm" className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10" onClick={() => navigate('/')}>
            <ArrowLeftCircle className="h-4 w-4 me-2" />{t('admin.returnToSite')}
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 me-2" />{t('admin.signOut')}
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen overflow-auto">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <select className="lg:hidden border rounded-lg px-3 py-2 text-sm bg-background" value={activeTab} onChange={(e) => onTabChange(e.target.value)}>
              {allTabs.map(tab => <option key={tab.id} value={tab.id}>{t(tab.labelKey)}</option>)}
            </select>
            <h1 className="hidden lg:block text-xl font-bold text-foreground">
              {t(allTabs.find(tab => tab.id === activeTab)?.labelKey || '')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {userEmail && <Badge variant="secondary" className="hidden sm:inline-flex">{userEmail}</Badge>}
            <div className="[&_button]:text-muted-foreground [&_button]:hover:text-foreground [&_button]:hover:bg-muted/50">
              <NotificationBell />
            </div>
            <Button variant="ghost" size="sm" className="lg:hidden h-9 w-9 p-0 text-muted-foreground hover:text-foreground" onClick={() => navigate('/')}>
              <ArrowLeftCircle className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="sm" className="lg:hidden h-9 w-9 p-0 text-destructive hover:text-destructive" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
