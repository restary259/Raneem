
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BadgePercent, Handshake, Mail } from "lucide-react";

const features = [
    { icon: BadgePercent, title: "مكافأة مزدوجة", description: "أنت تربح عمولة 50%، وطالبك يحصل على خصم 500 شيكل. فائدة للجميع!" },
    { icon: Handshake, title: "شراكة موثوقة", description: "انضم إلى علامة تجارية ذات مصداقية عالية وساعد الطلاب على تحقيق أحلامهم." },
    { icon: Mail, title: "دعم تسويقي كامل", description: "نوفر لك محتوى جاهز وفريق متابعة لمساعدتك على النجاح بسهولة." },
]

const WhatIsIt = () => {
    return (
        <section className="py-12 md:py-24">
            <div className="container mx-auto px-4">
                <div className="text-center max-w-2xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold">ما هو برنامج الشركاء؟</h2>
                    <p className="mt-4 text-muted-foreground">برنامجنا مصمم لمكافأة كل من يساهم في نشر رسالتنا ومساعدة الطلاب على تحقيق أحلامهم الدراسية.</p>
                </div>
                <div className="mt-12 grid gap-8 md:grid-cols-3">
                    {features.map((feature, index) => (
                         <Card key={index} className="text-center p-4">
                            <CardHeader>
                                <div className="flex justify-center mb-4">
                                    <feature.icon className="h-12 w-12 text-accent" />
                                </div>
                                <CardTitle>{feature.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">{feature.description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    )
}

export default WhatIsIt;
