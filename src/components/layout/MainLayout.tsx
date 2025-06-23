
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'react-router-dom';
import StudentSidebar from '@/components/navigation/StudentSidebar';
import Header from '@/components/landing/Header';
import MobileLayout from '@/components/mobile/MobileLayout';
import { useIsMobile } from '@/hooks/use-mobile';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();

  // Pages that should show the header instead of sidebar
  const showHeaderPaths = [
    '/about',
    '/services', 
    '/partners',
    '/partnership',
    '/resources',
    '/contact'
  ];

  const shouldShowHeader = showHeaderPaths.some(path => 
    location.pathname.startsWith(path)
  ) || (location.pathname === '/' && !user);

  if (isMobile) {
    return <MobileLayout>{children}</MobileLayout>;
  }

  if (!user || shouldShowHeader) {
    return (
      <div className="min-h-screen">
        <Header />
        <main>{children}</main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <StudentSidebar />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
