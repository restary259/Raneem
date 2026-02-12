import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDirection } from '@/hooks/useDirection';
import {
  LayoutDashboard, Users, UserCheck, ClipboardCheck, Mail, Shield, ScrollText, LogOut, ArrowLeftCircle, Share2, Wallet
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  userEmail?: string;
}

const tabs = [
  { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
  { id: 'students', label: 'إدارة الطلاب', icon: Users },
  { id: 'influencers', label: 'الوكلاء', icon: UserCheck },
  { id: 'checklist', label: 'قائمة المتطلبات', icon: ClipboardCheck },
  { id: 'contacts', label: 'رسائل التواصل', icon: Mail },
  { id: 'referrals', label: 'الإحالات', icon: Share2 },
  { id: 'payouts', label: 'المكافآت والصرف', icon: Wallet },
  { id: 'security', label: 'الأمان', icon: Shield },
  { id: 'audit', label: 'سجل النشاط', icon: ScrollText },
];

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, activeTab, onTabChange, userEmail }) => {
  const navigate = useNavigate();
  const { dir } = useDirection();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-muted/30 flex" dir={dir}>
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 bg-[hsl(215,50%,23%)] text-white shrink-0">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png" alt="Darb" className="w-10 h-10 object-contain" />
            <div>
              <h2 className="font-bold text-lg">لوحة الإدارة</h2>
              <p className="text-xs text-white/60">درب للدراسة في الخارج</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-white/15 text-white shadow-lg'
                    : 'text-white/70 hover:bg-white/8 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <Button variant="ghost" size="sm" className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10" onClick={() => navigate('/')}>
            <ArrowLeftCircle className="h-4 w-4 me-2" />العودة للموقع
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 me-2" />تسجيل الخروج
          </Button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile tab selector */}
            <select
              className="lg:hidden border rounded-lg px-3 py-2 text-sm bg-background"
              value={activeTab}
              onChange={(e) => onTabChange(e.target.value)}
            >
              {tabs.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <h1 className="hidden lg:block text-xl font-bold text-foreground">
              {tabs.find(t => t.id === activeTab)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {userEmail && <Badge variant="secondary" className="hidden sm:inline-flex">{userEmail}</Badge>}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
