
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import PartnersList from "@/components/partners/PartnersList";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const PartnersPage = () => {
    const { t } = useTranslation('partners');
    useEffect(() => {
        document.title = "شركاؤنا | درب للدراسة الدولية";
    }, []);

    return (
        <div dir="rtl" className="flex flex-col min-h-screen bg-background text-foreground">
            <Header />
            <main className="flex-grow">
                <section className="relative py-20 md:py-32 bg-secondary text-white">
                    <div className="absolute inset-0 bg-black/60 z-0">
                        <img 
                            src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&q=80" 
                            alt="International Students" 
                            className="w-full h-full object-cover opacity-50" 
                        />
                    </div>
                     <div className="container mx-auto px-4 text-center relative z-10">
                        <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">{t('partnersPage.heroTitle')}</h1>
                    </div>
                </section>
                
                <PartnersList />

                <section className="py-16 md:py-24 bg-gray-900 text-center">
                     <div className="container mx-auto px-4 text-center text-white">
                        <h2 className="text-3xl md:text-4xl font-bold text-accent mb-4">{t('partnersPage.cta.title')}</h2>
                        <p className="text-lg text-gray-300 max-w-3xl mx-auto mb-8 font-light">
                           {t('partnersPage.cta.subtitle')}
                        </p>
                        <Button asChild size="lg" variant="accent">
                            <Link to="/partnership">{t('partnersPage.cta.button')}</Link>
                        </Button>
                    </div>
                </section>
                
                <div className="py-6 bg-background">
                    <div className="container mx-auto px-4">
                        <p className="text-xs text-muted-foreground text-center">
                            {t('partnersPage.disclaimer')}
                        </p>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default PartnersPage;
