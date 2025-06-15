import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import WhoWeArePage from "./pages/WhoWeArePage";
import ServicesPage from "./pages/ServicesPage";
import LocationsPage from "./pages/LocationsPage";
import TestimonialsPage from "./pages/TestimonialsPage";
import PricingPage from "./pages/PricingPage";
import ContactPage from "./pages/ContactPage";
import PartnershipPage from "./pages/PartnershipPage";
import PartnersPage from "./pages/PartnersPage";
import ResourcesPage from "./pages/ResourcesPage";
import ChatWidget from "./components/chat/ChatWidget";
import { useEffect } from "react";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/about" element={<WhoWeArePage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/locations" element={<LocationsPage />} />
          <Route path="/testimonials" element={<TestimonialsPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/partnership" element={<PartnershipPage />} />
          <Route path="/partners" element={<PartnersPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <ChatWidget />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
