
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';

const successStories = [
    { name: "أحمد", country: "مصر", university: "جامعة ميونخ التقنية" },
    { name: "فاطمة", country: "الأردن", university: "جامعة آخن" },
    { name: "علي", country: "السعودية", university: "معهد كارلسروه للتكنولوجيا" },
    { name: "نور", country: "لبنان", university: "جامعة هامبورغ" },
    { name: "يوسف", country: "المغرب", university: "جامعة كولونيا" },
];

const LiveSuccessFeed = () => {
    const [currentStory, setCurrentStory] = useState(successStories[0]);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const showNotification = () => {
            setIsVisible(true);
            setTimeout(() => {
                setIsVisible(false);
                setTimeout(() => {
                    setCurrentStory(prev => {
                        const currentIndex = successStories.indexOf(prev);
                        const nextIndex = (currentIndex + 1) % successStories.length;
                        return successStories[nextIndex];
                    });
                }, 500);
            }, 4000);
        };

        const interval = setInterval(showNotification, 6000);
        
        // Stagger the first notification
        const startTimeout = setTimeout(showNotification, 3000);

        return () => {
            clearInterval(interval);
            clearTimeout(startTimeout);
        };
    }, []);
    
    return (
        <div className="fixed bottom-4 right-4 z-50">
            <Card
                className={`flex items-center gap-4 p-4 transition-all duration-500 transform shadow-2xl ${
                    isVisible ? 'translate-x-0 opacity-100' : 'translate-x-[calc(100%+2rem)] opacity-0'
                }`}
            >
                <CheckCircle className="h-6 w-6 text-green-500" />
                <div>
                    <p className="font-bold">تهانينا!</p>
                    <p className="text-sm text-muted-foreground">
                        حصل {currentStory.name} من {currentStory.country} على قبول في {currentStory.university}.
                    </p>
                </div>
            </Card>
        </div>
    );
}

export default LiveSuccessFeed;
