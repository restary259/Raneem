
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { formSchema, FormValues, Result, countries, banksByCountry, mockApiData, timeToSortValue } from './data';

export const useCurrencyComparator = () => {
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
    if (availableBanks.length > 0) {
        form.setValue('receivingBank', availableBanks[0].id);
    }
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

  return {
    t,
    form,
    results,
    bestResult,
    targetCountry,
    targetCurrency,
    onSubmit,
  };
};
