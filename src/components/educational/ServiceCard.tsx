
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Service {
  name: string;
  logoUrl: string;
  type: string;
  description: string;
}

interface ServiceCardProps {
  service: Service;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service }) => {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6 text-center">
        <div className="bg-white p-4 rounded-lg mb-4 flex items-center justify-center border">
          <img 
            src={service.logoUrl} 
            alt={service.name}
            className="h-12 w-auto object-contain"
          />
        </div>
        <h3 className="text-lg font-bold mb-2">{service.name}</h3>
        <Badge variant="outline" className="mb-3">{service.type}</Badge>
        <p className="text-sm text-gray-600">{service.description}</p>
      </CardContent>
    </Card>
  );
};

export default ServiceCard;
