import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';
import {
  languageSchools,
  HEALTH_INSURANCE_SHORT,
  HEALTH_INSURANCE_LONG,
  MOBILE_INTERNET,
  DEUTSCHLAND_TICKET,
  VISA_FEE,
  FOOD_BUDGET_MIN,
  FOOD_BUDGET_MAX,
  FOOD_BUDGET_DEFAULT,
} from '@/lib/language-school-data';

const CostCalculator = () => {
  const { t, i18n } = useTranslation('resources');
  const isAr = i18n.language === 'ar';

  const [schoolId, setSchoolId] = useState(languageSchools[0].id);
  const [weeks, setWeeks] = useState(52);
  const [accommodationId, setAccommodationId] = useState('');
  const [insuranceType, setInsuranceType] = useState<'long' | 'short'>('long');
  const [includeMobile, setIncludeMobile] = useState(true);
  const [includeTransport, setIncludeTransport] = useState(true);
  const [includeVisa, setIncludeVisa] = useState(true);
  const [foodBudget, setFoodBudget] = useState(FOOD_BUDGET_DEFAULT);

  const school = languageSchools.find(s => s.id === schoolId)!;
  const isLongTerm = weeks >= school.coursePricing.shortTermThreshold;

  // Reset accommodation when school changes
  const accommodations = school.accommodations;
  const selectedAccommodation = accommodations.find(a => a.id === accommodationId) || accommodations[0];

  const months = Math.round(weeks / 4.33);

  const breakdown = useMemo(() => {
    const courseRate = isLongTerm ? school.coursePricing.longTermWeekly : school.coursePricing.shortTermWeekly;
    const courseCost = courseRate * weeks;
    const registration = school.registrationFee;

    const accRate = isLongTerm ? selectedAccommodation.weeklyRateLong : selectedAccommodation.weeklyRateShort;
    const accommodationCost = accRate * weeks;
    const deposit = school.accommodationDeposit;
    const adminFee = school.accommodationAdminFee;

    const insurance = (insuranceType === 'long' ? HEALTH_INSURANCE_LONG : HEALTH_INSURANCE_SHORT) * months;
    const mobile = includeMobile ? MOBILE_INTERNET * months : 0;
    const transport = includeTransport ? DEUTSCHLAND_TICKET * months : 0;
    const food = foodBudget * months;
    const visa = includeVisa ? VISA_FEE : 0;

    const total = courseCost + registration + accommodationCost + deposit + adminFee + insurance + mobile + transport + food + visa;

    return {
      courseCost,
      registration,
      accommodationCost,
      deposit,
      adminFee,
      insurance,
      mobile,
      transport,
      food,
      visa,
      total,
      monthly: total / (months || 1),
    };
  }, [school, selectedAccommodation, weeks, isLongTerm, months, insuranceType, includeMobile, includeTransport, includeVisa, foodBudget]);

  const resultItems = [
    { key: 'courseCost', label: t('costCalc.courseFees') },
    { key: 'registration', label: t('costCalc.registrationFee') },
    { key: 'accommodationCost', label: t('costCalc.accommodationCost') },
    { key: 'deposit', label: t('costCalc.deposit') },
    { key: 'adminFee', label: t('costCalc.adminFee') },
    { key: 'insurance', label: t('costCalc.healthInsurance') },
    { key: 'mobile', label: t('costCalc.mobile') },
    { key: 'transport', label: t('costCalc.transport') },
    { key: 'food', label: t('costCalc.food') },
    { key: 'visa', label: t('costCalc.visa') },
  ];

  return (
    <div className="p-4 bg-background rounded-lg">
      <div className="mb-6 text-center">
        <h3 className="text-2xl font-bold text-primary">{t('costCalc.title')}</h3>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">{t('costCalc.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* School selector */}
          <div className="space-y-2">
            <Label>{t('costCalc.selectSchool')}</Label>
            <Select value={schoolId} onValueChange={(v) => { setSchoolId(v); setAccommodationId(''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {languageSchools.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {isAr ? `${s.nameAr} (${s.cityAr})` : `${s.nameEn} (${s.cityEn})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {school.lessonsPerWeek} {t('costCalc.lessonsPerWeek')}
            </p>
          </div>

          {/* Duration slider */}
          <div className="space-y-2">
            <Label>{t('costCalc.duration')}: <span className="text-primary font-bold">{weeks} {t('costCalc.weeks')}</span></Label>
            <Slider
              min={1}
              max={52}
              step={1}
              value={[weeks]}
              onValueChange={([v]) => setWeeks(v)}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 {t('costCalc.week')}</span>
              <span>52 {t('costCalc.weeks')}</span>
            </div>
          </div>

          {/* Accommodation */}
          <div className="space-y-2">
            <Label>{t('costCalc.accommodation')}</Label>
            <Select value={selectedAccommodation.id} onValueChange={setAccommodationId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {accommodations.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {isAr ? a.nameAr : a.nameEn} — €{isLongTerm ? a.weeklyRateLong : a.weeklyRateShort}/{t('costCalc.week')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Health Insurance */}
          <div className="space-y-2">
            <Label>{t('costCalc.healthInsurance')}</Label>
            <Select value={insuranceType} onValueChange={(v) => setInsuranceType(v as 'long' | 'short')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="long">{t('costCalc.insuranceLong')} (€{HEALTH_INSURANCE_LONG}/{t('costCalc.month')})</SelectItem>
                <SelectItem value="short">{t('costCalc.insuranceShort')} (€{HEALTH_INSURANCE_SHORT}/{t('costCalc.month')})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Toggles */}
          <div className="space-y-4">
            <h4 className="font-medium">{t('costCalc.additionalOptions')}</h4>
            <div className="flex flex-row-reverse items-center justify-end gap-4 rounded-md border p-3 shadow-sm">
              <Switch checked={includeMobile} onCheckedChange={setIncludeMobile} />
              <Label className="m-0">{t('costCalc.mobileLabel')} (€{MOBILE_INTERNET}/{t('costCalc.month')})</Label>
            </div>
            <div className="flex flex-row-reverse items-center justify-end gap-4 rounded-md border p-3 shadow-sm">
              <Switch checked={includeTransport} onCheckedChange={setIncludeTransport} />
              <Label className="m-0">{t('costCalc.transportLabel')} (€{DEUTSCHLAND_TICKET}/{t('costCalc.month')})</Label>
            </div>
            <div className="flex flex-row-reverse items-center justify-end gap-4 rounded-md border p-3 shadow-sm">
              <Switch checked={includeVisa} onCheckedChange={setIncludeVisa} />
              <Label className="m-0">{t('costCalc.visaLabel')} (€{VISA_FEE})</Label>
            </div>
          </div>

          {/* Food budget */}
          <div className="space-y-2">
            <Label>{t('costCalc.foodBudget')}: <span className="text-primary font-bold">€{foodBudget}/{t('costCalc.month')}</span></Label>
            <Slider
              min={FOOD_BUDGET_MIN}
              max={FOOD_BUDGET_MAX}
              step={10}
              value={[foodBudget]}
              onValueChange={([v]) => setFoodBudget(v)}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>€{FOOD_BUDGET_MIN}</span>
              <span>€{FOOD_BUDGET_MAX}</span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-3">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>{t('costCalc.resultsTitle')}</CardTitle>
              <CardDescription>
                {isAr ? school.nameAr : school.nameEn} — {weeks} {t('costCalc.weeks')} ({months} {t('costCalc.months')})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">{t('costCalc.item')}</TableHead>
                    <TableHead className="text-left">{t('costCalc.cost')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultItems.map(item => {
                    const val = breakdown[item.key as keyof typeof breakdown] as number;
                    if (val <= 0) return null;
                    return (
                      <TableRow key={item.key}>
                        <TableCell className="font-medium">{item.label}</TableCell>
                        <TableCell className="text-left">€{Math.round(val).toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-secondary/50 font-bold text-lg">
                    <TableCell>{t('costCalc.total')}</TableCell>
                    <TableCell className="text-left">€{Math.round(breakdown.total).toLocaleString()}</TableCell>
                  </TableRow>
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell>{t('costCalc.monthlyAvg')}</TableCell>
                    <TableCell className="text-left text-primary">€{Math.round(breakdown.monthly).toLocaleString()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-4">{t('costCalc.disclaimer')}</p>
              <Button asChild className="w-full mt-6" size="lg">
                <Link to="/contact">{t('costCalc.contactUs')}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CostCalculator;
