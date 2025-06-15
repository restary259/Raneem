
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Calculator } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";

type Subject = {
  id: string;
  units: string;
  grade: string;
};

const initialSubjects: Subject[] = [
    { id: 'arabic', units: '', grade: '' },
    { id: 'hebrew', units: '', grade: '' },
    { id: 'english', units: '', grade: '' },
    { id: 'math', units: '', grade: '' },
    { id: 'history', units: '', grade: '' },
    { id: 'deen', units: '', grade: '' },
    { id: 'mdniat', units: '', grade: '' },
    { id: 't5sos1', units: '', grade: '' },
    { id: 't5sos2', units: '', grade: '' },
    { id: 't5sos3', units: '', grade: '' },
];

const GpaCalculator = () => {
  const { t } = useTranslation();
  const [subjects, setSubjects] = useState<Subject[]>(() => JSON.parse(JSON.stringify(initialSubjects)));
  const [results, setResults] = useState<{ average: number | null; germanGrade: number | null }>({ average: null, germanGrade: null });
  const [error, setError] = useState<string | null>(null);

  const handleSubjectChange = (index: number, field: 'units' | 'grade', value: string) => {
    const newSubjects = [...subjects];
    if (field === 'grade') {
        if (value) {
            const numericValue = parseInt(value, 10);
            if (numericValue < 0) value = '0';
            if (numericValue > 100) value = '100';
        }
    }
    newSubjects[index][field] = value;
    setSubjects(newSubjects);
  };

  const handleCalculate = () => {
    setError(null);
    const validSubjects = subjects.filter(s => s.units && s.grade);
    
    if (validSubjects.length === 0) {
        setError(t('gpaCalculator.errorMinSubjects'));
        setResults({ average: null, germanGrade: null });
        return;
    }

    const totalWeightedGrade = validSubjects.reduce((acc, s) => acc + (parseInt(s.units, 10) * parseInt(s.grade, 10)), 0);
    const totalUnits = validSubjects.reduce((acc, s) => acc + parseInt(s.units, 10), 0);

    if (totalUnits === 0) {
        setError(t('gpaCalculator.errorZeroUnits'));
        setResults({ average: null, germanGrade: null });
        return;
    }

    const average = totalWeightedGrade / totalUnits;
    const germanGrade = 1 + 3 * ((100 - average) / 30);
    
    setResults({
        average: parseFloat(average.toFixed(2)),
        germanGrade: parseFloat(Math.max(1.0, Math.min(5.0, germanGrade)).toFixed(2))
    });
  };
  
  const handleReset = () => {
    setSubjects(JSON.parse(JSON.stringify(initialSubjects)));
    setResults({ average: null, germanGrade: null });
    setError(null);
  };

  return (
    <Card className="w-full border-none shadow-none" dir="rtl">
        <CardHeader className="text-center px-0">
            <CardTitle className="text-3xl font-bold text-primary">{t('gpaCalculator.title')}</CardTitle>
            <CardDescription>{t('gpaCalculator.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                {subjects.map((subject, index) => (
                    <div key={subject.id} className="space-y-2">
                        <Label htmlFor={subject.id}>{t(`gpaCalculator.subjects.${subject.id}`)}</Label>
                        <div className="flex gap-2">
                            <Select
                                value={subject.units}
                                onValueChange={(value) => handleSubjectChange(index, 'units', value)}
                            >
                                <SelectTrigger aria-label={`${t(`gpaCalculator.subjects.${subject.id}`)} ${t('gpaCalculator.units')}`}>
                                    <SelectValue placeholder={t('gpaCalculator.units')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {[...Array(6).keys()].map(i => (
                                        <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                id={subject.id}
                                type="number"
                                placeholder={t('gpaCalculator.grade')}
                                min="0"
                                max="100"
                                value={subject.grade}
                                onChange={(e) => handleSubjectChange(index, 'grade', e.target.value)}
                            />
                        </div>
                    </div>
                ))}
            </div>
            {error && (
                <Alert variant="destructive">
                   <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {results.average !== null && results.germanGrade !== null && (
                 <Alert variant="default" className="bg-primary/10 border-primary/50">
                    <Calculator className="h-4 w-4 text-primary" />
                    <AlertTitle className="font-bold text-primary">{t('gpaCalculator.results')}</AlertTitle>
                    <AlertDescription className="text-right space-y-1 text-foreground">
                        <p>
                          <Trans
                            i18nKey="gpaCalculator.yourAverage"
                            values={{ average: results.average }}
                            components={{ 1: <span className="font-bold" /> }}
                          />
                        </p>
                        <p>
                          <Trans
                            i18nKey="gpaCalculator.germanGrade"
                            values={{ germanGrade: results.germanGrade }}
                            components={{ 1: <span className="font-bold" /> }}
                          />
                        </p>
                    </AlertDescription>
                </Alert>
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
