
import React, { useEffect } from "react";
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import ThemeProvider from "./components/common/ThemeProvider";
import CookieConsent from "./components/common/CookieConsent";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import WhoWeArePage from "./pages/WhoWeArePage";
import ServicesPage from "./pages/ServicesPage";
import LocationsPage from "./pages/LocationsPage";
import ContactPage from "./pages/ContactPage";
import PartnershipPage from "./pages/PartnershipPage";
import PartnersPage from "./pages/PartnersPage";
import ResourcesPage from "./pages/ResourcesPage";
import BlogPage from "./pages/BlogPage";
import ChatWidget from "./components/chat/ChatWidget";
import BroadcastPage from "./pages/BroadcastPage";
import StudentAuthPage from "./pages/StudentAuthPage";
import StudentDashboardPage from "./pages/StudentDashboardPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import QuizPage from "./pages/QuizPage";

const queryClient = new QueryClient();

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    
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
  }, [navigate, location.search]);

  // Scroll to top when route changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <HelmetProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<WhoWeArePage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/locations" element={<LocationsPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/partnership" element={<PartnershipPage />} />
              <Route path="/partners" element={<PartnersPage />} />
              <Route path="/resources" element={<ResourcesPage />} />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/broadcast" element={<BroadcastPage />} />
              <Route path="/student-auth" element={<StudentAuthPage />} />
              <Route path="/student-dashboard" element={<StudentDashboardPage />} />
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/quiz" element={<QuizPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <ChatWidget />
            <CookieConsent />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;
