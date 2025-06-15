
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const WhoWeArePage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground" dir="rtl" lang="ar">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-primary text-center mb-8">من نحن</h1>
          
          <section className="mb-12">
            <p className="text-lg md:text-xl text-muted-foreground text-center">
              في "درب للدراسة الدولية"، نحن أكثر من مجرد وكالة خدمات طلابية؛ نحن شريكك الموثوق في رحلتك الأكاديمية نحو المستقبل. إيماننا الراسخ بأن التعليم هو المفتاح لإطلاق الطاقات الكامنة وتحقيق الأحلام هو ما يدفعنا لتقديم دعم شامل وشخصي يرافقك من الخطوة الأولى وحتى تحقيق هدفك.
            </p>
          </section>

          <section className="space-y-10">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">رسالتنا ورؤيتنا</h2>
              <p className="text-muted-foreground leading-relaxed">
                رسالتنا هي ربط الطلاب العرب بأفضل الفرص التعليمية الدولية المتاحة، مع التزامنا المطلق بالشفافية والنزاهة والخدمة التي تضع الطالب أولاً. رؤيتنا هي تمكين كل طالب من تحقيق طموحاته الأكاديمية والشخصية بثقة واطمئنان.
              </p>
            </div>

            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">ما يميزنا</h2>
              <ul className="list-disc list-inside space-y-3 text-muted-foreground">
                <li>فريق من ذوي الخبرة العميقة بالأنظمة التعليمية في أوروبا والشرق الأوسط، خاصة في ألمانيا والأردن ورومانيا.</li>
                <li>إرشاد شخصي مصمم خصيصاً ليتناسب مع احتياجات وظروف كل طالب على حدة.</li>
                <li>عمليات واضحة وشفافة بالكامل، دون أي رسوم خفية أو مفاجآت غير متوقعة.</li>
                <li>فهم عميق للتحديات الثقافية واللغوية التي قد يواجهها طلابنا، وتقديم الدعم اللازم لتجاوزها.</li>
                <li>شبكة قوية من الشركاء الموثوقين من جامعات ومقدمي خدمات في وجهاتنا الدراسية.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">كيف ندعم طلابنا</h2>
              <p className="text-muted-foreground leading-relaxed">
                نحن لا نكتفي بمساعدتك في اختيار الجامعة وتقديم الطلبات، بل نرافقك في كل خطوة، من التحضير للتأشيرة والسفر، إلى تقديم الدعم المستمر أثناء فترة دراستك في الخارج لضمان تأقلمك ونجاحك. نؤمن ببناء علاقات طويلة الأمد، وليس مجرد تقديم خدمة لمرة واحدة.
              </p>
            </div>
          </section>

          <section className="mt-16 text-center border-t pt-8">
            <p className="text-xl md:text-2xl font-semibold text-primary mb-4">
              ندعوك للانطلاق في رحلتك معنا بثقة. نجاحك هو نجاحنا.
            </p>
            <p className="text-lg text-muted-foreground font-serif">
              شريكك الأمين لتحقيق حلم التعليم العالي.
            </p>
          </section>

        </div>
      </main>
      <Footer />
    </div>
  );
};

export default WhoWeArePage;
