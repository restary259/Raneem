
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
import ApplicationsPage from '@/pages/ApplicationsPage';
import EducationalProgramsPage from '@/pages/EducationalProgramsPage';
import SavedProgramsPage from '@/pages/SavedProgramsPage';
import DocumentsPage from '@/pages/DocumentsPage';
import CustomErrorBoundary from '@/components/ErrorBoundary';
import MainLayout from '@/components/layout/MainLayout';
import MessagesHub from '@/components/messages/MessagesHub';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="App">
        <CustomErrorBoundary>
          <MainLayout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<StudentDashboardPage />} />
              <Route path="/dashboard/messages" element={<MessagesHub />} />
              <Route path="/dashboard/favorites" element={<SavedProgramsPage />} />
              <Route path="/dashboard/documents" element={<DocumentsPage />} />
              <Route path="/auth" element={<StudentAuthPage />} />
              <Route path="/student-auth" element={<StudentAuthPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/partners" element={<PartnersPage />} />
              <Route path="/partnership" element={<PartnershipPage />} />
              <Route path="/resources" element={<ResourcesPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/applications" element={<ApplicationsPage />} />
              <Route path="/educational-programs" element={<EducationalProgramsPage />} />
              <Route path="/dashboard/profile" element={<ProfileManagementPage />} />
              <Route path="/dashboard/notifications" element={<NotificationsPage />} />
              <Route path="/community" element={<CommunityHubPage />} />
              <Route path="/community/forum/topic/:topicId" element={<ForumTopicPage />} />
            </Routes>
          </MainLayout>
        </CustomErrorBoundary>
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}

export default App;
