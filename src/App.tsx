import React, { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, useNavigate, useLocation, Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import BottomNav from "./components/common/BottomNav";
import { registerServiceWorker } from "./utils/pwaUtils";
import { useSessionTimeout } from "./hooks/useSessionTimeout";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import DashboardLayout from "./components/layout/DashboardLayout";
import PartnerDashboardLayout from "./components/layout/PartnerDashboardLayout";

// Secondary public pages — lazy so the first mobile paint only ships "/"
const WhoWeArePage = lazy(() => import("./pages/WhoWeArePage"));
const ServicesPage = lazy(() => import("./pages/ServicesPage"));
const LocationsPage = lazy(() => import("./pages/LocationsPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const BlogIndexPage = lazy(() => import("./pages/blog/BlogIndexPage"));
const BlogArticlePage = lazy(() => import("./pages/blog/BlogArticlePage"));
const EducationalDestinationsPage = lazy(() => import("./pages/EducationalDestinationsPage"));
const StudentAuthPage = lazy(() => import("./pages/StudentAuthPage"));

// Non-critical global widgets — deferred off the critical path
const ChatWidget = lazy(() => import("./components/chat/ChatWidget"));
const PWAInstaller = lazy(() => import("./components/common/PWAInstaller"));
const OfflineIndicator = lazy(() => import("./components/common/OfflineIndicator"));
const InAppBrowserBanner = lazy(() => import("./components/common/InAppBrowserBanner"));
const CookieBanner = lazy(() => import("./components/common/CookieBanner"));

// Lazy-loaded public pages
const PartnershipPage = lazy(() => import("./pages/PartnershipPage"));
const EducationalProgramsPage = lazy(() => import("./pages/EducationalProgramsPage"));
const ResourcesPage = lazy(() => import("./pages/ResourcesPage"));
const BroadcastPage = lazy(() => import("./pages/BroadcastPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const ActivateAccountPage = lazy(() => import("./pages/ActivateAccountPage"));

const UnsubscribePage = lazy(() => import("./pages/UnsubscribePage"));
const QuizPage = lazy(() => import("./pages/QuizPage"));
const AIAdvisorPage = lazy(() => import("./pages/AIAdvisorPage"));
const CostCalculatorPage = lazy(() => import("./pages/CostCalculatorPage"));
const CurrencyConverterPage = lazy(() => import("./pages/CurrencyConverterPage"));
const BagrutCalculatorPage = lazy(() => import("./pages/BagrutCalculatorPage"));
const LebenslaufBuilderPage = lazy(() => import("./pages/LebenslaufBuilderPage"));
const ApplyPage = lazy(() => import("./pages/ApplyPage"));
const JoinPartnerPage = lazy(() => import("./pages/JoinPartnerPage"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/legal/PrivacyPolicyPage"));
const TermsPage = lazy(() => import("./pages/legal/TermsPage"));
const AccessibilityStatementPage = lazy(() => import("./pages/legal/AccessibilityStatementPage"));

// Lazy-loaded Admin pages
const AdminStudentsPage = lazy(() => import("./pages/admin/AdminStudentsPage"));
const AdminSpreadsheetPage = lazy(() => import("./pages/admin/AdminSpreadsheetPage"));
const AdminCommandCenter = lazy(() => import("./pages/admin/AdminCommandCenter"));
const AdminPipelinePage = lazy(() => import("./pages/admin/AdminPipelinePage"));
const AdminTeamPage = lazy(() => import("./pages/admin/AdminTeamPage"));
const AdminProgramsPage = lazy(() => import("./pages/admin/AdminProgramsPage"));
const AdminSubmissionsPage = lazy(() => import("./pages/admin/AdminSubmissionsPage"));
const AdminFinancialsPage = lazy(() => import("./pages/admin/AdminFinancialsPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/admin/AdminAnalyticsPage"));
const AdminActivityPage = lazy(() => import("./pages/admin/AdminActivityPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));
const AdminInboxPage = lazy(() => import("./pages/admin/AdminInboxPage"));
const CaseMessagesInboxPage = lazy(() => import("./pages/messages/CaseMessagesInboxPage"));
const StudentMessagesPage = lazy(() => import("./pages/messages/StudentMessagesPage"));
const PartnerMessagesPage = lazy(() => import("./pages/messages/PartnerMessagesPage"));



// Team pages (Phase 3)
const TeamWorkPage = lazy(() => import("./pages/team/TeamWorkPage"));
const TeamCasesPage = lazy(() => import("./pages/team/TeamCasesPage"));
const CaseDetailPage = lazy(() => import("./pages/team/CaseDetailPage"));
const TeamAppointmentsPage = lazy(() => import("./pages/team/TeamAppointmentsPage"));
const SubmitNewStudentPage = lazy(() => import("./pages/team/SubmitNewStudentPage"));
const TeamStudentsPage = lazy(() => import("./pages/team/TeamStudentsPage"));
const TeamStudentProfilePage = lazy(() => import("./pages/team/TeamStudentProfilePage"));
const TeamAnalyticsPage = lazy(() => import("./pages/team/TeamAnalyticsPage"));
const TeamSpreadsheetPage = lazy(() => import("./pages/team/TeamSpreadsheetPage"));
const TeamBagrutConverter = lazy(() => import("./pages/team/BagrutConverter"));

// Partner pages (Phase 5)
const PartnerOverviewPage = lazy(() => import("./pages/partner/PartnerOverviewPage"));
const PartnerStudentsPage = lazy(() => import("./pages/partner/PartnerStudentsPage"));
const PartnerEarningsPage = lazy(() => import("./pages/partner/PartnerEarningsPage"));
const PartnerNetworkPage = lazy(() => import("./pages/partner/PartnerNetworkPage"));
const PartnerPerformancePage = lazy(() => import("./pages/partner/PartnerPerformancePage"));
const PartnerProfilePage = lazy(() => import("./pages/partner/PartnerProfilePage"));

// Student pages (Phase 5)
const StudentNextStepsPage = lazy(() => import("./pages/student/StudentNextStepsPage"));
const StudentChecklistPage = lazy(() => import("./pages/student/StudentChecklistPage"));
const StudentProfilePage = lazy(() => import("./pages/student/StudentProfilePage"));
const StudentDocumentsPage = lazy(() => import("./pages/student/StudentDocumentsPage"));
const StudentVisaPage = lazy(() => import("./pages/student/StudentVisaPage"));
const StudentReferPage = lazy(() => import("./pages/student/StudentReferPage"));
const StudentContactsPage = lazy(() => import("./pages/student/StudentContactsPage"));
const StudentDataPage = lazy(() => import("./pages/student/StudentDataPage"));
const StudentOnboardingGate = lazy(() => import("./components/student/StudentOnboardingGate"));

/** Permanent failures (auth/permission/not-found/validation) must never be retried. */
const isPermanentError = (error: unknown): boolean => {
  const e = error as { status?: number; code?: string; message?: string } | null;
  if (!e) return false;
  if (typeof e.status === "number" && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) return true;
  const code = String(e.code ?? "");
  // PostgREST/Postgres permission + constraint classes
  if (/^(PGRST|22|23|42)/.test(code)) return true;
  return false;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      // Backgrounding/foregrounding on mobile used to trigger refetch storms.
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // Keep showing the previous page's data while the new query resolves
      // instead of flashing a loading state on every navigation.
      placeholderData: (prev: unknown) => prev,
      networkMode: "offlineFirst",
      retry: (failureCount, error) => !isPermanentError(error) && failureCount < 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: {
      retry: (failureCount, error) => !isPermanentError(error) && failureCount < 1,
    },
  },
});

const App = () => {
  useSessionTimeout();

  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation("dashboard");

  // Global safety net for unhandled promise rejections
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  useEffect(() => {
    const dir = i18n.language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = dir;

    registerServiceWorker();

    // SPA redirect restore (deep link preserved by the 404 fallback)
    const redirectPath = sessionStorage.getItem("redirectPath");
    if (redirectPath) {
      sessionStorage.removeItem("redirectPath");
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

  const dir = i18n.language === "ar" ? "rtl" : "ltr";

  // Mount non-critical floating widgets after the browser is idle so they never
  // compete with first paint on mobile. Behaviour/appearance is unchanged.
  const [idleReady, setIdleReady] = React.useState(false);
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setIdleReady(true), { timeout: 2000 });
      return () => (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setIdleReady(true), 600);
    return () => window.clearTimeout(t);
  }, []);

  // Hide all distractions on the apply page
  const isApplyPage = location.pathname === "/apply";

  // Paths that use DashboardLayout (no bottom nav / chat)
  const isDashboardPath =
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/team") ||
    location.pathname.startsWith("/partner") ||
    location.pathname.startsWith("/student");

  return (
    <TooltipProvider>
      <div className="min-h-screen w-full pb-20 md:pb-0 relative" dir={dir}>
        <Toaster />
        <Sonner />
        {!isApplyPage && !isDashboardPath && (
          <Suspense fallback={null}>
            <OfflineIndicator />
            <InAppBrowserBanner />
          </Suspense>
        )}
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
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/blog" element={<BlogIndexPage />} />
            <Route path="/blog/:slug" element={<BlogArticlePage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/accessibility" element={<AccessibilityStatementPage />} />
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="/ai-advisor" element={<AIAdvisorPage />} />
            <Route path="/apply" element={<ApplyPage />} />
            <Route path="/join/:code" element={<JoinPartnerPage />} />
            <Route path="/student-auth" element={<StudentAuthPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/activate" element={<ActivateAccountPage />} />

            <Route path="/unsubscribe" element={<UnsubscribePage />} />

            {/* ── Admin Dashboard (/admin/*) ── */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <DashboardLayout role="admin" />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminCommandCenter />} />
              <Route path="pipeline" element={<AdminPipelinePage />} />
              <Route path="cases/:id" element={<CaseDetailPage />} />
              <Route path="team" element={<AdminTeamPage />} />
              <Route path="programs" element={<AdminProgramsPage />} />
              <Route path="submissions" element={<AdminSubmissionsPage />} />
              <Route path="financials" element={<AdminFinancialsPage />} />
              <Route path="analytics" element={<AdminAnalyticsPage />} />
              <Route path="activity" element={<AdminActivityPage />} />
              <Route path="inbox" element={<AdminInboxPage />} />
              <Route path="messages" element={<CaseMessagesInboxPage />} />

              <Route path="settings" element={<AdminSettingsPage />} />
              <Route path="students" element={<AdminStudentsPage />} />
              <Route path="spreadsheet" element={<AdminSpreadsheetPage />} />
            </Route>

            {/* ── Team Dashboard (/team/*) ── */}
            <Route
              path="/team"
              element={
                <ProtectedRoute allowedRoles={["team_member"]}>
                  <DashboardLayout role="team_member" />
                </ProtectedRoute>
              }
            >
              <Route index element={<TeamWorkPage />} />
              <Route path="cases" element={<TeamCasesPage />} />
              <Route path="cases/:id" element={<CaseDetailPage />} />
              <Route path="messages" element={<CaseMessagesInboxPage />} />
              <Route path="appointments" element={<TeamAppointmentsPage />} />

              <Route path="appointments/today" element={<Navigate to="/team" replace />} />
              <Route path="submit" element={<SubmitNewStudentPage />} />
              <Route path="students" element={<TeamStudentsPage />} />
              <Route path="students/:id" element={<TeamStudentProfilePage />} />
              <Route path="analytics" element={<TeamAnalyticsPage />} />
              <Route path="spreadsheet" element={<TeamSpreadsheetPage />} />
              <Route path="bagrut" element={<TeamBagrutConverter />} />
            </Route>

            {/* ── Partner + Ambassador Dashboard (/partner/*) ── */}
            <Route
              path="/partner"
              element={
                <ProtectedRoute allowedRoles={["social_media_partner", "ambassador"]}>
                  <PartnerDashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<PartnerOverviewPage />} />
              <Route path="messages" element={<PartnerMessagesPage />} />
              <Route path="students" element={<PartnerStudentsPage />} />
              <Route path="earnings" element={<PartnerEarningsPage />} />
              <Route path="network" element={<PartnerNetworkPage />} />
              <Route path="performance" element={<PartnerPerformancePage />} />
              <Route path="profile" element={<PartnerProfilePage />} />
            </Route>


            {/* ── Student Dashboard (/student/*) ── */}
            <Route
              path="/student"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentOnboardingGate>
                    <DashboardLayout role="student" />
                  </StudentOnboardingGate>
                </ProtectedRoute>
              }
            >
              <Route index element={<StudentNextStepsPage />} />
              <Route path="messages" element={<StudentMessagesPage />} />
              <Route path="checklist" element={<StudentChecklistPage />} />

              <Route path="profile" element={<StudentProfilePage />} />
              <Route path="documents" element={<StudentDocumentsPage />} />
              <Route path="visa" element={<StudentVisaPage />} />
              <Route path="refer" element={<StudentReferPage />} />
              <Route path="contacts" element={<StudentContactsPage />} />
              <Route path="my-data" element={<StudentDataPage />} />
            </Route>

            {/* ── Legacy redirects (old routes → new) ── */}
            <Route path="/student-dashboard" element={<Navigate to="/student/checklist" replace />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        {!isApplyPage && !isDashboardPath && idleReady && (
          <Suspense fallback={null}>
            <ChatWidget />
            <PWAInstaller />
            <CookieBanner />
          </Suspense>
        )}
        {!isDashboardPath && <BottomNav />}
      </div>
    </TooltipProvider>
  );
};

const AppWithProviders = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </QueryClientProvider>
);

export default AppWithProviders;
