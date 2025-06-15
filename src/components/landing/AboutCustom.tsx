
import { useTranslation } from "react-i18next";
import AnimatedCounter from "@/components/landing/AnimatedCounter";

const AboutCustom = () => {
    const { t } = useTranslation('landing');
    
    const stats = [
        { value: "1500", label: "طالب راض", suffix: "+" },
        { value: "16", label: "شريك تعليمي", suffix: "+" },
        { value: "8", label: "دول حول العالم", suffix: "+" },
        { value: "98", label: "نسبة النجاح", suffix: "%" }
    ];

    return (
        <section id="about" className="py-12 md:py-24 bg-secondary">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    <div className="animate-fade-in-right">
                        <h2 className="text-3xl md:text-4xl font-bold mb-6">{t('about.title')}</h2>
                        <p className="text-muted-foreground text-lg mb-4">{t('about.paragraph1')}</p>
                        <p className="text-muted-foreground text-lg">{t('about.paragraph2')}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-8 animate-fade-in-left">
                        {stats.map((stat, index) => (
                            <div key={index} className="text-center p-4 bg-background rounded-lg shadow-sm">
                                <p className="text-4xl md:text-5xl font-bold text-accent">
                                     <AnimatedCounter end={parseInt(stat.value, 10)} />{stat.suffix}
                                </p>
                                <p className="text-sm text-muted-foreground mt-2">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AboutCustom;
