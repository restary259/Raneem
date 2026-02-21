
import React, { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
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
import { useSessionGuard } from "./hooks/useSessionGuard";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

// Lazy-loaded routes
const PartnershipPage = lazy(() => import('./pages/PartnershipPage'));
const EducationalProgramsPage = lazy(() => import('./pages/EducationalProgramsPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const BroadcastPage = lazy(() => import('./pages/BroadcastPage'));
const StudentDashboardPage = lazy(() => import('./pages/StudentDashboardPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const InfluencerDashboardPage = lazy(() => import('./pages/InfluencerDashboardPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const AIAdvisorPage = lazy(() => import('./pages/AIAdvisorPage'));
const CostCalculatorPage = lazy(() => import('./pages/CostCalculatorPage'));
const CurrencyConverterPage = lazy(() => import('./pages/CurrencyConverterPage'));
const BagrutCalculatorPage = lazy(() => import('./pages/BagrutCalculatorPage'));
const LebenslaufBuilderPage = lazy(() => import('./pages/LebenslaufBuilderPage'));
const HousingPage = lazy(() => import('./pages/HousingPage'));
const TeamDashboardPage = lazy(() => import('./pages/TeamDashboardPage'));
const ApplyPage = lazy(() => import('./pages/ApplyPage'));

const queryClient = new QueryClient();

const App = () => {
  useSessionTimeout();
  const { kicked, acknowledgeKick } = useSessionGuard();
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n } = useTranslation();

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

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen w-full pb-20 md:pb-0 relative" dir={dir}>
          <Toaster />
          <Sonner />
          {/* Single-session kick modal */}
          <AlertDialog open={kicked}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>تم تسجيل الدخول من جهاز آخر</AlertDialogTitle>
                <AlertDialogDescription>
                  تم تسجيل الدخول إلى حسابك من جهاز أو متصفح آخر. سيتم تسجيل خروجك تلقائياً.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={acknowledgeKick}>حسناً</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {!isApplyPage && <OfflineIndicator />}
          {!isApplyPage && <InAppBrowserBanner />}
          <Suspense fallback={<div />}>
            <Routes>
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
              <Route path="/housing" element={<HousingPage />} />
              <Route path="/broadcast" element={<BroadcastPage />} />
              <Route path="/student-auth" element={<StudentAuthPage />} />
              <Route path="/student-dashboard" element={<StudentDashboardPage />} />
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/influencer-dashboard" element={<InfluencerDashboardPage />} />
              <Route path="/lawyer-dashboard" element={<TeamDashboardPage />} />
              <Route path="/team-dashboard" element={<TeamDashboardPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/quiz" element={<QuizPage />} />
              <Route path="/ai-advisor" element={<AIAdvisorPage />} />
              <Route path="/apply" element={<ApplyPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          {!isApplyPage && <ChatWidget />}
          {!isApplyPage && <PWAInstaller />}
          {!isApplyPage && <CookieBanner />}
          <BottomNav />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
