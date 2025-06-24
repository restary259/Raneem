import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Award, Users } from 'lucide-react';
interface University {
  name: string;
  location: string;
  logoUrl: string;
  description: string;
  majors: string[];
  ranking: string;
  students: string;
}
interface UniversityCardProps {
  university: University;
}
const UniversityCard: React.FC<UniversityCardProps> = ({
  university
}) => {
  return <Card className="hover:shadow-xl transition-all duration-300 group">
      <CardContent className="p-6">
        <div className="bg-white p-4 rounded-lg mb-4 flex items-center justify-center border">
          
        </div>
        <h3 className="text-xl font-bold mb-2">{university.name}</h3>
        <p className="text-gray-600 flex items-center gap-2 mb-3">
          <MapPin className="h-4 w-4" />
          {university.location}
        </p>
        <p className="text-sm text-gray-600 mb-4">{university.description}</p>
        
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Award className="h-4 w-4 text-orange-500" />
            <span>{university.ranking}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-blue-500" />
            <span>{university.students}</span>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">التخصصات المتاحة:</h4>
            <div className="flex flex-wrap gap-1">
              {university.majors.map((major, idx) => <Badge key={idx} variant="secondary" className="text-xs">
                  {major}
                </Badge>)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>;
};
export default UniversityCard;