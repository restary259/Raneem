
import React, { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, useNavigate, useLocation, Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import WhoWeArePage from "./pages/WhoWeArePage";
import ServicesPage from "./pages/ServicesPage";
import LocationsPage from "./pages/LocationsPage";
import ContactPage from "./pages/ContactPage";
import EducationalDestinationsPage from "./pages/EducationalDestinationsPage";
import StudentAuthPage from "./pages/StudentAuthPage";
import ChatWidget from "./components/chat/ChatWidget";
import PWAInstaller from "./components/common/PWAInstaller";
import OfflineIndicator from "./components/common/OfflineIndicator";
import InAppBrowserBanner from "./components/common/InAppBrowserBanner";
import CookieBanner from "./components/common/CookieBanner";
import BottomNav from "./components/common/BottomNav";
import { registerServiceWorker } from "./utils/pwaUtils";
import { useSessionTimeout } from "./hooks/useSessionTimeout";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import DashboardLayout from "./components/layout/DashboardLayout";

// Lazy-loaded public pages
const PartnershipPage = lazy(() => import('./pages/PartnershipPage'));
const EducationalProgramsPage = lazy(() => import('./pages/EducationalProgramsPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const BroadcastPage = lazy(() => import('./pages/BroadcastPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const AIAdvisorPage = lazy(() => import('./pages/AIAdvisorPage'));
const CostCalculatorPage = lazy(() => import('./pages/CostCalculatorPage'));
const CurrencyConverterPage = lazy(() => import('./pages/CurrencyConverterPage'));
const BagrutCalculatorPage = lazy(() => import('./pages/BagrutCalculatorPage'));
const LebenslaufBuilderPage = lazy(() => import('./pages/LebenslaufBuilderPage'));
const ApplyPage = lazy(() => import('./pages/ApplyPage'));

// Lazy-loaded Admin pages
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const AdminCommandCenter = lazy(() => import('./pages/admin/AdminCommandCenter'));
const AdminPipelinePage = lazy(() => import('./pages/admin/AdminPipelinePage'));
const AdminTeamPage = lazy(() => import('./pages/admin/AdminTeamPage'));
const AdminProgramsPage = lazy(() => import('./pages/admin/AdminProgramsPage'));
const AdminSubmissionsPage = lazy(() => import('./pages/admin/AdminSubmissionsPage'));
const AdminFinancialsPage = lazy(() => import('./pages/admin/AdminFinancialsPage'));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage'));
const AdminActivityPage = lazy(() => import('./pages/admin/AdminActivityPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));

// Team pages (Phase 3)
const TeamTodayPage = lazy(() => import('./pages/team/TeamTodayPage'));
const TeamCasesPage = lazy(() => import('./pages/team/TeamCasesPage'));
const CaseDetailPage = lazy(() => import('./pages/team/CaseDetailPage'));
const TeamAppointmentsPage = lazy(() => import('./pages/team/TeamAppointmentsPage'));
const SubmitNewStudentPage = lazy(() => import('./pages/team/SubmitNewStudentPage'));
const TeamStudentsPage = lazy(() => import('./pages/team/TeamStudentsPage'));
const TeamStudentProfilePage = lazy(() => import('./pages/team/TeamStudentProfilePage'));
const TeamAnalyticsPage = lazy(() => import('./pages/team/TeamAnalyticsPage'));

// Partner pages (Phase 5)
const PartnerOverviewPage = lazy(() => import('./pages/partner/PartnerOverviewPage'));
const PartnerLinkPage = lazy(() => import('./pages/partner/PartnerLinkPage'));
const PartnerStudentsPage = lazy(() => import('./pages/partner/PartnerStudentsPage'));
const PartnerEarningsPage = lazy(() => import('./pages/partner/PartnerEarningsPage'));

// Student pages (Phase 5)
const StudentChecklistPage = lazy(() => import('./pages/student/StudentChecklistPage'));
const StudentProfilePage = lazy(() => import('./pages/student/StudentProfilePage'));
const StudentDocumentsPage = lazy(() => import('./pages/student/StudentDocumentsPage'));
const StudentVisaPage = lazy(() => import('./pages/student/StudentVisaPage'));
const StudentReferPage = lazy(() => import('./pages/student/StudentReferPage'));
const StudentContactsPage = lazy(() => import('./pages/student/StudentContactsPage'));

const queryClient = new QueryClient();

const App = () => {
  useSessionTimeout();
  
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation('dashboard');

  // Global safety net for unhandled promise rejections
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  useEffect(() => {
    const dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = dir;
    
    registerServiceWorker();

    // SPA Redirect for original Lovable URL
    const redirectPath = sessionStorage.getItem('redirectPath');
    if (redirectPath) {
      sessionStorage.removeItem('redirectPath');
      const searchParams = new URLSearchParams(location.search);
      const queryString = searchParams.toString();
      const fullPath = queryString ? `${redirectPath}?${queryString}` : redirectPath;
      navigate(fullPath, { replace: true });
    }
  }, [navigate, location.search, i18n.language]);

  // Scroll to top when route changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const dir = i18n.language === 'ar' ? 'rtl' : 'ltr';

  // Hide all distractions on the apply page
  const isApplyPage = location.pathname === '/apply';

  // Paths that use DashboardLayout (no bottom nav / chat)
  const isDashboardPath = location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/team') ||
    location.pathname.startsWith('/partner') ||
    location.pathname.startsWith('/student');

  return (
    <TooltipProvider>
      <div className="min-h-screen w-full pb-20 md:pb-0 relative" dir={dir}>
        <Toaster />
        <Sonner />
        {!isApplyPage && !isDashboardPath && <OfflineIndicator />}
        {!isApplyPage && !isDashboardPath && <InAppBrowserBanner />}
        <Suspense fallback={<div />}>
          <Routes>
            {/* ── Public pages ── */}
            <Route path="/" element={<Index />} />
            <Route path="/about" element={<WhoWeArePage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/locations" element={<LocationsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/partnership" element={<PartnershipPage />} />
            <Route path="/partners" element={<EducationalDestinationsPage />} />
            <Route path="/educational-destinations" element={<EducationalDestinationsPage />} />
            <Route path="/educational-programs" element={<EducationalProgramsPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/resources/cost-calculator" element={<CostCalculatorPage />} />
            <Route path="/resources/currency-converter" element={<CurrencyConverterPage />} />
            <Route path="/resources/bagrut-calculator" element={<BagrutCalculatorPage />} />
            <Route path="/resources/lebenslauf-builder" element={<LebenslaufBuilderPage />} />
            <Route path="/broadcast" element={<BroadcastPage />} />
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="/ai-advisor" element={<AIAdvisorPage />} />
            <Route path="/apply" element={<ApplyPage />} />
            <Route path="/student-auth" element={<StudentAuthPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* ── Admin Dashboard (/admin/*) ── */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <DashboardLayout role="admin" />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminCommandCenter />} />
              <Route path="pipeline" element={<AdminPipelinePage />} />
              <Route path="team" element={<AdminTeamPage />} />
              <Route path="programs" element={<AdminProgramsPage />} />
              <Route path="submissions" element={<AdminSubmissionsPage />} />
              <Route path="financials" element={<AdminFinancialsPage />} />
              <Route path="analytics" element={<AdminAnalyticsPage />} />
              <Route path="activity" element={<AdminActivityPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
            </Route>

            {/* ── Team Dashboard (/team/*) ── */}
            <Route
              path="/team"
              element={
                <ProtectedRoute allowedRoles={['team_member']}>
                  <DashboardLayout role="team_member" />
                </ProtectedRoute>
              }
            >
              <Route index element={<TeamTodayPage />} />
              <Route path="cases" element={<TeamCasesPage />} />
              <Route path="cases/:id" element={<CaseDetailPage />} />
              <Route path="appointments" element={<TeamAppointmentsPage />} />
              <Route path="appointments/today" element={<TeamTodayPage />} />
              <Route path="submit" element={<SubmitNewStudentPage />} />
              <Route path="students" element={<TeamStudentsPage />} />
              <Route path="students/:id" element={<TeamStudentProfilePage />} />
              <Route path="analytics" element={<TeamAnalyticsPage />} />
            </Route>

            {/* ── Partner Dashboard (/partner/*) ── */}
            <Route
              path="/partner"
              element={
                <ProtectedRoute allowedRoles={['social_media_partner']}>
                  <DashboardLayout role="social_media_partner" />
                </ProtectedRoute>
              }
            >
              <Route index element={<PartnerOverviewPage />} />
              <Route path="link" element={<PartnerLinkPage />} />
              <Route path="students" element={<PartnerStudentsPage />} />
              <Route path="earnings" element={<PartnerEarningsPage />} />
            </Route>

            {/* ── Student Dashboard (/student/*) ── */}
            <Route
              path="/student"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <DashboardLayout role="student" />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/student/checklist" replace />} />
              <Route path="checklist" element={<StudentChecklistPage />} />
              <Route path="profile" element={<StudentProfilePage />} />
              <Route path="documents" element={<StudentDocumentsPage />} />
              <Route path="visa" element={<StudentVisaPage />} />
              <Route path="refer" element={<StudentReferPage />} />
              <Route path="contacts" element={<StudentContactsPage />} />
            </Route>

            {/* ── Legacy redirects (old routes → new) ── */}
            <Route path="/student-dashboard" element={<Navigate to="/student/checklist" replace />} />
            <Route path="/influencer-dashboard" element={<Navigate to="/partner" replace />} />
            <Route path="/lawyer-dashboard" element={<Navigate to="/team" replace />} />
            <Route path="/team-dashboard" element={<Navigate to="/team" replace />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        {!isApplyPage && !isDashboardPath && <ChatWidget />}
        {!isApplyPage && !isDashboardPath && <PWAInstaller />}
        {!isApplyPage && !isDashboardPath && <CookieBanner />}
        {!isDashboardPath && <BottomNav />}
      </div>
    </TooltipProvider>
  );
}

const AppWithProviders = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </QueryClientProvider>
);

export default AppWithProviders;
