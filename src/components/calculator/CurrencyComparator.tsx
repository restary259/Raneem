import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, TrendingUp } from 'lucide-react';

// Placeholder data - we'll replace this with a real API later
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

const formSchema = z.object({
  amount: z.preprocess(
    (a) => parseFloat(z.string().parse(a)),
    z.number().positive({ message: 'الرجاء إدخال مبلغ صحيح' })
  ),
  targetCurrency: z.enum(['EUR', 'JOD', 'RON']),
});

type FormValues = z.infer<typeof formSchema>;
type Result = { service: string; rate: number; fee: number; time: string; received: number; };

const CurrencyComparator = () => {
  const { t } = useTranslation();
  const [results, setResults] = useState<Result[] | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 1000,
      targetCurrency: 'EUR',
    },
  });

  const onSubmit = (values: FormValues) => {
    const { amount, targetCurrency } = values;
    const services = mockApiData[targetCurrency as keyof typeof mockApiData];
    
    const calculatedResults = Object.entries(services).map(([service, data]) => ({
      service: t(`currencyComparator.${service.toLowerCase()}` as any),
      rate: data.rate,
      fee: data.fee,
      time: t(`currencyComparator.${data.time}` as any),
      received: (amount * data.rate) - data.fee,
    }));

    setResults(calculatedResults.sort((a, b) => b.received - a.received));
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
                  name="targetCurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('currencyComparator.targetCurrency')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} dir="rtl">
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="EUR">{t('currencyComparator.eur')}</SelectItem>
                          <SelectItem value="JOD">{t('currencyComparator.jod')}</SelectItem>
                          <SelectItem value="RON">{t('currencyComparator.ron')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" size="lg">
                  <TrendingUp className="ml-2 h-5 w-5" />
                  {t('currencyComparator.compare')}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div>
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
                      <TableHead>{t('currencyComparator.exchangeRate')}</TableHead>
                      <TableHead>{t('currencyComparator.transferFee')}</TableHead>
                      <TableHead>{t('currencyComparator.deliveryTime')}</TableHead>
                      <TableHead className="text-left font-bold">{t('currencyComparator.youReceive')}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result, index) => (
                      <TableRow key={index} className={index === 0 ? "bg-green-100/50 dark:bg-green-900/20" : ""}>
                        <TableCell className="font-bold">{result.service}</TableCell>
                        <TableCell>{t('currencyComparator.exchangeRateDetail', { rate: result.rate.toLocaleString(), currency: form.getValues('targetCurrency') })}</TableCell>
                        <TableCell>{result.fee.toLocaleString()} ILS</TableCell>
                        <TableCell>{result.time}</TableCell>
                        <TableCell className="font-bold text-lg text-primary">
                          {Math.round(result.received).toLocaleString()} {form.getValues('targetCurrency')}
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
