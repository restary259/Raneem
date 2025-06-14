
import React from 'react';

const ContactHero = () => {
  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-primary/90 to-background text-center animate-fade-in" dir="rtl">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl md:text-6xl font-bold text-primary-foreground">
          نحن هنا لمساعدتك – تواصل معنا اليوم
        </h1>
        <p className="mt-6 max-w-3xl mx-auto text-lg md:text-xl text-primary-foreground/80">
          سواء كنت تسأل عن القبول، الفيزا، أو السكن — فريق درب مستعد للإجابة وتوجيهك في كل خطوة على الطريق.
        </p>
      </div>
    </section>
  );
};

export default ContactHero;
