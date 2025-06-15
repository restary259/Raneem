import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { costData } from '@/lib/cost-data';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Link } from 'react-router-dom';

const formSchema = z.object({
  country: z.enum(['germany', 'jordan', 'romania']),
  degreeLevel: z.enum(['bachelor', 'master', 'prep']),
  fieldOfStudy: z.enum(['engineering', 'medicine', 'business', 'humanities']),
  universityType: z.enum(['public', 'private']),
  accommodation: z.enum(['dormitory', 'shared', 'privateApartment']),
  lifestyle: z.array(z.number()).default([1]),
  healthInsurance: z.boolean().default(true),
  languagePrep: z.boolean().default(false),
  visaAdmin: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

interface CostBreakdown {
  [key: string]: number;
}

const CostCalculator = () => {
  const { t } = useTranslation();
  const [results, setResults] = useState<CostBreakdown | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      country: 'germany',
      degreeLevel: 'bachelor',
      fieldOfStudy: 'engineering',
      universityType: 'public',
      accommodation: 'dormitory',
      lifestyle: [1],
      healthInsurance: true,
      languagePrep: false,
      visaAdmin: true,
    },
  });

  const watchedValues = form.watch();

  useEffect(() => {
    const calculateCosts = () => {
      const {
        country,
        fieldOfStudy,
        universityType,
        accommodation,
        lifestyle,
        healthInsurance,
        languagePrep,
        visaAdmin,
      } = watchedValues;
      
      const countryData = costData[country as keyof typeof costData];
      let breakdown: CostBreakdown = {
        tuition: 0,
        livingAndAccommodation: 0,
        healthInsurance: 0,
        semesterFee: 0,
        visaAdmin: 0,
        languagePrep: 0,
      };

      // Tuition
      if (country === 'romania') {
        const romaniaData = costData.romania;
        let tuition = romaniaData.tuition[fieldOfStudy as keyof Omit<typeof romaniaData.tuition, 'private_multiplier'>];
        if (universityType === 'private' && romaniaData.tuition.private_multiplier) {
          tuition *= romaniaData.tuition.private_multiplier;
        }
        breakdown.tuition = tuition;
      } else {
        // Germany and Jordan have the same structure for tuition
        const tuitionData = countryData.tuition as typeof costData.germany.tuition;
        breakdown.tuition = tuitionData[universityType as 'public' | 'private'];
      }

      // Living & Accommodation
      const lifestyleMap = { 0: 'basic', 1: 'moderate', 2: 'comfortable' };
      const lifestyleKey = lifestyleMap[lifestyle[0] as keyof typeof lifestyleMap];
      const livingCost = countryData.livingCost[lifestyleKey as keyof typeof countryData.livingCost] * 12;
      
      const accommodationKey = accommodation === 'privateApartment' ? 'private' : accommodation;
      const accommodationCost = countryData.accommodation[accommodationKey as keyof typeof countryData.accommodation] * 12;

      breakdown.livingAndAccommodation = livingCost + accommodationCost;

      // Other costs
      if (healthInsurance && countryData.healthInsurance) {
        breakdown.healthInsurance = countryData.healthInsurance * 12;
      }
      if (country === 'germany') {
        breakdown.semesterFee = countryData.semesterFee * 2;
      }
      if (visaAdmin) {
        breakdown.visaAdmin = countryData.visaFee;
      }
      if (languagePrep) {
        breakdown.languagePrep = countryData.languagePrep;
      }

      const totalAnnual = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
      breakdown.totalAnnual = totalAnnual;
      breakdown.totalMonthly = totalAnnual / 12;

      setResults(breakdown);
    };

    calculateCosts();
  }, [watchedValues]);

  const lifestyleLabels = [
    t('costCalculator.basic'),
    t('costCalculator.moderate'),
    t('costCalculator.comfortable')
  ];
  
  const resultItems = [
    { key: 'tuition', label: t('costCalculator.tuition') },
    { key: 'livingAndAccommodation', label: t('costCalculator.livingExpenses') },
    { key: 'healthInsurance', label: t('costCalculator.healthInsurance') },
    { key: 'semesterFee', label: t('costCalculator.semesterFee') },
    { key: 'visaAdmin', label: t('costCalculator.visaAdmin') },
    { key: 'languagePrep', label: t('costCalculator.languagePrep') },
  ];

  return (
    <div className="p-4 bg-background rounded-lg">
      <div className="mb-6 text-center">
        <h3 className="text-2xl font-bold text-primary">{t('costCalculator.title')}</h3>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">{t('costCalculator.description')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2">
          <Form {...form}>
            <form className="space-y-6">
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('costCalculator.country')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} dir="rtl">
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder={t('costCalculator.country')} /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="germany">{t('costCalculator.germany')}</SelectItem>
                        <SelectItem value="jordan">{t('costCalculator.jordan')}</SelectItem>
                        <SelectItem value="romania">{t('costCalculator.romania')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField name="degreeLevel" control={form.control} render={({ field }) => (
                 <FormItem>
                    <FormLabel>{t('costCalculator.degreeLevel')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} dir="rtl">
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="bachelor">{t('costCalculator.bachelor')}</SelectItem>
                            <SelectItem value="master">{t('costCalculator.master')}</SelectItem>
                            <SelectItem value="prep">{t('costCalculator.prep')}</SelectItem>
                        </SelectContent>
                    </Select>
                 </FormItem>
              )} />
              <FormField name="fieldOfStudy" control={form.control} render={({ field }) => (
                 <FormItem>
                    <FormLabel>{t('costCalculator.fieldOfStudy')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} dir="rtl">
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="medicine">{t('costCalculator.medicine')}</SelectItem>
                            <SelectItem value="engineering">{t('costCalculator.engineering')}</SelectItem>
                            <SelectItem value="business">{t('costCalculator.business')}</SelectItem>
                            <SelectItem value="humanities">{t('costCalculator.humanities')}</SelectItem>
                        </SelectContent>
                    </Select>
                 </FormItem>
              )} />

              <FormField
                control={form.control}
                name="universityType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="flex items-center gap-2">
                        {t('costCalculator.universityType')}
                        {watchedValues.country === 'germany' && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-muted-foreground cursor-pointer" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{t('costCalculator.germanyTooltip')}</p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                    </FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl><RadioGroupItem value="public" id="public" /></FormControl>
                          <FormLabel htmlFor="public" className="font-normal">{t('costCalculator.public')}</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl><RadioGroupItem value="private" id="private" /></FormControl>
                          <FormLabel htmlFor="private" className="font-normal">{t('costCalculator.private')}</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField name="accommodation" control={form.control} render={({ field }) => (
                 <FormItem>
                    <FormLabel>{t('costCalculator.accommodation')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} dir="rtl">
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="dormitory">{t('costCalculator.dormitory')}</SelectItem>
                            <SelectItem value="shared">{t('costCalculator.shared')}</SelectItem>
                            <SelectItem value="privateApartment">{t('costCalculator.privateApartment')}</SelectItem>
                        </SelectContent>
                    </Select>
                 </FormItem>
              )} />
              
              <FormField
                control={form.control}
                name="lifestyle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="lifestyle-slider">{t('costCalculator.lifestyle')}: <span className="text-primary font-bold">{lifestyleLabels[field.value[0]]}</span></FormLabel>
                    <FormControl>
                      <Slider
                        id="lifestyle-slider"
                        dir='rtl'
                        min={0}
                        max={2}
                        step={1}
                        defaultValue={field.value}
                        onValueChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <h4 className="font-medium">{t('costCalculator.options')}</h4>
                <FormField control={form.control} name="healthInsurance" render={({ field }) => (
                    <FormItem className="flex flex-row-reverse items-center justify-end gap-4 space-y-0 rounded-md border p-3 shadow-sm">
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="text-base m-0 !mt-0">{t('costCalculator.healthInsurance')}</FormLabel>
                    </FormItem>
                )} />
                <FormField control={form.control} name="languagePrep" render={({ field }) => (
                    <FormItem className="flex flex-row-reverse items-center justify-end gap-4 space-y-0 rounded-md border p-3 shadow-sm">
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="text-base m-0 !mt-0">{t('costCalculator.languagePrep')}</FormLabel>
                    </FormItem>
                )} />
                <FormField control={form.control} name="visaAdmin" render={({ field }) => (
                    <FormItem className="flex flex-row-reverse items-center justify-end gap-4 space-y-0 rounded-md border p-3 shadow-sm">
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="text-base m-0 !mt-0">{t('costCalculator.visaAdmin')}</FormLabel>
                    </FormItem>
                )} />
              </div>

            </form>
          </Form>
        </div>
        <div className="lg:col-span-3">
            <Card className="sticky top-24">
                <CardHeader>
                    <CardTitle>{t('costCalculator.resultsTitle')}</CardTitle>
                    <CardDescription>{t('costCalculator.resultsDescription')}</CardDescription>
                </CardHeader>
                <CardContent>
                    {results ? (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-right">{t('costCalculator.item')}</TableHead>
                                        <TableHead className="text-left">{t('costCalculator.annualCost')}</TableHead>
                                        <TableHead className="text-left">{t('costCalculator.monthlyCost')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {resultItems.map(item => results[item.key] > 0 && (
                                        <TableRow key={item.key}>
                                            <TableCell className="font-medium">{item.label}</TableCell>
                                            <TableCell className="text-left">€{Math.round(results[item.key]).toLocaleString()}</TableCell>
                                            <TableCell className="text-left">€{Math.round(results[item.key] / 12).toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="bg-secondary/50 font-bold text-lg">
                                        <TableCell>{t('costCalculator.totalAnnual')}</TableCell>
                                        <TableCell className="text-left">€{Math.round(results.totalAnnual).toLocaleString()}</TableCell>
                                        <TableCell className="text-left text-primary">€{Math.round(results.totalMonthly).toLocaleString()}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                            <p className="text-xs text-muted-foreground mt-4">{t('costCalculator.disclaimer')}</p>
                            <Button asChild className="w-full mt-6" size="lg">
                              <Link to="/contact">
                                {t('costCalculator.contactUs')}
                              </Link>
                            </Button>
                        </>
                    ) : null}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
};

export default CostCalculator;
