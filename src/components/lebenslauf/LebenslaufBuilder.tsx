import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Download, Save, Upload, Trash2, Image, FileImage } from 'lucide-react';
import CVForm from './CVForm';
import CVPreview from './CVPreview';
import { useLebenslauf } from './useLebenslauf';

const LebenslaufBuilder: React.FC = () => {
  const { t } = useTranslation('resources');
  const { data, setData, updateData, updatePersonal, saveDraft, loadDraft, clearAll, handlePrint, handleDownloadPNG, handleDownloadJPG } = useLebenslauf();

  return (
    <div className="lebenslauf-builder">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-6 print:hidden">
        <Button onClick={handlePrint} className="gap-2"><Download className="h-4 w-4" />{t('lebenslaufBuilder.actions.downloadPDF')}</Button>
        <Button variant="outline" onClick={handleDownloadPNG} className="gap-2"><Image className="h-4 w-4" />{t('lebenslaufBuilder.actions.downloadPNG', 'PNG')}</Button>
        <Button variant="outline" onClick={handleDownloadJPG} className="gap-2"><FileImage className="h-4 w-4" />{t('lebenslaufBuilder.actions.downloadJPG', 'JPG')}</Button>
        <Button variant="outline" onClick={saveDraft} className="gap-2"><Save className="h-4 w-4" />{t('lebenslaufBuilder.actions.saveDraft')}</Button>
        <Button variant="outline" onClick={loadDraft} className="gap-2"><Upload className="h-4 w-4" />{t('lebenslaufBuilder.actions.loadDraft')}</Button>
        <Button variant="destructive" onClick={clearAll} className="gap-2"><Trash2 className="h-4 w-4" />{t('lebenslaufBuilder.actions.clearAll')}</Button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="print:hidden">
          <CVForm data={data} setData={setData} updatePersonal={updatePersonal} updateData={updateData} />
        </div>
        <div className="sticky top-20">
          <h3 className="text-lg font-medium mb-3 print:hidden">{t('lebenslaufBuilder.preview')}</h3>
          <CVPreview data={data} />
        </div>
      </div>
    </div>
  );
};

export default LebenslaufBuilder;
