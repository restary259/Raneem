
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import PartnersList from "@/components/partners/PartnersList";
import { useEffect } from "react";

const PartnersPage = () => {
    useEffect(() => {
        document.title = "شركاؤنا | Darb Study International";
    }, []);

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground" dir="rtl" lang="ar">
            <Header />
            <main className="flex-grow">
                <section className="py-12 md:py-24 bg-secondary">
                    <div className="container mx-auto px-4 text-center">
                        <h1 className="text-3xl md:text-4xl font-bold text-primary">شركاؤنا حول العالم – مؤسسات تعليمية نثق بها</h1>
                        <p className="mt-4 max-w-3xl mx-auto text-lg text-muted-foreground">
                            نفخر بشراكاتنا مع مجموعة من المؤسسات التعليمية المرموقة في ألمانيا، رومانيا، والأردن. هذه الشراكات تتيح لنا تقديم أفضل الفرص الأكاديمية لطلابنا في مختلف الدول.
                        </p>
                    </div>
                </section>
                <PartnersList />
                <section className="py-12 md:py-24 bg-secondary">
                     <div className="container mx-auto px-4 text-center">
                        <p className="text-lg text-primary max-w-3xl mx-auto">
                            نواصل توسيع شبكة شراكاتنا من أجل دعم طلابنا وتمكينهم من الوصول إلى أفضل الفرص التعليمية حول العالم.
                        </p>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
};

export default PartnersPage;
