
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { User as UserIcon, CreditCard, FileText, Settings, ClipboardCheck, UserPlus, Gift } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface DashboardSidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ activeTab, onTabChange }) => {
  const tabs: Tab[] = [
    { id: 'checklist', label: 'قائمة المتطلبات', icon: ClipboardCheck },
    { id: 'overview', label: 'نظرة عامة', icon: UserIcon },
    { id: 'services', label: 'الخدمات', icon: Settings },
    { id: 'payments', label: 'المدفوعات', icon: CreditCard },
    { id: 'documents', label: 'المستندات', icon: FileText },
    { id: 'referrals', label: 'إحالة صديق', icon: UserPlus },
    { id: 'rewards', label: 'مكافآتي', icon: Gift },
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
                  className={`w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-gray-50 transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                      : 'text-gray-700'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
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
