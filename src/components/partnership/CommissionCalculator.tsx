
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const commissionRates: Record<string, number> = {
  germany: 800,
  romania: 600,
  jordan: 400,
};

const CommissionCalculator = () => {
  const { t } = useTranslation('partnership');
  const [students, setStudents] = useState(5);
  const [country, setCountry] = useState('germany');
  const countries = t('commissionCalculator.countries', { returnObjects: true }) as Record<string, string>;

  const estimatedEarnings = useMemo(() => {
    return students * (commissionRates[country] || 0);
  }, [students, country]);

  return (
    <section className="py-12 md:py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <Card className="max-w-2xl mx-auto bg-background/80 backdrop-blur-sm border-white/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">{t('commissionCalculator.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 text-right">
            <div className="space-y-4">
              <Label htmlFor="students-slider" className="text-lg">{t('commissionCalculator.studentsLabel')} {students}</Label>
              <Slider
                id="students-slider"
                dir="ltr"
                min={1}
                max={20}
                step={1}
                value={[students]}
                onValueChange={(value) => setStudents(value[0])}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country-select" className="text-lg">{t('commissionCalculator.countryLabel')}</Label>
              <Select onValueChange={setCountry} defaultValue={country} dir="rtl">
                <SelectTrigger id="country-select" className="w-full">
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(countries).map(([key, name]) => (
                    <SelectItem key={key} value={key}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-center pt-4">
              <p className="text-lg text-muted-foreground">{t('commissionCalculator.earningsTitle')}</p>
              <p className="text-4xl font-bold text-accent">
                {estimatedEarnings.toLocaleString()} {t('commissionCalculator.currency')}
              </p>
              <p className="text-sm text-muted-foreground mt-2">{t('commissionCalculator.note')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default CommissionCalculator;
