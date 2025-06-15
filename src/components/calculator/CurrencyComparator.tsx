
import { FormProvider } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useCurrencyComparator } from './currency-comparator/useCurrencyComparator';
import { CurrencyForm } from './currency-comparator/CurrencyForm';
import { BestResultCard } from './currency-comparator/BestResultCard';
import { ResultsTable } from './currency-comparator/ResultsTable';

const CurrencyComparator = () => {
  const { 
    t, 
    form, 
    results, 
    bestResult, 
    targetCountry, 
    targetCurrency, 
    onSubmit 
  } = useCurrencyComparator();

  return (
    <div className="p-4 bg-background rounded-lg">
      <div className="mb-6 text-center">
        <h3 className="text-2xl font-bold text-primary">{t('currencyComparator.title')}</h3>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">{t('currencyComparator.description')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <FormProvider {...form}>
          <CurrencyForm onSubmit={onSubmit} />
        </FormProvider>

        <div className="space-y-4">
          {bestResult && (
            <BestResultCard 
              bestResult={bestResult}
              form={form}
              targetCountry={targetCountry}
            />
          )}

          {results && (
            <ResultsTable 
              results={results} 
              targetCurrency={targetCurrency}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CurrencyComparator;
