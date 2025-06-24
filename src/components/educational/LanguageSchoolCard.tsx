import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
interface LanguageSchool {
  name: string;
  location: string;
  logoUrl: string;
  description: string;
  programs: string[];
}
interface LanguageSchoolCardProps {
  school: LanguageSchool;
}
const LanguageSchoolCard: React.FC<LanguageSchoolCardProps> = ({
  school
}) => {
  return <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="bg-white p-4 rounded-lg mb-4 flex items-center justify-center border">
          
        </div>
        <h3 className="text-lg font-bold mb-2">{school.name}</h3>
        <p className="text-gray-600 flex items-center gap-2 mb-3">
          <MapPin className="h-4 w-4" />
          {school.location}
        </p>
        <p className="text-sm text-gray-600 mb-4">{school.description}</p>
        
        <div>
          <h4 className="font-semibold mb-2">البرامج:</h4>
          <div className="flex flex-wrap gap-1">
            {school.programs.map((program, idx) => <Badge key={idx} variant="outline" className="text-xs">
                {program}
              </Badge>)}
          </div>
        </div>
      </CardContent>
    </Card>;
};
export default LanguageSchoolCard;