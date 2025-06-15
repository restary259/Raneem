
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BadgePercent, Handshake, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

const icons = { BadgePercent, Handshake, Mail };
const iconKeys: (keyof typeof icons)[] = ['BadgePercent', 'Handshake', 'Mail'];

const WhatIsIt = () => {
  const { t } = useTranslation('partnership');
  const features = t('whatIsIt.features', { returnObjects: true }) as { title: string; description: string }[];
  
    return (
        <section className="py-12 md:py-24">
            <div className="container mx-auto px-4">
                <div className="text-center max-w-2xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold">{t('whatIsIt.title')}</h2>
                    <p className="mt-4 text-muted-foreground">{t('whatIsIt.subtitle')}</p>
                </div>
                <div className="mt-12 grid gap-8 md:grid-cols-3">
                    {Array.isArray(features) && features.map((feature, index) => {
                         const IconComponent = icons[iconKeys[index]];
                         return (
                             <Card key={index} className="text-center p-4">
                                <CardHeader>
                                    <div className="flex justify-center mb-4">
                                        <IconComponent className="h-12 w-12 text-accent" />
                                    </div>
                                    <CardTitle>{feature.title}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-muted-foreground">{feature.description}</p>
                                </CardContent>
                            </Card>
                         );
                    })}
                </div>
            </div>
        </section>
    )
}

export default WhatIsIt;
