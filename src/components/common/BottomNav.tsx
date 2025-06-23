import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  Home,
  User,
  FileText,
  GraduationCap,
  Users,
} from 'lucide-react';
import '../styles/navigation.css';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  activeIcon: React.ComponentType<any>;
}

const BottomNav = () => {
  const location = useLocation();
  const { user } = useAuth();

  const navigationItems = [
    {
      name: 'الرئيسية',
      href: '/',
      icon: Home,
      activeIcon: Home,
    },
    {
      name: 'الطلبات',
      href: '/applications',
      icon: FileText,
      activeIcon: FileText,
    },
    {
      name: 'البرامج',
      href: '/educational-programs',
      icon: GraduationCap,
      activeIcon: GraduationCap,
    },
    {
      name: 'المجتمع',
      href: '/community',
      icon: Users,
      activeIcon: Users,
    },
    {
      name: 'الملف الشخصي',
      href: user ? '/dashboard/profile' : '/student-auth',
      icon: User,
      activeIcon: User,
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 bg-white border-t border-gray-200 py-2 px-4 flex justify-around items-center 
      lg:hidden z-50 shadow-md"
      dir="rtl"
    >
      {navigationItems.map((item) => {
        const isActive = location.pathname === item.href;
        const Icon = isActive ? item.activeIcon : item.icon;

        return (
          <NavLink
            key={item.name}
            to={item.href}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon className="h-5 w-5" />
            <span>{item.name}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};

export default BottomNav;
