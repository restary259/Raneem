
import { Service } from '@/lib/types';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from 'lucide-react';

interface ServiceCardProps {
  partner: Service;
}

const ServiceCard = ({ partner }: ServiceCardProps) => {
  return (
    <Card className="flex flex-col text-center bg-card hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 h-full overflow-hidden rounded-lg p-6 group">
       <div className="flex-shrink-0 mb-4">
         <img 
          src={partner.logoUrl} 
          alt={`${partner.name} logo`}
          className="h-16 w-auto mx-auto object-contain filter grayscale group-hover:filter-none transition-all duration-300"
        />
       </div>
       <div className="flex-grow flex flex-col">
         <h3 className="text-lg font-bold text-primary">{partner.name}</h3>
         <p className="text-sm text-muted-foreground mt-2 flex-grow">{partner.description}</p>
         {partner.darb_benefit && (
            <div className="mt-4">
                <Badge className="bg-accent/10 text-accent-foreground hover:bg-accent/20 border-accent/20 text-xs">
                    <Sparkles className="w-3 h-3 me-1.5" /> 
                    {partner.darb_benefit}
                </Badge>
            </div>
         )}
       </div>
    </Card>
  );
};

export default ServiceCard;
