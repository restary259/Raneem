
import { useEffect, useState, useCallback } from 'react';
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

  const { watch, getValues, setValue } = form;
  
  const targetCountry = watch('targetCountry');
  const receivingBank = watch('receivingBank');
  const deliverySpeed = watch('deliverySpeed');
  const watchedAmount = watch('amount');

  // Guard to ensure targetCountry is valid before it's used, preventing crashes.
  const safeTargetCountry = targetCountry && countries[targetCountry] ? targetCountry : 'DE';
  
  const targetCurrency = countries[safeTargetCountry].currency;
  const availableBanks = banksByCountry[safeTargetCountry];

  useEffect(() => {
    const currentBank = getValues('receivingBank');
    const isCurrentBankAvailable = availableBanks.some(b => b.id === currentBank);

    if (availableBanks.length > 0 && !isCurrentBankAvailable) {
        setValue('receivingBank', availableBanks[0].id);
    }
  }, [safeTargetCountry, availableBanks, getValues, setValue]);

  const calculateResults = useCallback((values: FormValues) => {
    const { amount: rawAmount, receivingBank, deliverySpeed } = values;
    const amount = typeof rawAmount === 'string' ? parseFloat(rawAmount) : rawAmount;

    if (!amount || isNaN(amount) || amount <= 0) {
      setResults(null);
      setBestResult(null);
      return;
    }
    
    const services = mockApiData[targetCurrency as keyof typeof mockApiData];
    const bankData = availableBanks.find(b => b.id === receivingBank);
    
    if (!bankData) {
      console.error("Bank data not found for:", receivingBank);
      setResults(null);
      setBestResult(null);
      return;
    }

    const bankFee = bankData.fee;
    
    const calculatedResults = Object.entries(services).map(([service, data]) => {
      const serviceFee = data.fee;
      const totalFee = serviceFee + bankFee;
      return {
        service: data.name,
        bank: t(bankData.nameKey as any),
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
    setBestResult(calculatedResults[0] || null);
  }, [t, targetCurrency, availableBanks]);
  
  useEffect(() => {
    // Calculate results on initial load and on form changes
    calculateResults(getValues());
  }, [watchedAmount, deliverySpeed, receivingBank, targetCountry, calculateResults, getValues]);

  const onSubmit = (values: FormValues) => {
    calculateResults(values);
  };

  return {
    t,
    form,
    results,
    bestResult,
    targetCountry: safeTargetCountry,
    targetCurrency,
    onSubmit,
  };
};

