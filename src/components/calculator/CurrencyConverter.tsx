
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CurrencyRate {
  [key: string]: number;
}

const CurrencyConverter = () => {
  const [amount, setAmount] = useState<string>('1000');
  const [fromCurrency, setFromCurrency] = useState<string>('EUR');
  const [toCurrency, setToCurrency] = useState<string>('ILS');
  const [rates, setRates] = useState<CurrencyRate>({});
  const [convertedAmount, setConvertedAmount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const { toast } = useToast();

  const currencies = [
    { code: 'EUR', name: 'Euro (€)', symbol: '€' },
    { code: 'USD', name: 'US Dollar ($)', symbol: '$' },
    { code: 'ILS', name: 'Israeli Shekel (₪)', symbol: '₪' },
    { code: 'RON', name: 'Romanian Leu (RON)', symbol: 'RON' },
    { code: 'JOD', name: 'Jordanian Dinar (JOD)', symbol: 'JOD' },
    { code: 'GBP', name: 'British Pound (£)', symbol: '£' },
    { code: 'CAD', name: 'Canadian Dollar (C$)', symbol: 'C$' },
    { code: 'AUD', name: 'Australian Dollar (A$)', symbol: 'A$' },
  ];

  const fetchExchangeRates = async () => {
    setLoading(true);
    try {
      // Using a free API that doesn't require API key - exchangerate-api.com
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
      
      if (!response.ok) {
        throw new Error('Failed to fetch exchange rates');
      }
      
      const data = await response.json();
      setRates(data.rates);
      setLastUpdated(new Date(data.date).toLocaleDateString('ar-EG'));
      
      toast({
        title: "تم تحديث أسعار الصرف",
        description: "تم تحديث جميع أسعار الصرف بنجاح",
      });
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      
      // Fallback rates if API fails
      const fallbackRates = {
        EUR: 1,
        USD: 1.08,
        ILS: 4.02,
        RON: 4.97,
        JOD: 0.77,
        GBP: 0.86,
        CAD: 1.47,
        AUD: 1.63,
      };
      
      setRates(fallbackRates);
      setLastUpdated(new Date().toLocaleDateString('ar-EG'));
      
      toast({
        variant: "destructive",
        title: "خطأ في تحديث الأسعار",
        description: "تم استخدام الأسعار المحفوظة. يرجى المحاولة لاحقاً للحصول على أحدث الأسعار.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExchangeRates();
  }, []);

  useEffect(() => {
    if (rates[fromCurrency] && rates[toCurrency] && amount) {
      const numAmount = parseFloat(amount);
      if (!isNaN(numAmount)) {
        // Convert from EUR base
        const eurAmount = numAmount / rates[fromCurrency];
        const result = eurAmount * rates[toCurrency];
        setConvertedAmount(result);
      }
    }
  }, [amount, fromCurrency, toCurrency, rates]);

  const handleSwapCurrencies = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
  };

  const formatCurrency = (value: number, currencyCode: string): string => {
    const currency = currencies.find(c => c.code === currencyCode);
    return `${value.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })} ${currency?.symbol || currencyCode}`;
  };

  const getExchangeRate = (): string => {
    if (rates[fromCurrency] && rates[toCurrency]) {
      const rate = rates[toCurrency] / rates[fromCurrency];
      return rate.toFixed(4);
    }
    return '0.0000';
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>محول العملات</span>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchExchangeRates}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث الأسعار
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="amount">المبلغ</Label>
            <Input
              id="amount"
              type="number"
              placeholder="أدخل المبلغ"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="from-currency">من العملة</Label>
            <Select value={fromCurrency} onValueChange={setFromCurrency}>
              <SelectTrigger>
                <SelectValue placeholder="اختر العملة" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSwapCurrencies}
            className="rounded-full p-2"
            title="تبديل العملات"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="to-currency">إلى العملة</Label>
          <Select value={toCurrency} onValueChange={setToCurrency}>
            <SelectTrigger>
              <SelectValue placeholder="اختر العملة" />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((currency) => (
                <SelectItem key={currency.code} value={currency.code}>
                  {currency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg border">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-800 mb-2">
              {formatCurrency(convertedAmount, toCurrency)}
            </div>
            <div className="text-sm text-blue-600 flex items-center justify-center gap-1">
              <TrendingUp className="h-4 w-4" />
              سعر الصرف: 1 {fromCurrency} = {getExchangeRate()} {toCurrency}
            </div>
          </div>
        </div>

        {lastUpdated && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground justify-center">
            <AlertCircle className="h-3 w-3" />
            آخر تحديث: {lastUpdated}
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center bg-gray-50 p-3 rounded">
          <strong>ملاحظة:</strong> أسعار الصرف تتغير باستمرار. هذه الأسعار إرشادية وقد تختلف عن الأسعار الفعلية في البنوك وشركات الصرافة.
        </div>
      </CardContent>
    </Card>
  );
};

export default CurrencyConverter;
