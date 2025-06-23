
import React from 'react';
import { Route, Routes } from 'react-router-dom';
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

function App() {
  return (
    <div className="App">
      <CustomErrorBoundary>
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
      </CustomErrorBoundary>
    </div>
  );
}

export default App;
