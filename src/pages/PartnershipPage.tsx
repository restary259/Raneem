
import { useEffect } from "react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import PartnershipHero from "@/components/partnership/PartnershipHero";
import WhatIsIt from "@/components/partnership/WhatIsIt";
import HowItWorks from "@/components/partnership/HowItWorks";
import WhyPartner from "@/components/partnership/WhyPartner";
import InfluencerMessage from "@/components/partnership/InfluencerMessage";
import SuccessStories from "@/components/partnership/SuccessStories";
import RegistrationForm from "@/components/partnership/RegistrationForm";
import Faq from "@/components/partnership/Faq";

const PartnershipPage = () => {
    useEffect(() => {
        document.title = "Partnership Opportunities | Earn with Darb Study";
    }, []);

    return (
        <div className="flex flex-col min-h-screen bg-secondary text-foreground">
            <Header />
            <main className="flex-grow">
                <PartnershipHero />
                <WhatIsIt />
                <HowItWorks />
                <WhyPartner />
                <InfluencerMessage />
                <SuccessStories />
                <RegistrationForm />
                <Faq />
            </main>
            <Footer />
        </div>
    );
};

export default PartnershipPage;
