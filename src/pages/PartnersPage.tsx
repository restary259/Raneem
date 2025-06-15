
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import PartnersList from "@/components/partners/PartnersList";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

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
                <section className="py-12 md:py-24 bg-secondary">
                     <div className="container mx-auto px-4 text-center">
                        <p className="text-lg text-primary max-w-3xl mx-auto font-semibold">
                           "{t('partnersPage.quote')}"
                        </p>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
};

export default PartnersPage;
