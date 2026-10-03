import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';

interface Props {
  onSelect: (format: 'xlsx' | 'pdf') => void | Promise<void>;
  disabled?: boolean;
  busy?: boolean;
}

/**
 * Compact export control for single-table views: one Export button that reveals
 * the Excel / PDF choice. Used where a full spreadsheet toolbar would be too
 * heavy but the two formats still need to be offered.
 */
const SimpleExportMenu: React.FC<Props> = ({ onSelect, disabled = false, busy = false }) => {
  const { t } = useTranslation('dashboard');
  const [working, setWorking] = useState(false);
  const locked = disabled || busy || working;

  const choose = async (format: 'xlsx' | 'pdf') => {
    setWorking(true);
    try {
      await onSelect(format);
    } finally {
      setWorking(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={locked}>
          <Download className="h-4 w-4 me-1" />
          {busy || working ? t('sheets.preparing') : t('sheets.export', 'Export')}
          <ChevronDown className="h-4 w-4 ms-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem className="gap-2" onSelect={() => void choose('xlsx')}>
          <FileSpreadsheet className="h-4 w-4" />
          {t('sheets.exportFormatExcel', 'Excel (.xlsx)')}
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onSelect={() => void choose('pdf')}>
          <FileText className="h-4 w-4" />
          {t('sheets.exportFormatPdf', 'PDF (.pdf)')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SimpleExportMenu;
