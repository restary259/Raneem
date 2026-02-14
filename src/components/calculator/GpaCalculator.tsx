
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Calculator, Info, AlertTriangle } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Subject = { id: string; units: string; grade: string };

const initialSubjects: Subject[] = [
    { id: 'arabic', units: '', grade: '' }, { id: 'hebrew', units: '', grade: '' },
    { id: 'english', units: '', grade: '' }, { id: 'math', units: '', grade: '' },
    { id: 'history', units: '', grade: '' }, { id: 'deen', units: '', grade: '' },
    { id: 'mdniat', units: '', grade: '' }, { id: 't5sos1', units: '', grade: '' },
    { id: 't5sos2', units: '', grade: '' }, { id: 't5sos3', units: '', grade: '' },
];

const NMAX = 100;
const NMIN = 56;

const GpaCalculator = () => {
  const { t } = useTranslation('resources');
  const [subjects, setSubjects] = useState<Subject[]>(() => JSON.parse(JSON.stringify(initialSubjects)));
  const [results, setResults] = useState<{ average: number | null; germanGrade: number | null }>({ average: null, germanGrade: null });
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const handleSubjectChange = (index: number, field: 'units' | 'grade', value: string) => {
    const newSubjects = [...subjects];
    if (field === 'grade' && value) {
      const numericValue = parseInt(value, 10);
      if (numericValue < 0) value = '0';
      if (numericValue > 100) value = '100';
    }
    newSubjects[index][field] = value;
    setSubjects(newSubjects);
  };

  const handleCalculate = () => {
    setError(null); setWarnings([]);
    const newWarnings: string[] = [];
    const validSubjects = subjects.filter(s => s.units && s.grade);
    
    if (validSubjects.length === 0) { setError(t('gpaCalculator.errorMinSubjects')); setResults({ average: null, germanGrade: null }); return; }

    for (const s of validSubjects) {
      const units = parseInt(s.units, 10);
      if (units < 1 || units > 5) { setError(t('gpaCalculator.errorUnitsRange')); setResults({ average: null, germanGrade: null }); return; }
      const grade = parseInt(s.grade, 10);
      if (grade < 0 || grade > 100) { setError(t('gpaCalculator.errorGradeRange')); setResults({ average: null, germanGrade: null }); return; }
    }

    const totalWeightedGrade = validSubjects.reduce((acc, s) => acc + (parseInt(s.units, 10) * parseInt(s.grade, 10)), 0);
    const totalUnits = validSubjects.reduce((acc, s) => acc + parseInt(s.units, 10), 0);
    if (totalUnits === 0) { setError(t('gpaCalculator.errorZeroUnits')); setResults({ average: null, germanGrade: null }); return; }

    const average = totalWeightedGrade / totalUnits;
    if (average < NMIN) {
      newWarnings.push(t('gpaCalculator.warningBelowPass', { avg: average.toFixed(1), min: NMIN }));
    }

    const germanGrade = 1 + 3 * ((NMAX - average) / (NMAX - NMIN));
    setWarnings(newWarnings);
    setResults({ average: parseFloat(average.toFixed(2)), germanGrade: parseFloat(Math.max(1.0, Math.min(4.0, germanGrade)).toFixed(2)) });
  };
  
  const handleReset = () => { setSubjects(JSON.parse(JSON.stringify(initialSubjects))); setResults({ average: null, germanGrade: null }); setError(null); setWarnings([]); };

  return (
    <Card className="w-full border-none shadow-none">
        <CardHeader className="text-center px-0">
            <CardTitle className="text-3xl font-bold text-primary">{t('gpaCalculator.title')}</CardTitle>
            <CardDescription>{t('gpaCalculator.titleDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                {subjects.map((subject, index) => (
                    <div key={subject.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={subject.id}>{t(`gpaCalculator.subjects.${subject.id}`)}</Label>
                          <Tooltip>
                            <TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[200px]"><p className="text-xs">{t('gpaCalculator.tooltipText')}</p></TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex gap-2">
                            <Select value={subject.units} onValueChange={(value) => handleSubjectChange(index, 'units', value)}>
                                <SelectTrigger aria-label={`${t(`gpaCalculator.subjects.${subject.id}`)} ${t('gpaCalculator.units')}`}><SelectValue placeholder={t('gpaCalculator.units')} /></SelectTrigger>
                                <SelectContent>{[1, 2, 3, 4, 5].map(i => (<SelectItem key={i} value={String(i)}>{i}</SelectItem>))}</SelectContent>
                            </Select>
                            <Input id={subject.id} type="number" placeholder={t('gpaCalculator.grade')} min="0" max="100" value={subject.grade} onChange={(e) => handleSubjectChange(index, 'grade', e.target.value)} />
                        </div>
                    </div>
                ))}
            </div>
            {error && (<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>)}
            {warnings.map((w, i) => (
              <Alert key={i} className="bg-amber-50 border-amber-200"><AlertTriangle className="h-4 w-4 text-amber-600" /><AlertDescription className="text-amber-800">{w}</AlertDescription></Alert>
            ))}
            {results.average !== null && results.germanGrade !== null && (
              <>
                <Alert variant="default" className="bg-primary/10 border-primary/50">
                    <Calculator className="h-4 w-4 text-primary" />
                    <AlertTitle className="font-bold text-primary">{t('gpaCalculator.results')}</AlertTitle>
                    <AlertDescription className="space-y-1 text-foreground">
                        <p><Trans i18nKey="gpaCalculator.yourAverage" ns="resources" values={{ average: results.average }} components={{ 1: <span className="font-bold" /> }} /></p>
                        <p><Trans i18nKey="gpaCalculator.germanGrade" ns="resources" values={{ germanGrade: results.germanGrade }} components={{ 1: <span className="font-bold" /> }} /></p>
                    </AlertDescription>
                </Alert>
                <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
                  <p className="font-semibold text-foreground">{t('gpaCalculator.formulaTitle')}</p>
                  <p dir="ltr" className="text-center font-mono bg-background rounded p-2">German Grade = 1 + 3 × ((100 - Average) / (100 - 56))</p>
                  <p>{t('gpaCalculator.formulaExplanation')}</p>
                  <p>{t('gpaCalculator.formulaScale')}</p>
                </div>
              </>
            )}
        </CardContent>
        <CardFooter className="flex justify-center gap-4 pt-6 px-0">
            <Button onClick={handleCalculate} className="w-full sm:w-auto flex-grow sm:flex-grow-0">{t('gpaCalculator.calculate')}</Button>
            <Button onClick={handleReset} variant="outline" className="w-full sm:w-auto flex-grow sm:flex-grow-0">{t('gpaCalculator.reset')}</Button>
        </CardFooter>
    </Card>
  );
};

export default GpaCalculator;
