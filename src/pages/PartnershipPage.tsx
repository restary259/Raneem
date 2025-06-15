
import { useEffect } from "react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import PartnershipHero from "@/components/partnership/PartnershipHero";
import WhyJoinUs from "@/components/partnership/WhyJoinUs";
import CommissionCalculator from "@/components/partnership/CommissionCalculator";
import NewHowItWorks from "@/components/partnership/NewHowItWorks";
import AgentToolkit from "@/components/partnership/AgentToolkit";
import SuccessStories from "@/components/partnership/SuccessStories";
import RegistrationForm from "@/components/partnership/RegistrationForm";
import NewFaq from "@/components/partnership/NewFaq";
import ClosingCta from "@/components/partnership/ClosingCta";
import { useTranslation } from "react-i18next";

const PartnershipPage = () => {
    const { t } = useTranslation('partnership');
    useEffect(() => {
        document.title = t('partnershipPage.title');
    }, [t]);

    return (
        <div dir="rtl" className="flex flex-col min-h-screen bg-secondary text-foreground">
            <Header />
            <main className="flex-grow">
                <PartnershipHero />
                <WhyJoinUs />
                <CommissionCalculator />
                <NewHowItWorks />
                <AgentToolkit />
                <SuccessStories />
                <RegistrationForm />
                <NewFaq />
                <ClosingCta />
            </main>
            <Footer />
        </div>
    );
};

export default PartnershipPage;
