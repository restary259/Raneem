
import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileTabBar from './MobileTabBar';
import FloatingActionButton from './FloatingActionButton';
import MobileDrawer from './MobileDrawer';
import BottomNav from '@/components/common/BottomNav';
import Header from '@/components/landing/Header';

interface MobileLayoutProps {
  children: React.ReactNode;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  // Pages that should show the header
  const showHeaderPaths = [
    '/about',
    '/services',
    '/partners',
    '/partnership',
    '/resources',
    '/contact',
    '/educational-programs',
    '/community'
  ];

  const shouldShowHeader = showHeaderPaths.some(path => 
    location.pathname.startsWith(path)
  ) || (location.pathname === '/' && user);

  // Pages that shouldn't show mobile navigation
  const hideNavPaths = [
    '/student-auth',
    '/auth',
    '/dashboard/profile',
    '/dashboard/notifications'
  ];

  const shouldHideNav = hideNavPaths.some(path => 
    location.pathname.startsWith(path)
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header for specific pages */}
      {shouldShowHeader && <Header />}

      {/* Mobile Drawer - only show on mobile when user is logged in */}
      {isMobile && user && !shouldHideNav && (
        <div className="fixed top-4 right-4 z-50">
          <MobileDrawer />
        </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 ${!shouldHideNav && isMobile ? 'pb-16' : ''}`}>
        {children}
      </main>

      {/* Mobile Navigation */}
      {isMobile && !shouldHideNav ? (
        <MobileTabBar />
      ) : (
        !isMobile && <BottomNav />
      )}

      {/* Floating Action Button */}
      {isMobile && <FloatingActionButton />}
    </div>
  );
};

export default MobileLayout;
