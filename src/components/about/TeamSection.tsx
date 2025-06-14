
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const teamMembers = [
  {
    name: "علياء خان",
    role: "مستشار تعليمي أول",
    bio: "خبيرة في الجامعات الألمانية، بخبرة 7 سنوات في مساعدة الطلاب.",
    imageUrl: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&auto=format&fit=crop",
  },
  {
    name: "ماركوس شنايدر",
    role: "رئيس قسم القبول",
    bio: "متخصص في متطلبات القبول والتأشيرات لألمانيا ورومانيا.",
    imageUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&auto=format&fit=crop",
  },
  {
    name: "فاطمة الزهراء",
    role: "منسقة شؤون الطلاب",
    bio: "تدعم الطلاب في كل خطوة، من السكن إلى الاندماج الثقافي.",
    imageUrl: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=300&auto=format&fit=crop",
  },
  {
    name: "رادو بوبيسكو",
    role: "خبير التعليم في رومانيا",
    bio: "مطلع على أفضل الجامعات والبرامج الدراسية في رومانيا.",
    imageUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=300&auto=format&fit=crop",
  },
  {
    name: "سامي حداد",
    role: "مستشار الأردن والشرق الأوسط",
    bio: "يساعد الطلاب من منطقة الشرق الأوسط في الانتقال للدراسة بأوروبا.",
    imageUrl: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=300&auto=format&fit=crop",
  },
  {
    name: "إيلينا فيشر",
    role: "مديرة الشراكات الجامعية",
    bio: "تبني وتحافظ على علاقات قوية مع شركائنا من الجامعات.",
    imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=300&auto=format&fit=crop",
  },
];

const TeamSection = () => (
  <section className="py-12 md:py-24 bg-secondary">
    <div className="container mx-auto px-4 text-center">
      <h2 className="text-3xl md:text-4xl font-bold mb-12 text-primary">
        تعرف على فريق الخبراء لدينا
      </h2>
      <TooltipProvider>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-12">
          {teamMembers.map((member) => (
            <Tooltip key={member.name} delayDuration={100}>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center gap-2 cursor-pointer group">
                  <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-transparent group-hover:border-accent transition-all duration-300 shadow-lg">
                    <AvatarImage src={member.imageUrl} alt={member.name} loading="lazy" />
                    <AvatarFallback>{member.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <h3 className="font-bold text-lg mt-2">{member.name}</h3>
                  <p className="text-sm text-muted-foreground">{member.role}</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{member.bio}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  </section>
);

export default TeamSection;
