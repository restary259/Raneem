
import React from 'react';
import BroadcastFeed from '@/components/broadcast/BroadcastFeed';
import { MessageSquare } from 'lucide-react';

const BroadcastPage = () => {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="container mx-auto max-w-3xl py-8 px-4 font-sans">
        <header className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-primary mb-2">
            بث دارب
          </h1>
          <p className="text-lg text-muted-foreground">
            آخر التحديثات والنصائح لرحلتك الدراسية، مباشرة من فريقنا.
          </p>
        </header>
        
        <main>
          <section id="feed">
            <h2 className="text-3xl font-bold text-right mb-6 text-primary flex items-center gap-3">
              🔴 خلاصة البث المباشر
            </h2>
            <BroadcastFeed />
          </section>

          {/* سيتم إضافة الأقسام الأخرى هنا في الخطوات القادمة */}
        </main>

        <footer className="text-center text-muted-foreground text-sm pt-12 mt-8 border-t">
          <p>مدعوم من دارب ستادي إنترناشونال – شريكك الموثوق في رحلتك الدراسية.</p>
          <p>تواصل معنا على <a href="https://wa.me/962791901234" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-semibold">واتساب</a> 24/7.</p>
        </footer>
      </div>
    </div>
  );
};

export default BroadcastPage;
