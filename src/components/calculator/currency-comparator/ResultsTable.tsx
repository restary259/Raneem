
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { Result } from './data';

interface ResultsTableProps {
  results: Result[];
  targetCurrency: string;
}

export const ResultsTable = ({ results, targetCurrency }: ResultsTableProps) => {
  const { t } = useTranslation();

  return (
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
  );
};
