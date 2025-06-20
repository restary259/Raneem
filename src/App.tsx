import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';

import Index from './pages/Index';
import AboutPage from './pages/AboutPage';
import ServicesPage from './pages/ServicesPage';
import PartnersPage from './pages/PartnersPage';
import LocationsPage from './pages/LocationsPage';
import ResourcesPage from './pages/ResourcesPage';
import BlogPage from './pages/BlogPage';
import ContactPage from './pages/ContactPage';
import QuizPage from './pages/QuizPage';
import PartnershipPage from './pages/PartnershipPage';
import BroadcastPage from './pages/BroadcastPage';
import StudentAuthPage from './pages/StudentAuthPage';
import StudentDashboardPage from './pages/StudentDashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import NotFound from './pages/NotFound';
import PWAInstaller from './components/common/PWAInstaller';

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then((registration) => {
            console.log('SW registered: ', registration);
          })
          .catch((registrationError) => {
            console.log('SW registration failed: ', registrationError);
          });
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/partners" element={<PartnersPage />} />
          <Route path="/locations" element={<LocationsPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/partnership" element={<PartnershipPage />} />
          <Route path="/broadcast" element={<BroadcastPage />} />
          <Route path="/student-auth" element={<StudentAuthPage />} />
          <Route path="/student-dashboard" element={<StudentDashboardPage />} />
          <Route path="/admin-dashboard" element={<AdminDashboardPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <PWAInstaller />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
