import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { User as UserIcon, FileText, ClipboardCheck, UserPlus, Gift, GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Tab {
  id: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface DashboardSidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation('dashboard');

  const tabs: Tab[] = [
    { id: 'overview', labelKey: 'sidebar.overview', icon: UserIcon },
    { id: 'application', labelKey: 'sidebar.application', icon: GraduationCap },
    { id: 'checklist', labelKey: 'sidebar.checklist', icon: ClipboardCheck },
    { id: 'documents', labelKey: 'sidebar.documents', icon: FileText },
    { id: 'referrals', labelKey: 'sidebar.referrals', icon: UserPlus },
    { id: 'rewards', labelKey: 'sidebar.rewards', icon: Gift },
  ];

  return (
    <div className="lg:w-64">
      <Card className="lg:bg-[#1E293B] lg:text-white lg:border-0">
        <CardContent className="p-0">
          <nav className="space-y-1 max-h-[60vh] overflow-y-auto lg:max-h-none lg:overflow-y-visible">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-start transition-colors rounded-xl ${
                    activeTab === tab.id
                      ? 'bg-accent/20 lg:text-white text-accent border-s-4 border-accent font-semibold lg:shadow-[0_0_12px_rgba(234,88,12,0.3)]'
                      : 'text-muted-foreground lg:text-white/70 hover:bg-muted lg:hover:bg-white/10 lg:hover:text-white'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {t(tab.labelKey)}
                </button>
              );
            })}
          </nav>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardSidebar;
