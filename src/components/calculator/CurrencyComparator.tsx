
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, TrendingUp } from 'lucide-react';

// --- Data Structures ---

const countries = {
  DE: { nameKey: 'germany', currency: 'EUR', flag: '🇩🇪' },
  RO: { nameKey: 'romania', currency: 'RON', flag: '🇷🇴' },
  JO: { nameKey: 'jordan', currency: 'JOD', flag: '🇯🇴' },
};

const banksByCountry = {
  DE: [
    { id: 'n26', nameKey: 'banks.n26', fee: 0 },
    { id: 'dkb', nameKey: 'banks.dkb', fee: 0 },
    { id: 'sparkasse', nameKey: 'banks.sparkasse', fee: 20 },
    { id: 'deutsche', nameKey: 'banks.deutsche', fee: 40 },
  ],
  RO: [
    { id: 'bancatransilvania', nameKey: 'banks.bancatransilvania', fee: 9 },
    { id: 'brd', nameKey: 'banks.brd', fee: 18 },
    { id: 'ing', nameKey: 'banks.ing', fee: 5 },
    { id: 'raiffeisen', nameKey: 'banks.raiffeisen', fee: 13 },
  ],
  JO: [
    { id: 'arab', nameKey: 'banks.arab', fee: 35 },
    { id: 'cairoamman', nameKey: 'banks.cairoamman', fee: 25 },
    { id: 'etihad', nameKey: 'banks.etihad', fee: 30 },
    { id: 'housing', nameKey: 'banks.housing', fee: 40 },
  ],
};

const mockApiData = {
  EUR: {
    wise: { rate: 0.26, fee: 15, time: 'arrivesInHours' },
    revolut: { rate: 0.258, fee: 20, time: 'arrivesInHours' },
    xoom: { rate: 0.255, fee: 25, time: 'arrivesInDays' },
  },
  JOD: {
    wise: { rate: 0.19, fee: 18, time: 'arrivesInHours' },
    revolut: { rate: 0.188, fee: 22, time: 'arrivesInDays' },
    xoom: { rate: 0.185, fee: 30, time: 'arrivesInDays' },
  },
  RON: {
    wise: { rate: 1.29, fee: 12, time: 'arrivesInHours' },
    revolut: { rate: 1.28, fee: 18, time: 'arrivesInHours' },
    xoom: { rate: 1.27, fee: 28, time: 'arrivesInDays' },
  },
};

const timeToSortValue = {
  arrivesInHours: 1,
  arrivesInDays: 2,
};

const formSchema = z.object({
  amount: z.preprocess(
    (a) => parseFloat(z.string().parse(a)),
    z.number().positive({ message: 'الرجاء إدخال مبلغ صحيح' })
  ),
  targetCountry: z.enum(['DE', 'RO', 'JO']),
  receivingBank: z.string({ required_error: "الرجاء اختيار بنك" }).nonempty("الرجاء اختيار بنك"),
  deliverySpeed: z.enum(['fastest', 'cheapest', 'balanced']),
  paymentMethod: z.enum(['bank', 'card', 'pickup']),
});

type FormValues = z.infer<typeof formSchema>;
type Result = { 
  service: string; 
  bank: string;
  rate: number; 
  serviceFee: number;
  bankFee: number;
  totalFee: number;
  time: string; 
  timeValue: number;
  received: number; 
};

