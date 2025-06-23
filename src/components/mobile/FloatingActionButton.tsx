
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MessageCircle, Plus, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const FloatingActionButton = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Don't show FAB on certain pages
  const hiddenPaths = ['/student-auth', '/contact', '/dashboard'];
  const shouldHide = hiddenPaths.some(path => location.pathname.startsWith(path));

  if (shouldHide) return null;

  const isHomePage = location.pathname === '/';
  const isMajorsPage = location.pathname.startsWith('/educational-programs');

  const handleClick = () => {
    if (isHomePage) {
      // Quick apply or chat action for home
      if (user) {
        navigate('/dashboard');
      } else {
        navigate('/student-auth');
      }
    } else if (isMajorsPage) {
      // Quick chat for majors page
      navigate('/contact');
    } else {
      // Default action
      navigate('/contact');
    }
  };

  const getButtonContent = () => {
    if (isHomePage) {
      return {
        icon: user ? <Zap className="h-5 w-5" /> : <Plus className="h-5 w-5" />,
        label: user ? 'تطبيق سريع' : 'ابدأ الآن',
        ariaLabel: user ? 'تطبيق سريع للجامعات' : 'ابدأ رحلتك التعليمية'
      };
    } else if (isMajorsPage) {
      return {
        icon: <MessageCircle className="h-5 w-5" />,
        label: 'محادثة',
        ariaLabel: 'تحدث مع مستشار تعليمي'
      };
    } else {
      return {
        icon: <MessageCircle className="h-5 w-5" />,
        label: 'مساعدة',
        ariaLabel: 'احصل على المساعدة'
      };
    }
  };

  const { icon, label, ariaLabel } = getButtonContent();

  return (
    <Button
      onClick={handleClick}
      aria-label={ariaLabel}
      className="fixed bottom-20 left-4 z-40 h-14 px-4 rounded-full shadow-lg bg-orange-500 hover:bg-orange-600 text-white"
      style={{ 
        boxShadow: '0 8px 25px rgba(251, 146, 60, 0.3)',
        transform: 'translateZ(0)', // Force hardware acceleration
      }}
    >
      {icon}
      <span className="mr-2 font-medium text-sm">{label}</span>
    </Button>
  );
};

export default FloatingActionButton;
