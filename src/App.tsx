
import React, { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import WhoWeArePage from "./pages/WhoWeArePage";
import ServicesPage from "./pages/ServicesPage";
import LocationsPage from "./pages/LocationsPage";
import ContactPage from "./pages/ContactPage";
import PartnershipPage from "./pages/PartnershipPage";
import EducationalDestinationsPage from "./pages/EducationalDestinationsPage";
import EducationalProgramsPage from "./pages/EducationalProgramsPage";
import ResourcesPage from "./pages/ResourcesPage";
import ChatWidget from "./components/chat/ChatWidget";
import BroadcastPage from "./pages/BroadcastPage";
import StudentAuthPage from "./pages/StudentAuthPage";
import StudentDashboardPage from "./pages/StudentDashboardPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import QuizPage from "./pages/QuizPage";
import PWAInstaller from "./components/common/PWAInstaller";
import OfflineIndicator from "./components/common/OfflineIndicator";
import BottomNav from "./components/common/BottomNav";
import { registerServiceWorker } from "./utils/pwaUtils";

const queryClient = new QueryClient();

// Netflix-style Loading Component
const NetflixLoader = () => {
  return (
    <div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="animate-[logoScale_2s_ease-out_forwards] mb-4">
          <img 
            src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png" 
            alt="درب" 
            className="w-20 h-20 object-contain"
          />
        </div>
        <div className="text-2xl font-bold text-gray-800 animate-fade-in">
          درب
        </div>
        <div className="text-sm text-gray-600 mt-2 animate-fade-in animation-delay-300">
          رفيقك الدراسي العالمي
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    
    // Register service worker for PWA functionality with auto-updates
    registerServiceWorker();
    
    // Netflix-style loading animation
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    // SPA Redirect for original Lovable URL - preserve query parameters
    const redirectPath = sessionStorage.getItem('redirectPath');
    if (redirectPath) {
      sessionStorage.removeItem('redirectPath');
      // For original Lovable URLs, redirect directly to the path
      const searchParams = new URLSearchParams(location.search);
      const queryString = searchParams.toString();
      const fullPath = queryString ? `${redirectPath}?${queryString}` : redirectPath;
      navigate(fullPath, { replace: true });
    }

    return () => clearTimeout(timer);
  }, [navigate, location.search]);

  // Scroll to top when route changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (isLoading) {
    return <NetflixLoader />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen pb-20 md:pb-0 relative" dir="rtl">
          <Toaster />
          <Sonner />
          <OfflineIndicator />
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
            <Route path="/broadcast" element={<BroadcastPage />} />
            <Route path="/student-auth" element={<StudentAuthPage />} />
            <Route path="/student-dashboard" element={<StudentDashboardPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <ChatWidget />
          <PWAInstaller />
          <BottomNav />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