const CurrencyComparator = () => {
  const { t } = useTranslation();
  const [results, setResults] = useState<Result[] | null>(null);
  const [bestResult, setBestResult] = useState<Result | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 1000,
      targetCountry: 'DE',
      receivingBank: 'n26',
      deliverySpeed: 'balanced',
      paymentMethod: 'bank',
    },
  });

  const targetCountry = form.watch('targetCountry');
  const targetCurrency = countries[targetCountry].currency;
  const availableBanks = banksByCountry[targetCountry];

  useEffect(() => {
    form.setValue('receivingBank', availableBanks[0].id);
  }, [targetCountry, availableBanks, form]);

  const onSubmit = (values: FormValues) => {
    const { amount, receivingBank, deliverySpeed } = values;
    const services = mockApiData[targetCurrency as keyof typeof mockApiData];
    const bankData = availableBanks.find(b => b.id === receivingBank);
    const bankFee = bankData?.fee ?? 0;
    
    const calculatedResults = Object.entries(services).map(([service, data]) => {
      const serviceFee = data.fee;
      const totalFee = serviceFee + bankFee;
      return {
        service: t(`currencyComparator.${service.toLowerCase()}` as any),
        bank: t(bankData!.nameKey as any),
        rate: data.rate,
        serviceFee: serviceFee,
        bankFee: bankFee,
        totalFee: totalFee,
        time: t(`currencyComparator.${data.time}` as any),
        timeValue: timeToSortValue[data.time as keyof typeof timeToSortValue],
        received: (amount * data.rate) - totalFee,
      }
    });

    calculatedResults.sort((a, b) => {
        if (deliverySpeed === 'cheapest') {
            return a.totalFee - b.totalFee;
        }
        if (deliverySpeed === 'fastest') {
            if (a.timeValue !== b.timeValue) return a.timeValue - b.timeValue;
            return b.received - a.received;
        }
        return b.received - a.received;
    });

    setResults(calculatedResults);
    setBestResult(calculatedResults[0]);
  };

  return (
    <div className="p-4 bg-background rounded-lg">
      <div className="mb-6 text-center">
        <h3 className="text-2xl font-bold text-primary">{t('currencyComparator.title')}</h3>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">{t('currencyComparator.description')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('currencyComparator.amountInILS')}</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="1000" {...field} onChange={e => field.onChange(e.target.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="targetCountry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('currencyComparator.targetCountry')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} dir="rtl">
                          <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(countries).map(([code, country]) => (
                              <SelectItem key={code} value={code}>
                                {country.flag} {t(`currencyComparator.${country.nameKey}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="receivingBank"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('currencyComparator.receivingBank')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} dir="rtl">
                          <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableBanks.map((bank) => (
                              <SelectItem key={bank.id} value={bank.id}>
                                {t(bank.nameKey as any)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="deliverySpeed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('currencyComparator.deliverySpeed')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} dir="rtl">
                          <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="fastest">{t('currencyComparator.fastest')}</SelectItem>
                            <SelectItem value="cheapest">{t('currencyComparator.cheapest')}</SelectItem>
                            <SelectItem value="balanced">{t('currencyComparator.balanced')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                 <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('currencyComparator.paymentMethod')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} dir="rtl">
                          <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="bank">{t('currencyComparator.bankTransfer')}</SelectItem>
                            <SelectItem value="card">{t('currencyComparator.creditCard')}</SelectItem>
                            <SelectItem value="pickup">{t('currencyComparator.cashPickup')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                
                <div className="p-3 bg-muted rounded-md text-center">
                    <FormLabel>{t('currencyComparator.targetCurrency')}</FormLabel>
                    <div className="font-bold text-lg">{t(`currencyComparator.${targetCurrency.toLowerCase()}` as any)}</div>
                </div>

                <Button type="submit" className="w-full" size="lg">
                  <TrendingUp className="ml-2 h-5 w-5" />
                  {t('currencyComparator.compare')}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {bestResult && (
             <Card className="bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-300">
                        <TrendingUp />
                        {t('currencyComparator.bestRecommendation')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm sm:text-base text-green-900 dark:text-green-200">
                    <Trans
                        i18nKey="currencyComparator.bestRecommendationText"
                        values={{
                            amount: form.getValues('amount').toLocaleString(),
                            country: t(`currencyComparator.${countries[targetCountry].nameKey}`),
                            service: bestResult.service,
                            bank: bestResult.bank,
                            received: Math.round(bestResult.received).toLocaleString(),
                            currency: targetCurrency,
                            time: bestResult.time,
                            fee: bestResult.totalFee.toLocaleString()
                        }}
                        components={{
                            1: <span className="font-bold" />,
                            2: <span className="font-bold" />,
                            3: <span className="font-bold text-lg" />,
                        }}
                    />
                </CardContent>
             </Card>
          )}

          {results && (
            <Card>
              <CardHeader>
                <CardTitle>{t('currencyComparator.resultsTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('currencyComparator.service')}</TableHead>
                      <TableHead>{t('currencyComparator.totalFee')}</TableHead>
                      <TableHead>{t('currencyComparator.deliveryTime')}</TableHead>
                      <TableHead className="text-left font-bold">{t('currencyComparator.youReceive')}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result, index) => (
                      <TableRow key={index} className={index === 0 ? "bg-green-100/50 dark:bg-green-900/20" : ""}>
                        <TableCell className="font-bold">
                            <div>{result.service}</div>
                            <div className="text-xs text-muted-foreground">{t('currencyComparator.receivingBank')}: {result.bank}</div>
                        </TableCell>
                        <TableCell>
                            <div>{result.totalFee.toLocaleString()} ILS</div>
                            <div className="text-xs text-muted-foreground">{t('currencyComparator.transferFee')}: {result.serviceFee} + {t('currencyComparator.bankFee')}: {result.bankFee}</div>
                        </TableCell>
                        <TableCell>{result.time}</TableCell>
                        <TableCell className="font-bold text-lg text-primary">
                          {Math.round(result.received).toLocaleString()} {targetCurrency}
                        </TableCell>
                        <TableCell>
                          <Button asChild variant="ghost" size="sm">
                            <a href="#" target="_blank" rel="noopener noreferrer">
                              {t('currencyComparator.sendTransfer')}
                              <ArrowRight className="mr-2 h-4 w-4" />
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground mt-4">{t('currencyComparator.disclaimer')}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default CurrencyComparator;
