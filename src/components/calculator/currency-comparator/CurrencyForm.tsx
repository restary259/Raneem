import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { FormValues, countries, banksByCountry } from './data';

// No onSubmit prop needed now!
export const CurrencyForm = () => {
  const { t } = useTranslation('resources');
  const form = useFormContext<FormValues>();
  const targetCountry = useWatch({ control: form.control, name: 'targetCountry' });

  // Guard to ensure targetCountry is valid before it's used.
  const safeTargetCountry = targetCountry && countries[targetCountry] ? targetCountry : 'DE';
  const targetCurrency = countries[safeTargetCountry].currency;
  const availableBanks = banksByCountry[safeTargetCountry];

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Replaced <form> with <div> so the button does nothing */}
        <div className="space-y-6">
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

          {/* The button is now type=button and doesn't submit anything */}
          <Button type="button" className="w-full" size="lg">
            <TrendingUp className="ml-2 h-5 w-5" />
            {t('currencyComparator.compare')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
