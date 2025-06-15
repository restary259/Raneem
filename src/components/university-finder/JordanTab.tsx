
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTranslation } from 'react-i18next';

interface University {
  name: string;
  location: string;
  tuition: string;
  website: string;
}

const universities: University[] = [
    { name: 'University of Jordan', location: 'Amman', tuition: '$5,000 - $8,000', website: 'https://ju.edu.jo/home.aspx' },
    { name: 'Jordan University of Science and Technology', location: 'Irbid', tuition: '$6,000 - $10,000', website: 'https://www.just.edu.jo/' },
    { name: 'Princess Sumaya University for Technology', location: 'Amman', tuition: '$8,000 - $12,000', website: 'https://psut.edu.jo/en' },
    { name: 'German Jordanian University', location: 'Amman', tuition: '$9,000 - $14,000', website: 'http://www.gju.edu.jo/' },
];


const JordanTab = () => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('universityFinder.jordan')}</CardTitle>
        <CardDescription>{t('universityFinder.jordanTab.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('universityFinder.jordanTab.university')}</TableHead>
                <TableHead>{t('universityFinder.jordanTab.location')}</TableHead>
                <TableHead>{t('universityFinder.jordanTab.tuition')}</TableHead>
                <TableHead>{t('universityFinder.jordanTab.website')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {universities.map((uni) => (
                <TableRow key={uni.name}>
                  <TableCell className="font-medium">{uni.name}</TableCell>
                  <TableCell>{uni.location}</TableCell>
                  <TableCell>{uni.tuition}</TableCell>
                  <TableCell>
                    <Button variant="link" asChild className="p-0 h-auto">
                      <a href={uni.website} target="_blank" rel="noopener noreferrer">Visit Website</a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default JordanTab;
