
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
      <div className="animate-[logoScale_2s_ease-out_forwards]">
        <img 
          src="/lovable-uploads/78047579-6b53-42e9-bf6f-a9e19a9e4aba.png" 
          alt="درب" 
          className="w-16 h-16 object-contain"
        />
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
    
    // Register service worker for PWA functionality
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
        <div className="min-h-screen pb-20 md:pb-0 relative">
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
