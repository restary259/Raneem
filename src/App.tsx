import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LandingPage from '@/pages/LandingPage';
import DashboardPage from '@/pages/DashboardPage';
import AuthPage from '@/pages/AuthPage';
import ServicesPage from '@/pages/ServicesPage';
import PartnersPage from '@/pages/PartnersPage';
import PartnershipPage from '@/pages/PartnershipPage';
import ResourcesPage from '@/pages/ResourcesPage';
import AboutPage from '@/pages/AboutPage';
import ContactPage from '@/pages/ContactPage';
import ProfilePage from '@/pages/ProfilePage';
import SettingsPage from '@/pages/SettingsPage';
import DocumentsPage from '@/pages/DocumentsPage';
import PaymentsPage from '@/pages/PaymentsPage';
import MessagesPage from '@/pages/MessagesPage';
import AppointmentsPage from '@/pages/AppointmentsPage';
import NotificationsPage from '@/pages/NotificationsPage';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '@/components/ErrorFallback';
import UniversityApplicationServicePage from '@/pages/UniversityApplicationServicePage';
import VisaAssistanceServicePage from '@/pages/VisaAssistanceServicePage';
import AccommodationServicePage from '@/pages/AccommodationServicePage';
import ScholarshipServicePage from '@/pages/ScholarshipServicePage';
import LanguageSupportServicePage from '@/pages/LanguageSupportServicePage';
import TravelBookingServicePage from '@/pages/TravelBookingServicePage';

import CommunityHubPage from '@/pages/CommunityHubPage';
import ForumTopicPage from '@/pages/ForumTopicPage';

function App() {
  return (
    <Router>
      <div className="App">
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/partners" element={<PartnersPage />} />
            <Route path="/partnership" element={<PartnershipPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/dashboard/profile" element={<ProfilePage />} />
            <Route path="/dashboard/settings" element={<SettingsPage />} />
            <Route path="/dashboard/documents" element={<DocumentsPage />} />
            <Route path="/dashboard/payments" element={<PaymentsPage />} />
            <Route path="/dashboard/messages" element={<MessagesPage />} />
            <Route path="/dashboard/appointments" element={<AppointmentsPage />} />
            <Route path="/dashboard/notifications" element={<NotificationsPage />} />
            <Route path="/services/university-application" element={<UniversityApplicationServicePage />} />
            <Route path="/services/visa-assistance" element={<VisaAssistanceServicePage />} />
            <Route path="/services/accommodation" element={<AccommodationServicePage />} />
            <Route path="/services/scholarship" element={<ScholarshipServicePage />} />
            <Route path="/services/language-support" element={<LanguageSupportServicePage />} />
            <Route path="/services/travel-booking" element={<TravelBookingServicePage />} />
            <Route path="/community" element={<CommunityHubPage />} />
            <Route path="/community/forum/topic/:topicId" element={<ForumTopicPage />} />
          </Routes>
        </ErrorBoundary>
      </div>
    </Router>
  );
}

export default App;
