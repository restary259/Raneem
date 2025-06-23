
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import Index from '@/pages/Index';
import StudentDashboardPage from '@/pages/StudentDashboardPage';
import StudentAuthPage from '@/pages/StudentAuthPage';
import ServicesPage from '@/pages/ServicesPage';
import PartnersPage from '@/pages/PartnersPage';
import PartnershipPage from '@/pages/PartnershipPage';
import ResourcesPage from '@/pages/ResourcesPage';
import AboutPage from '@/pages/AboutPage';
import ContactPage from '@/pages/ContactPage';
import ProfileManagementPage from '@/pages/ProfileManagementPage';
import NotificationsPage from '@/pages/NotificationsPage';
import CommunityHubPage from '@/pages/CommunityHubPage';
import ForumTopicPage from '@/pages/ForumTopicPage';
import CustomErrorBoundary from '@/components/ErrorBoundary';
import MobileLayout from '@/components/mobile/MobileLayout';

// Create a client
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="App">
        <CustomErrorBoundary>
          <MobileLayout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<StudentDashboardPage />} />
              <Route path="/auth" element={<StudentAuthPage />} />
              <Route path="/student-auth" element={<StudentAuthPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/partners" element={<PartnersPage />} />
              <Route path="/partnership" element={<PartnershipPage />} />
              <Route path="/resources" element={<ResourcesPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/dashboard/profile" element={<ProfileManagementPage />} />
              <Route path="/dashboard/notifications" element={<NotificationsPage />} />
              <Route path="/community" element={<CommunityHubPage />} />
              <Route path="/community/forum/topic/:topicId" element={<ForumTopicPage />} />
            </Routes>
          </MobileLayout>
        </CustomErrorBoundary>
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}

export default App;
