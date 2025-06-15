
import { useEffect } from "react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import AgentProgramHero from "@/components/agent-program/AgentProgramHero";
import WhyJoinUs from "@/components/agent-program/WhyJoinUs";
import CommissionCalculator from "@/components/agent-program/CommissionCalculator";
import HowItWorks from "@/components/agent-program/HowItWorks";
import AgentToolkit from "@/components/agent-program/AgentToolkit";
import SuccessStories from "@/components/agent-program/SuccessStories";
import RegistrationForm from "@/components/agent-program/RegistrationForm";
import Faq from "@/components/agent-program/Faq";
import ClosingCta from "@/components/agent-program/ClosingCta";
import { useTranslation } from "react-i18next";

const AgentProgramPage = () => {
    const { t } = useTranslation('partnership');
    useEffect(() => {
        document.title = t('partnershipPage.title');
    }, [t]);

    return (
        <div dir="rtl" className="flex flex-col min-h-screen bg-secondary text-foreground">
            <Header />
            <main className="flex-grow">
                <AgentProgramHero />
                <WhyJoinUs />
                <CommissionCalculator />
                <HowItWorks />
                <AgentToolkit />
                <SuccessStories />
                <RegistrationForm />
                <Faq />
                <ClosingCta />
            </main>
            <Footer />
        </div>
    );
};

export default AgentProgramPage;
