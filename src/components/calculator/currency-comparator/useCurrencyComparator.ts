import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { formSchema, Result, FormValues, countries, banksByCountry, timeToSortValue } from "./data";

// Uses your exchangerate.host API key
async function fetchExchangeRate(from: string, to: string): Promise<number | null> {
  const apiKey = "98faa4668bf440cf9c2c113446cd11c2";
  const url = `https://api.exchangerate.host/convert?from=${from}&to=${to}&api_key=${apiKey}`;
  try {
    const res = await fetch(url);
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
  const [loading, setLoading] = useState(false);

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

  // This function is triggered on any form change automatically
  useEffect(() => {
    let cancelled = false;
    const calculateResults = async () => {
      setLoading(true);
      try {
        const values = form.getValues();
        const { amount: rawAmount, receivingBank, deliverySpeed } = values;
        const amount = typeof rawAmount === 'string' ? parseFloat(rawAmount) : rawAmount;

        if (!amount || isNaN(amount) || amount <= 0) {
          setResults(null);
          setBestResult(null);
          setLoading(false);
          return;
        }

        const bankData = availableBanks.find(b => b.id === receivingBank);
        if (!bankData) {
          setResults(null);
          setBestResult(null);
          setLoading(false);
          return;
        }
        const bankFee = bankData.fee;

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

        const liveRate = await fetchExchangeRate("ILS", targetCurrency);
        if (!liveRate) {
          setResults(null);
          setBestResult(null);
          setLoading(false);
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

        if (!cancelled) {
          setResults(calculatedResults);
          setBestResult(calculatedResults[0] || null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    calculateResults();
    return () => { cancelled = true; };
    // Watch all relevant dependencies (form values)
  }, [watchedAmount, targetCountry, receivingBank, deliverySpeed, t, targetCurrency, availableBanks, form]);

  // The onSubmit is no longer needed, but kept for compatibility
  const onSubmit = () => {};

  return {
    form,
    results,
    bestResult,
    targetCountry: safeTargetCountry,
    targetCurrency,
    onSubmit,
    loading,
  };
};
