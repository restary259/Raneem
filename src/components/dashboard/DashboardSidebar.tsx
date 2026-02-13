import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { User as UserIcon, FileText, Settings, ClipboardCheck, UserPlus, Gift, GraduationCap } from 'lucide-react';
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
    { id: 'checklist', labelKey: 'sidebar.checklist', icon: ClipboardCheck },
    { id: 'application', labelKey: 'sidebar.application', icon: GraduationCap },
    { id: 'overview', labelKey: 'sidebar.overview', icon: UserIcon },
    { id: 'services', labelKey: 'sidebar.services', icon: Settings },
    { id: 'documents', labelKey: 'sidebar.documents', icon: FileText },
    { id: 'referrals', labelKey: 'sidebar.referrals', icon: UserPlus },
    { id: 'rewards', labelKey: 'sidebar.rewards', icon: Gift },
  ];

  return (
    <div className="lg:w-64">
      <Card>
        <CardContent className="p-0">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-muted transition-colors rounded-xl ${
                    activeTab === tab.id
                      ? 'bg-accent/10 text-accent border-s-4 border-accent font-semibold'
                      : 'text-muted-foreground'
                  }`}
                >
                  <Icon className="h-5 w-5" />
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
