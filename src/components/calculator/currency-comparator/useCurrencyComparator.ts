import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { formSchema, Result, FormValues, countries, banksByCountry, timeToSortValue } from "./data";

// Helper to fetch real-time exchange rates
async function fetchExchangeRate(from: string, to: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.exchangerate.host/convert?from=${from}&to=${to}`);
    const data = await res.json();
    return data.result ?? null;
  } catch {
    return null;
  }
}

export const useCurrencyComparator = () => {
  const { t } = useTranslation('resources');
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

  // --- UPDATED: Fetch live exchange rates and use them in calculation ---
  const calculateResults = useCallback(async (values: FormValues) => {
    const { amount: rawAmount, receivingBank, deliverySpeed } = values;
    const amount = typeof rawAmount === 'string' ? parseFloat(rawAmount) : rawAmount;

    if (!amount || isNaN(amount) || amount <= 0) {
      setResults(null);
      setBestResult(null);
      return;
    }
    
    const bankData = availableBanks.find(b => b.id === receivingBank);
    if (!bankData) {
      setResults(null);
      setBestResult(null);
      return;
    }
    const bankFee = bankData.fee;

    // Use a list of known services with hardcoded fees & times, but get rate live
    const services = [
      {
        key: "wise",
        name: t("currencyComparator.wise"),
        fee: 20,
        time: t("currencyComparator.arrivesInHours"),
        timeValue: timeToSortValue["arrivesInHours"],
      },
      {
        key: "westernunion",
        name: t("currencyComparator.westernunion"),
        fee: 30,
        time: t("currencyComparator.arrivesInDays"),
        timeValue: timeToSortValue["arrivesInDays"],
      },
      {
        key: "xoom",
        name: t("currencyComparator.xoom"),
        fee: 25,
        time: t("currencyComparator.arrivesInHours"),
        timeValue: timeToSortValue["arrivesInHours"],
      },
    ] as const;

    // Fetch live rate from ILS (shekel) to target currency
    const liveRate = await fetchExchangeRate("ILS", targetCurrency);
    if (!liveRate) {
      setResults(null);
      setBestResult(null);
      return;
    }

    const calculatedResults = services.map((service) => {
      const serviceFee = service.fee;
      const totalFee = serviceFee + bankFee;
      return {
        service: service.name,
        bank: t(bankData.nameKey as any),
        rate: liveRate,
        serviceFee: serviceFee,
        bankFee: bankFee,
        totalFee: totalFee,
        time: service.time,
        timeValue: service.timeValue,
        received: (amount * liveRate) - totalFee,
      };
    });

    calculatedResults.sort((a, b) => {
      if (deliverySpeed === "cheapest") {
        return a.totalFee - b.totalFee;
      }
      if (deliverySpeed === "fastest") {
        if (a.timeValue !== b.timeValue) return a.timeValue - b.timeValue;
        return b.received - a.received;
      }
      return b.received - a.received;
    });

    setResults(calculatedResults);
    setBestResult(calculatedResults[0] || null);
  }, [t, targetCurrency, availableBanks]);

  // Call recalc when form values change
  useEffect(() => {
    calculateResults(form.getValues());
  // eslint-disable-next-line
  }, [watchedAmount, targetCountry, receivingBank, deliverySpeed]);

  const onSubmit = (values: FormValues) => {
    calculateResults(values);
  };

  return {
    form,
    results,
    bestResult,
    targetCountry: safeTargetCountry,
    targetCurrency,
    onSubmit,
  };
};
