
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";

const TeamSection = () => {
  const { t } = useTranslation();
  const teamMembers = t('teamSection.members', { returnObjects: true }) as { name: string; role: string; bio: string, imageUrl: string }[];
  
  return (
    <section className="py-12 md:py-24 bg-secondary">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-12 text-primary">
          {t('teamSection.title')}
        </h2>
        <TooltipProvider>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-12">
            {Array.isArray(teamMembers) && teamMembers.map((member) => (
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
};

export default TeamSection;
